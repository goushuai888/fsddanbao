import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { sensitiveLimiter, apiLimiter, checkRateLimit } from '@/lib/ratelimit'
import { orderActionSchema } from '@/lib/validations/order'
import { calculateRefundDeadline } from '@/lib/constants/refund-config'
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
        payments: {  // ✅ 包含支付记录
          include: {
            user: {
              select: {
                name: true,
                email: true
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        },
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
      where: { id: params.id },
      include: {
        seller: {
          select: {
            id: true,
            verified: true
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

    const body = await request.json()

    // 安全修复: 输入验证 - 使用Zod统一验证
    const validation = orderActionSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { action } = validation.data

    // 安全修复: 敏感操作限流 - 防止恶意操作（10次/小时）
    const sensitiveActions = ['cancel', 'request_refund', 'reject_refund', 'create_dispute']
    if (sensitiveActions.includes(action)) {
      const rateLimitResult = await checkRateLimit(
        sensitiveLimiter,
        `sensitive:${payload.userId}:${action}`
      )
      if (!rateLimitResult.success) {
        return rateLimitResult.response
      }
    } else {
      // 其他操作使用标准API限流（30次/分钟）
      const rateLimitResult = await checkRateLimit(
        apiLimiter,
        `api:${payload.userId}:order`
      )
      if (!rateLimitResult.success) {
        return rateLimitResult.response
      }
    }

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

        // ✅ 修复业务逻辑: 卖家不能购买自己的订单
        if (order.sellerId === payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '卖家不能购买自己的订单'
          }, { status: 403 })
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

        // ✅ 修复业务逻辑: 如果买家已申请退款，卖家必须先处理退款申请
        if (order.refundRequested && order.refundStatus === 'PENDING') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '买家已申请退款，请先处理退款申请（同意或拒绝），之后再提交转移凭证'
          }, { status: 400 })
        }

        // ✅ 并发保护: 使用乐观锁和状态检查
        try {
          const result = await prisma.order.updateMany({
            where: {
              id: params.id,
              status: 'PAID',
              version: order.version || 0
            },
            data: {
              status: 'TRANSFERRING',
              transferProof: body.transferProof,
              transferNote: body.transferNote,
              transferredAt: new Date(),
              version: {
                increment: 1
              }
            }
          })

          if (result.count === 0) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: '订单状态已变更，请刷新页面后重试'
            }, { status: 409 })
          }

          // 重新查询获取最新订单数据
          updatedOrder = await prisma.order.findUnique({
            where: { id: params.id }
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '提交转移凭证失败，请重试'
          }, { status: 500 })
        }
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

        // ✅ 安全修复: 使用事务+乐观锁保证数据一致性和并发安全
        try {
          updatedOrder = await prisma.$transaction(async (tx) => {
            // 1. 使用乐观锁更新订单状态为已完成
            const result = await tx.order.updateMany({
              where: {
                id: params.id,
                status: 'TRANSFERRING',
                version: order.version || 0
              },
              data: {
                status: 'COMPLETED',
                completedAt: new Date(),
                version: {
                  increment: 1
                }
              }
            })

            // 检查更新是否成功
            if (result.count === 0) {
              throw new Error('订单状态已变更，请刷新页面后重试')
            }

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

            // 5. 重新查询订单获取最新数据
            const completed = await tx.order.findUnique({
              where: { id: params.id }
            })

            return completed!
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: error instanceof Error ? error.message : '确认收货失败，请重试'
          }, { status: 409 })
        }
        break

      case 'cancel':
        // ✅ 修复业务逻辑错误: PAID状态完全禁止cancel操作（CVSS 9.1 严重漏洞）
        // 用户报告: "买家付款后，卖家仍能点击取消订单，取消成功了"
        // 正确流程: PAID状态下，买家申请退款 → 卖家同意/拒绝退款
        if (order.status === 'PAID') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '已付款订单不能直接取消。买家可以申请退款，卖家可以同意或拒绝退款申请。'
          }, { status: 400 })
        }

        // PUBLISHED状态：只有卖家可以取消（买家不能取消未付款订单）
        if (order.status === 'PUBLISHED') {
          if (order.sellerId !== payload.userId) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: '只有卖家可以取消未付款的订单'
            }, { status: 403 })
          }
        } else {
          // 其他状态（TRANSFERRING, COMPLETED, CANCELLED, DISPUTE）不允许取消
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '当前状态不允许取消'
          }, { status: 400 })
        }

        // ✅ 安全修复: 使用事务+乐观锁保证取消和退款的原子性和并发安全
        try {
          updatedOrder = await prisma.$transaction(async (tx) => {
            // 1. 使用乐观锁更新订单状态为已取消
            const result = await tx.order.updateMany({
              where: {
                id: params.id,
                status: order.status,  // 必须匹配当前状态
                version: order.version || 0
              },
              data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                version: {
                  increment: 1
                }
              }
            })

            // 检查更新是否成功
            if (result.count === 0) {
              throw new Error('订单状态已变更，请刷新页面后重试')
            }

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

            // 4. 重新查询订单获取最新数据
            const cancelled = await tx.order.findUnique({
              where: { id: params.id }
            })

            return cancelled!
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: error instanceof Error ? error.message : '取消订单失败，请重试'
          }, { status: 409 })
        }
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

        // ✅ 计算退款响应截止时间（根据卖家是否认证）
        const requestTime = new Date()
        const isVerifiedSeller = order.seller?.verified || false
        const deadline = calculateRefundDeadline(requestTime, isVerifiedSeller, false)

        // ✅ 并发保护: 使用乐观锁和状态检查
        try {
          const result = await prisma.order.updateMany({
            where: {
              id: params.id,
              status: 'PAID',
              refundRequested: false,
              version: order.version || 0
            },
            data: {
              refundRequested: true,
              refundReason: body.reason || '买家申请退款',
              refundRequestedAt: requestTime,
              refundStatus: 'PENDING',
              refundResponseDeadline: deadline,
              version: {
                increment: 1
              }
            }
          })

          if (result.count === 0) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: '订单状态已变更或已申请退款，请刷新页面'
            }, { status: 409 })
          }

          // 重新查询获取最新订单数据
          updatedOrder = await prisma.order.findUnique({
            where: { id: params.id }
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '申请退款失败，请重试'
          }, { status: 500 })
        }
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

        // ✅ 安全修复: 使用事务+乐观锁保证退款操作的原子性和并发安全
        try {
          updatedOrder = await prisma.$transaction(async (tx) => {
            // 1. 使用乐观锁更新订单状态
            const result = await tx.order.updateMany({
              where: {
                id: params.id,
                status: 'PAID',
                refundRequested: true,
                refundStatus: 'PENDING',
                version: order.version || 0
              },
              data: {
                status: 'CANCELLED',
                refundStatus: 'APPROVED',
                refundApprovedAt: new Date(),
                cancelledAt: new Date(),
                version: {
                  increment: 1
                }
              }
            })

            // 检查更新是否成功
            if (result.count === 0) {
              throw new Error('订单状态或退款申请已变更，请刷新页面后重试')
            }

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

            // 4. 重新查询订单获取最新数据
            const refunded = await tx.order.findUnique({
              where: { id: params.id }
            })

            return refunded!
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: error instanceof Error ? error.message : '同意退款失败，请重试'
          }, { status: 409 })
        }
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

        // 验证是否提供了拒绝理由
        if (!body.reason || body.reason.trim() === '') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '请填写拒绝退款的理由'
          }, { status: 400 })
        }

        // ✅ 并发保护: 使用乐观锁和退款状态检查
        try {
          const result = await prisma.order.updateMany({
            where: {
              id: params.id,
              refundRequested: true,
              refundStatus: 'PENDING',
              version: order.version || 0
            },
            data: {
              refundStatus: 'REJECTED',
              refundRejectedReason: body.reason,
              refundRejectedAt: new Date(),
              version: {
                increment: 1
              }
            }
          })

          if (result.count === 0) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: '退款申请状态已变更，请刷新页面'
            }, { status: 409 })
          }

          // 重新查询获取最新订单数据
          updatedOrder = await prisma.order.findUnique({
            where: { id: params.id }
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '拒绝退款失败，请重试'
          }, { status: 500 })
        }
        break

      case 'request_refund_extension':
        // 卖家申请退款处理延期
        if (order.sellerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有卖家可以申请延期'
          }, { status: 403 })
        }

        if (!order.refundRequested || order.refundStatus !== 'PENDING') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '没有待处理的退款申请'
          }, { status: 400 })
        }

        if (order.refundExtensionRequested) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '已经申请过延期，每个退款申请只能延期一次'
          }, { status: 400 })
        }

        // 验证是否提供了延期理由
        if (!body.reason || body.reason.trim() === '') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '请填写申请延期的理由'
          }, { status: 400 })
        }

        // 检查是否已经超时
        if (order.refundResponseDeadline && new Date() > order.refundResponseDeadline) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '退款申请已超时，无法申请延期'
          }, { status: 400 })
        }

        // ✅ 重新计算截止时间（增加24小时延期）
        const oldDeadline = order.refundResponseDeadline || order.refundRequestedAt || new Date()
        const isVerified = order.seller?.verified || false
        const newDeadline = calculateRefundDeadline(
          order.refundRequestedAt || new Date(),
          isVerified,
          true  // 已申请延期
        )

        // ✅ 并发保护: 使用乐观锁和状态检查
        try {
          const result = await prisma.order.updateMany({
            where: {
              id: params.id,
              refundRequested: true,
              refundStatus: 'PENDING',
              refundExtensionRequested: false,
              version: order.version || 0
            },
            data: {
              refundExtensionRequested: true,
              refundExtensionReason: body.reason,
              refundExtensionGrantedAt: new Date(),
              refundResponseDeadline: newDeadline,
              version: {
                increment: 1
              }
            }
          })

          if (result.count === 0) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: '退款申请状态已变更或已申请延期，请刷新页面'
            }, { status: 409 })
          }

          // 重新查询获取最新订单数据
          updatedOrder = await prisma.order.findUnique({
            where: { id: params.id }
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '申请延期失败，请重试'
          }, { status: 500 })
        }
        break

      case 'create_dispute':
        // 买家申诉
        // 1. TRANSFERRING状态：未收到货
        // 2. PAID状态：退款被拒绝
        if (order.status !== 'TRANSFERRING' && order.status !== 'PAID') {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有转移中或已支付的订单才能申诉'
          }, { status: 400 })
        }

        // PAID状态申诉必须是退款被拒绝的情况
        if (order.status === 'PAID') {
          if (!order.refundRequested || order.refundStatus !== 'REJECTED') {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: '只有退款被拒绝后才能申请平台介入'
            }, { status: 400 })
          }
        }

        if (order.buyerId !== payload.userId) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: '只有买家可以发起申诉'
          }, { status: 403 })
        }

        // 创建申诉记录
        const disputeReason = order.status === 'PAID'
          ? '退款申请被拒绝，申请平台介入'
          : body.reason || '未收到FSD权限'

        const disputeDesc = order.status === 'PAID'
          ? `买家申请退款被卖家拒绝。\n\n买家退款原因：${order.refundReason}\n\n卖家拒绝理由：${order.refundRejectedReason}\n\n买家诉求：${body.description || '要求平台介入，核实情况后退款'}`
          : body.description || '卖家已标记发货，但买家未收到FSD权限'

        // ✅ 并发保护: 使用事务+乐观锁确保申诉创建和状态更新的原子性
        try {
          updatedOrder = await prisma.$transaction(async (tx) => {
            // 1. 创建申诉记录
            await tx.dispute.create({
              data: {
                orderId: order.id,
                initiatorId: payload.userId,
                reason: disputeReason,
                description: disputeDesc,
                status: 'PENDING'
              }
            })

            // 2. 使用乐观锁更新订单状态为申诉中
            const result = await tx.order.updateMany({
              where: {
                id: params.id,
                status: order.status,  // 必须匹配当前状态
                version: order.version || 0
              },
              data: {
                status: 'DISPUTE',
                version: {
                  increment: 1
                }
              }
            })

            // 检查更新是否成功
            if (result.count === 0) {
              throw new Error('订单状态已变更，请刷新页面后重试')
            }

            // 3. 重新查询订单获取最新数据
            const disputed = await tx.order.findUnique({
              where: { id: params.id }
            })

            return disputed!
          })
        } catch (error) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: error instanceof Error ? error.message : '创建申诉失败，请重试'
          }, { status: 409 })
        }
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
