import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { generateOrderNo, calculatePlatformFee } from '@/lib/utils'
import { ApiResponse } from '@/types'

// 获取订单列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const type = searchParams.get('type') // 'sell' or 'buy' or 'market'

    // 市场浏览模式不需要登录
    if (type === 'market') {
      // 市场浏览支持状态筛选（未来扩展功能）
      const marketWhere: any = {}

      // 默认只显示在售订单，也支持其他状态（如未来需要）
      if (status && status !== 'all' && status !== 'active') {
        marketWhere.status = status
      } else {
        marketWhere.status = 'PUBLISHED'  // 默认在售
      }

      const orders = await prisma.order.findMany({
        where: marketWhere,
        include: {
          seller: {
            select: {
              id: true,
              name: true,
              email: true,
              verified: true
            }
          },
          buyer: {
            select: {
              id: true,
              name: true,
              email: true,
              verified: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        data: orders
      })
    }

    // 其他模式需要登录验证
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '未授权'
      }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的token'
      }, { status: 401 })
    }

    // 构建查询条件
    let where: any = {}

    // 根据type确定用户身份筛选
    if (type === 'sell') {
      // 卖家视角：显示自己发布的所有订单
      where.sellerId = payload.userId
    } else if (type === 'buy') {
      // 买家视角：显示自己购买的订单
      where.buyerId = payload.userId
    } else {
      // 全部订单：使用OR条件
      where.OR = [
        { sellerId: payload.userId }, // 我卖出的订单
        { buyerId: payload.userId }   // 我买入的订单
      ]
    }

    // 根据status确定状态筛选
    if (status && status !== 'all') {
      if (status === 'active') {
        // 进行中的订单
        const activeStatuses = ['PUBLISHED', 'PAID', 'TRANSFERRING', 'CONFIRMING']

        if (type === 'buy') {
          // 买家视角：显示进行中的订单
          where = {
            buyerId: payload.userId,
            status: { in: activeStatuses }
          }
        } else if (type === 'sell') {
          // 卖家视角：显示进行中的订单
          where = {
            sellerId: payload.userId,
            status: { in: activeStatuses }
          }
        } else {
          // 全部：重新构建OR条件
          where = {
            OR: [
              { sellerId: payload.userId, status: { in: activeStatuses } },
              { buyerId: payload.userId, status: { in: activeStatuses } }
            ]
          }
        }
      } else {
        // 特定状态筛选
        if (type === 'buy' && status === 'CANCELLED') {
          // 买家查看已取消订单：只显示已付款的已取消订单
          where = {
            buyerId: payload.userId,
            status: 'CANCELLED',
            paidAt: { not: null }
          }
        } else if (type === 'buy') {
          // 买家查看其他状态：正常显示
          where = {
            buyerId: payload.userId,
            status: status
          }
        } else if (type === 'sell') {
          // 卖家查看任何状态：正常显示
          where = {
            sellerId: payload.userId,
            status: status
          }
        } else {
          // 全部订单的特定状态
          if (status === 'CANCELLED') {
            // 查看已取消：卖家的所有已取消订单 + 买家已付款的已取消订单
            where = {
              OR: [
                { sellerId: payload.userId, status: 'CANCELLED' },
                { buyerId: payload.userId, status: 'CANCELLED', paidAt: { not: null } }
              ]
            }
          } else {
            where = {
              OR: [
                { sellerId: payload.userId, status: status },
                { buyerId: payload.userId, status: status }
              ]
            }
          }
        }
      }
    } else if (!status || status === 'all') {
      // 显示所有状态，但买家不显示未参与过的已取消订单
      if (type === 'buy') {
        // 买家：排除未付款的已取消订单
        where = {
          OR: [
            { buyerId: payload.userId, status: { not: 'CANCELLED' } },
            { buyerId: payload.userId, status: 'CANCELLED', paidAt: { not: null } }
          ]
        }
      } else if (type !== 'sell') {
        // 全部订单：排除买家未参与过的已取消订单
        where = {
          OR: [
            { sellerId: payload.userId }, // 卖家的所有订单
            { buyerId: payload.userId, status: { not: 'CANCELLED' } }, // 买家的非取消订单
            { buyerId: payload.userId, status: 'CANCELLED', paidAt: { not: null } } // 买家已付款的取消订单
          ]
        }
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            verified: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            verified: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: orders
    })
  } catch (error) {
    console.error('获取订单列表错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}

// 创建订单
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '未授权'
      }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的token'
      }, { status: 401 })
    }

    const body = await request.json()
    const { vehicleBrand, vehicleModel, vehicleYear, vin, fsdVersion, price } = body

    // 验证必填字段
    if (!vehicleBrand || !vehicleModel || !vehicleYear || !fsdVersion || !price) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '请填写完整的订单信息'
      }, { status: 400 })
    }

    // 确保价格精度（四舍五入到2位小数）
    const priceDecimal = Math.round(parseFloat(price) * 100) / 100

    // 生成订单号
    const orderNo = generateOrderNo()

    // 计算平台手续费
    const platformFee = calculatePlatformFee(priceDecimal)

    // 创建订单
    const order = await prisma.order.create({
      data: {
        orderNo,
        sellerId: payload.userId,
        vehicleBrand,
        vehicleModel,
        vehicleYear,
        vin,
        fsdVersion,
        price: priceDecimal,
        platformFee,
        status: 'PUBLISHED'
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            verified: true
          }
        }
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: order,
      message: '订单创建成功'
    })
  } catch (error) {
    console.error('创建订单错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
