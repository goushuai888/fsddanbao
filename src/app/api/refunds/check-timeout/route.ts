import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { ApiResponse } from '@/types'

/**
 * 退款超时检查和自动处理API
 *
 * 功能：
 * 1. 查找所有超时的退款申请
 * 2. 自动同意退款
 * 3. 创建退款记录并更新买家余额
 *
 * 调用方式：
 * - 定时任务（每10分钟执行一次）
 * - 管理员手动触发
 * - 用户查看订单时触发检查
 */
export async function POST(request: NextRequest) {
  try {
    // 验证权限（可以是管理员或系统调用）
    const authHeader = request.headers.get('authorization')
    const apiKey = request.headers.get('x-api-key')

    // 系统定时任务调用（使用API Key）
    const isSystemCall = apiKey === process.env.INTERNAL_API_KEY

    // 管理员手动调用（使用JWT token）
    let isAdminCall = false
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const payload = verifyToken(token)
      isAdminCall = payload?.role === 'ADMIN'
    }

    if (!isSystemCall && !isAdminCall) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权访问'
      }, { status: 403 })
    }

    // 查找所有待处理且已超时的退款申请
    const now = new Date()
    const timeoutOrders = await prisma.order.findMany({
      where: {
        refundRequested: true,
        refundStatus: 'PENDING',
        refundResponseDeadline: {
          lt: now  // 截止时间小于当前时间
        }
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            verified: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    console.warn(`⏰ 退款超时检查: 发现 ${timeoutOrders.length} 个超时订单`)

    const results = []

    // 批量处理超时订单
    for (const order of timeoutOrders) {
      try {
        // ✅ 使用事务保证原子性
        const result = await prisma.$transaction(async (tx) => {
          // 1. 更新订单状态
          const updated = await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'CANCELLED',
              refundStatus: 'APPROVED',
              refundApprovedAt: now,
              refundAutoApproved: true,  // ✅ 标记为自动同意
              cancelledAt: now
            }
          })

          // 2. 创建退款记录
          const refundAmount = order.escrowAmount || order.price
          await tx.payment.create({
            data: {
              orderId: order.id,
              userId: order.buyerId!,
              amount: refundAmount,
              type: 'REFUND',
              status: 'COMPLETED',
              note: '卖家超时未处理退款申请，系统自动退款'
            }
          })

          // 3. 更新买家余额
          await tx.user.update({
            where: { id: order.buyerId! },
            data: {
              balance: {
                increment: refundAmount
              }
            }
          })

          return updated
        })

        results.push({
          orderNo: order.orderNo,
          orderId: order.id,
          status: 'success',
          message: '自动退款成功'
        })

        console.warn(
          `✅ 订单 ${order.orderNo} 超时自动退款: ` +
          `卖家=${order.seller?.name}, ` +
          `买家=${order.buyer?.name}, ` +
          `金额=¥${order.escrowAmount || order.price}`
        )
      } catch (error) {
        console.error(`❌ 订单 ${order.orderNo} 自动退款失败:`, error)
        results.push({
          orderNo: order.orderNo,
          orderId: order.id,
          status: 'error',
          message: error instanceof Error ? error.message : '未知错误'
        })
      }
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        total: timeoutOrders.length,
        processed: results.length,
        results
      },
      message: `已处理 ${results.length} 个超时退款申请`
    })
  } catch (error) {
    console.error('检查退款超时错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}

/**
 * GET方法：查询即将超时的退款申请（用于提醒）
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '未授权'
      }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权访问'
      }, { status: 403 })
    }

    const now = new Date()

    // 查找即将在1小时内超时的退款申请
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)

    const soonTimeout = await prisma.order.findMany({
      where: {
        refundRequested: true,
        refundStatus: 'PENDING',
        refundResponseDeadline: {
          gte: now,
          lte: oneHourLater
        }
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        refundResponseDeadline: 'asc'
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: soonTimeout,
      message: `发现 ${soonTimeout.length} 个即将超时的退款申请`
    })
  } catch (error) {
    console.error('查询即将超时的退款申请错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
