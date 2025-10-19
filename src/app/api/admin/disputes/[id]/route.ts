/**
 * 管理员申诉处理API（使用统一认证中间件）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { adminOnly } from '@/lib/infrastructure/middleware/auth'
import { logAudit, AUDIT_ACTIONS } from '@/lib/infrastructure/audit/audit-logger'
import { ApiResponse } from '@/types'

/**
 * PATCH /api/admin/disputes/[id] - 处理申诉
 *
 * 认证要求: 管理员权限
 * 操作类型:
 * - approve: 同意申诉（退款给买家）
 * - reject: 拒绝申诉（释放款项给卖家）
 */
export const PATCH = adminOnly(async (request, { params }, auth) => {
  try {
    const body = await request.json()
    const { action, resolution } = body

    const dispute = await prisma.dispute.findUnique({
      where: { id: params.id },
      include: {
        order: true
      }
    })

    if (!dispute) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '申诉不存在'
      }, { status: 404 })
    }

    if (dispute.status !== 'PENDING') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该申诉已处理'
      }, { status: 400 })
    }

    let updatedDispute
    let updatedOrder

    // ✅ 修复Bug: 使用事务保证资金流转的原子性
    if (action === 'approve') {
      // 同意申诉 - 退款给买家
      const result = await prisma.$transaction(async (tx) => {
        // 1. 更新申诉状态
        const updatedDispute = await tx.dispute.update({
          where: { id: params.id },
          data: {
            status: 'RESOLVED',
            resolution: resolution || '管理员同意申诉，订单已取消并退款给买家',
            resolvedBy: auth.userId,
            resolvedAt: new Date()
          }
        })

        // 2. 更新订单状态为已取消
        const updatedOrder = await tx.order.update({
          where: { id: dispute.orderId },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        })

        // 3. 退款给买家（创建退款记录 + 更新买家余额）
        if (dispute.order.buyerId) {
          const refundAmount = dispute.order.escrowAmount || dispute.order.price

          await tx.payment.create({
            data: {
              orderId: dispute.order.id,
              userId: dispute.order.buyerId,
              amount: refundAmount,
              type: 'REFUND',
              status: 'COMPLETED',
              note: '申诉处理-退款给买家'
            }
          })

          // ✅ 修复: 更新买家余额
          await tx.user.update({
            where: { id: dispute.order.buyerId },
            data: {
              balance: {
                increment: refundAmount
              }
            }
          })
        }

        return { dispute: updatedDispute, order: updatedOrder }
      })

      updatedDispute = result.dispute
      updatedOrder = result.order

      // 记录审计日志
      await logAudit({
        userId: auth.userId,
        action: AUDIT_ACTIONS.RESOLVE_DISPUTE,
        target: params.id,
        targetType: 'Dispute',
        oldValue: {
          disputeStatus: 'PENDING',
          orderStatus: dispute.order.status
        },
        newValue: {
          disputeStatus: 'RESOLVED',
          orderStatus: 'CANCELLED',
          resolution,
          refundAmount: dispute.order.escrowAmount || dispute.order.price
        },
        description: `同意申诉并退款给买家`,
        req: request
      })
    } else if (action === 'reject') {
      // 拒绝申诉 - 款项释放给卖家，订单完成
      const result = await prisma.$transaction(async (tx) => {
        // 1. 更新申诉状态
        const updatedDispute = await tx.dispute.update({
          where: { id: params.id },
          data: {
            status: 'CLOSED',
            resolution: resolution || '管理员拒绝申诉，认定交易正常完成',
            resolvedBy: auth.userId,
            resolvedAt: new Date()
          }
        })

        // 2. 更新订单状态为已完成
        const updatedOrder = await tx.order.update({
          where: { id: dispute.orderId },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        })

        // 3. 释放款项给卖家（创建释放记录 + 更新卖家余额）
        const releaseAmount = Number(dispute.order.price) - (Number(dispute.order.platformFee) || 0)

        await tx.payment.create({
          data: {
            orderId: dispute.order.id,
            userId: dispute.order.sellerId,
            amount: releaseAmount,
            type: 'RELEASE',
            status: 'COMPLETED',
            note: '申诉被拒-释放款项给卖家'
          }
        })

        // ✅ 修复: 更新卖家余额
        await tx.user.update({
          where: { id: dispute.order.sellerId },
          data: {
            balance: {
              increment: releaseAmount
            }
          }
        })

        return { dispute: updatedDispute, order: updatedOrder }
      })

      updatedDispute = result.dispute
      updatedOrder = result.order

      // 记录审计日志
      await logAudit({
        userId: auth.userId,
        action: AUDIT_ACTIONS.CLOSE_DISPUTE,
        target: params.id,
        targetType: 'Dispute',
        oldValue: {
          disputeStatus: 'PENDING',
          orderStatus: dispute.order.status
        },
        newValue: {
          disputeStatus: 'CLOSED',
          orderStatus: 'COMPLETED',
          resolution,
          releaseAmount: Number(dispute.order.price) - (Number(dispute.order.platformFee) || 0)
        },
        description: `拒绝申诉并释放款项给卖家`,
        req: request
      })
    } else {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的操作'
      }, { status: 400 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { dispute: updatedDispute, order: updatedOrder },
      message: action === 'approve' ? '已同意申诉并退款' : '已拒绝申诉并完成订单'
    })
  } catch (error) {
    console.error('处理申诉错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
})
