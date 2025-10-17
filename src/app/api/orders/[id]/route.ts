import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// 获取订单详情
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

    const order = await prisma.order.findUnique({
      where: { id: params.id },
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            verified: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            verified: true
          }
        },
        payments: true,
        reviews: true,
        disputes: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    })

    if (!order) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '订单不存在'
      }, { status: 404 })
    }

    // 检查权限
    // 管理员可以查看所有订单
    if (payload.role === 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: order
      })
    }

    // 卖家可以查看自己的所有订单（包括已取消的）
    if (order.sellerId === payload.userId) {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: order
      })
    }

    // 买家权限检查
    if (order.buyerId === payload.userId) {
      // 如果订单已取消且买家没有参与过交易（没有付款记录），则不能查看
      if (order.status === 'CANCELLED' && !order.paidAt) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '此订单已被卖家取消'
        }, { status: 403 })
      }
      return NextResponse.json<ApiResponse>({
        success: true,
        data: order
      })
    }

    // PUBLISHED状态的订单，所有登录用户都可以查看（用于浏览和购买）
    if (order.status === 'PUBLISHED') {
      return NextResponse.json<ApiResponse>({
        success: true,
        data: order
      })
    }

    // 其他情况无权查看
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '无权查看此订单'
    }, { status: 403 })
  } catch (error) {
    console.error('获取订单详情错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}

// 更新订单
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

    const order = await prisma.order.findUnique({
      where: { id: params.id }
    })

    if (!order) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '订单不存在'
      }, { status: 404 })
    }

    const body = await request.json()
    const { action } = body

    let updatedOrder

    switch (action) {
      case 'pay':
        // 买家支付
        if (order.status !== 'PUBLISHED') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '订单状态不允许支付'
          }, { status: 400 })
        }

        // ✅ 安全修复: 使用事务和乐观锁防止竞态条件
        try {
          updatedOrder = await prisma.$transaction(async (tx) => {
            // 1. 使用updateMany和版本号实现乐观锁
            const result = await tx.order.updateMany({
              where: {
                id: params.id,
                status: 'PUBLISHED',
                version: order.version || 0  // 版本号必须匹配
              },
              data: {
                buyerId: payload.userId,
                status: 'PAID',
                paidAt: new Date(),
                escrowAmount: order.price,
                version: {
                  increment: 1  // 版本号+1
                }
              }
            })

            // 2. 检查更新是否成功
            if (result.count === 0) {
              throw new Error('订单已被其他买家购买或状态已变更')
            }

            // 3. 创建托管支付记录
            await tx.payment.create({
              data: {
                orderId: order.id,
                userId: payload.userId,
                amount: order.price,
                type: 'ESCROW',
                status: 'COMPLETED',
                note: '买家支付到平台托管'
              }
            })

            // 4. 重新查询订单获取最新数据
            const updated = await tx.order.findUnique({
              where: { id: params.id }
            })

            return updated!
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: error instanceof Error ? error.message : '支付失败,请重试'
          }, { status: 409 })
        }
        break

      case 'transfer':
        // 卖家提交转移凭证
        if (order.status !== 'PAID') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '订单状态不正确'
          }, { status: 400 })
        }

        if (order.sellerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '无权操作'
          }, { status: 403 })
        }

        updatedOrder = await prisma.order.update({
          where: { id: params.id },
          data: {
            status: 'TRANSFERRING',
            transferProof: body.transferProof,
            transferNote: body.transferNote,
            transferredAt: new Date()
          }
        })
        break

      case 'confirm':
        // 买家确认收货
        if (order.status !== 'TRANSFERRING') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '订单状态不正确'
          }, { status: 400 })
        }

        if (order.buyerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '无权操作'
          }, { status: 403 })
        }

        // ✅ 安全修复: 使用事务保证数据一致性
        updatedOrder = await prisma.$transaction(async (tx) => {
          // 1. 更新订单状态为已完成
          const completed = await tx.order.update({
            where: { id: params.id },
            data: {
              status: 'COMPLETED',
              completedAt: new Date()
            }
          })

          // 2. 计算卖家应得金额(扣除平台手续费)
          const releaseAmount = order.price - (order.platformFee || 0)

          // 3. 创建释放款项记录
          await tx.payment.create({
            data: {
              orderId: order.id,
              userId: order.sellerId,
              amount: releaseAmount,
              type: 'RELEASE',
              status: 'COMPLETED',
              note: '订单完成,释放款项给卖家'
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

          return completed
        })
        break

      case 'cancel':
        // 取消订单 - 权限检查
        if (!['PUBLISHED', 'PAID'].includes(order.status)) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '当前状态不允许取消'
          }, { status: 400 })
        }

        // PUBLISHED状态：卖家和买家都可以取消
        if (order.status === 'PUBLISHED') {
          const isSeller = order.sellerId === payload.userId
          const isBuyer = order.buyerId === payload.userId

          if (!isSeller && !isBuyer) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: '无权取消此订单'
            }, { status: 403 })
          }
        }

        // PAID状态：只有卖家可以取消
        if (order.status === 'PAID' && order.sellerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '已付款订单只有卖家可以取消'
          }, { status: 403 })
        }

        // ✅ 安全修复: 使用事务保证取消和退款的原子性
        updatedOrder = await prisma.$transaction(async (tx) => {
          // 1. 更新订单状态为已取消
          const cancelled = await tx.order.update({
            where: { id: params.id },
            data: {
              status: 'CANCELLED',
              cancelledAt: new Date()
            }
          })

          // 2. 如果已支付,创建退款记录并更新买家余额
          if (order.status === 'PAID' && order.buyerId) {
            const refundAmount = order.escrowAmount || order.price

            await tx.payment.create({
              data: {
                orderId: order.id,
                userId: order.buyerId,
                amount: refundAmount,
                type: 'REFUND',
                status: 'COMPLETED',
                note: '订单取消,退款给买家'
              }
            })

            // 3. 更新买家余额
            await tx.user.update({
              where: { id: order.buyerId },
              data: {
                balance: {
                  increment: refundAmount
                }
              }
            })
          }

          return cancelled
        })
        break

      case 'request_refund':
        // 买家申请退款（只能在PAID状态）
        if (order.status !== 'PAID') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有已支付的订单才能申请退款'
          }, { status: 400 })
        }

        if (order.buyerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有买家可以申请退款'
          }, { status: 403 })
        }

        if (order.refundRequested) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '已经提交过退款申请'
          }, { status: 400 })
        }

        updatedOrder = await prisma.order.update({
          where: { id: params.id },
          data: {
            refundRequested: true,
            refundReason: body.reason || '买家申请退款',
            refundRequestedAt: new Date(),
            refundStatus: 'PENDING'
          }
        })
        break

      case 'approve_refund':
        // 卖家同意退款
        if (order.sellerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有卖家可以处理退款申请'
          }, { status: 403 })
        }

        if (!order.refundRequested || order.refundStatus !== 'PENDING') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '没有待处理的退款申请'
          }, { status: 400 })
        }

        // ✅ 安全修复: 使用事务保证退款操作的原子性
        updatedOrder = await prisma.$transaction(async (tx) => {
          // 1. 更新订单状态
          const refunded = await tx.order.update({
            where: { id: params.id },
            data: {
              status: 'CANCELLED',
              refundStatus: 'APPROVED',
              cancelledAt: new Date()
            }
          })

          // 2. 创建退款记录并更新买家余额
          if (order.buyerId) {
            const refundAmount = order.escrowAmount || order.price

            await tx.payment.create({
              data: {
                orderId: order.id,
                userId: order.buyerId,
                amount: refundAmount,
                type: 'REFUND',
                status: 'COMPLETED',
                note: '卖家同意退款申请'
              }
            })

            // 3. 更新买家余额
            await tx.user.update({
              where: { id: order.buyerId },
              data: {
                balance: {
                  increment: refundAmount
                }
              }
            })
          }

          return refunded
        })
        break

      case 'reject_refund':
        // 卖家拒绝退款
        if (order.sellerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有卖家可以处理退款申请'
          }, { status: 403 })
        }

        if (!order.refundRequested || order.refundStatus !== 'PENDING') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '没有待处理的退款申请'
          }, { status: 400 })
        }

        updatedOrder = await prisma.order.update({
          where: { id: params.id },
          data: {
            refundStatus: 'REJECTED'
          }
        })
        break

      case 'create_dispute':
        // 买家申诉（TRANSFERRING状态未收到货）
        if (order.status !== 'TRANSFERRING') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有转移中的订单才能申诉'
          }, { status: 400 })
        }

        if (order.buyerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有买家可以发起申诉'
          }, { status: 403 })
        }

        // 创建申诉记录
        await prisma.dispute.create({
          data: {
            orderId: order.id,
            initiatorId: payload.userId,
            reason: body.reason || '未收到FSD权限',
            description: body.description || '卖家已标记发货，但买家未收到FSD权限',
            status: 'PENDING'
          }
        })

        // 更新订单状态为申诉中
        updatedOrder = await prisma.order.update({
          where: { id: params.id },
          data: {
            status: 'DISPUTE'
          }
        })
        break

      default:
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '无效的操作'
        }, { status: 400 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedOrder,
      message: '操作成功'
    })
  } catch (error) {
    console.error('更新订单错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
