import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { ApiResponse } from '@/types'

/**
 * 自动确认超时订单API
 * POST /api/orders/auto-confirm
 *
 * 功能：
 * 1. 检查所有TRANSFERRING状态且超过确认期限的订单
 * 2. 自动确认收货并释放款项给卖家
 * 3. 标记autoConfirmed=true
 *
 * 调用方式：
 * - 手动调用（需要管理员权限）
 * - 通过cron job定时调用（推荐每小时执行一次）
 * - 前端倒计时结束后调用（作为补充）
 */
export async function POST(request: NextRequest) {
  try {
    // 认证检查（只允许管理员调用）
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

    // 只允许管理员调用此API
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权限操作'
      }, { status: 403 })
    }

    // 查找所有超时未确认的订单
    const now = new Date()
    const overdueOrders = await prisma.order.findMany({
      where: {
        status: 'TRANSFERRING',
        confirmDeadline: {
          lte: now  // 确认截止时间小于等于当前时间
        },
        autoConfirmed: false  // 尚未自动确认
      },
      include: {
        seller: {
          select: {
            id: true,
            name: true
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

    if (overdueOrders.length === 0) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: {
          message: '没有需要自动确认的订单',
          count: 0
        }
      })
    }

    // 批量自动确认订单
    const results = []
    for (const order of overdueOrders) {
      try {
        // 使用事务处理自动确认
        await prisma.$transaction(async (tx) => {
          // 1. 更新订单状态为已完成
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'COMPLETED',
              completedAt: now,
              autoConfirmed: true,  // 标记为自动确认
              version: {
                increment: 1
              }
            }
          })

          // 2. 计算卖家应得金额（扣除平台手续费）
          const releaseAmount = Number(order.price) - Number(order.platformFee || 0)

          // 3. 创建释放款项记录
          await tx.payment.create({
            data: {
              orderId: order.id,
              userId: order.sellerId,
              amount: releaseAmount,
              type: 'RELEASE',
              status: 'COMPLETED',
              note: '订单超时自动确认，释放款项给卖家'
            }
          })

          // 4. 更新卖家余额
          await tx.user.update({
            where: { id: order.sellerId },
            data: {
              balance: {
                increment: releaseAmount
              }
            }
          })
        })

        results.push({
          orderId: order.id,
          orderNo: order.orderNo,
          success: true,
          message: '自动确认成功'
        })
      } catch (error) {
        console.error(`自动确认订单 ${order.orderNo} 失败:`, error)
        results.push({
          orderId: order.id,
          orderNo: order.orderNo,
          success: false,
          message: error instanceof Error ? error.message : '未知错误'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: `自动确认完成：成功 ${successCount} 个，失败 ${failCount} 个`,
        total: overdueOrders.length,
        successCount,
        failCount,
        details: results
      }
    })
  } catch (error) {
    console.error('自动确认API错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
