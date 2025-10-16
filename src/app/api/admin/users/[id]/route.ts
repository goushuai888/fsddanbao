import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// 获取用户详情（仅管理员）
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // 检查是否为管理员
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权访问'
      }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
        sellOrders: {
          where: {
            status: 'COMPLETED'
          },
          select: {
            id: true,
            orderNo: true,
            status: true,
            price: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        buyOrders: {
          where: {
            status: 'COMPLETED'
          },
          select: {
            id: true,
            orderNo: true,
            status: true,
            price: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        _count: {
          select: {
            sellOrders: {
              where: {
                status: 'COMPLETED'
              }
            },
            buyOrders: {
              where: {
                status: 'COMPLETED'
              }
            },
            payments: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user
    })
  } catch (error) {
    console.error('获取用户详情错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}

// 更新用户信息（仅管理员）
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // 检查是否为管理员
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权访问'
      }, { status: 403 })
    }

    const body = await request.json()
    const { name, phone, role, verified, balance } = body

    // 构建更新数据
    const updateData: any = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (role !== undefined) updateData.role = role
    if (verified !== undefined) updateData.verified = verified
    if (balance !== undefined) updateData.balance = balance

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user,
      message: '用户信息更新成功'
    })
  } catch (error) {
    console.error('更新用户信息错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}

// 删除用户（仅管理员）
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    // 检查是否为管理员
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权访问'
      }, { status: 403 })
    }

    // 检查用户是否有进行中的订单
    const activeOrders = await prisma.order.count({
      where: {
        OR: [
          { sellerId: params.id },
          { buyerId: params.id }
        ],
        status: {
          in: ['PUBLISHED', 'PAID', 'TRANSFERRING', 'CONFIRMING']
        }
      }
    })

    if (activeOrders > 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该用户有进行中的订单，无法删除'
      }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: params.id }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '用户删除成功'
    })
  } catch (error) {
    console.error('删除用户错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
