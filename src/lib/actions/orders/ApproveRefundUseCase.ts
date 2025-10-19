/**
 * 同意退款用例
 *
 * 业务规则:
 * 1. 只有卖家可以同意退款
 * 2. 必须存在待处理的退款申请（refundStatus = PENDING）
 * 3. 使用事务保证原子性：订单取消 + 退款记录 + 买家余额更新
 * 4. 使用乐观锁防止并发冲突
 *
 * 状态转换: PAID → CANCELLED
 * 副作用: 退款给买家
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import {
  InvalidOrderStateError,
  ForbiddenError,
  OptimisticLockError,
  OrderNotFoundError,
  InternalServerError
} from '@/lib/domain/DomainErrors'
import type { Order } from '@prisma/client'

export interface ApproveRefundInput {
  orderId: string
  userId: string
}

export interface ApproveRefundOutput {
  order: Order
}

export class ApproveRefundUseCase {
  /**
   * 执行同意退款
   */
  async execute(input: ApproveRefundInput): Promise<ApproveRefundOutput> {
    const { orderId, userId } = input

    // 1. 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { id: true } },
        buyer: { select: { id: true } }
      }
    })

    if (!order) {
      throw new OrderNotFoundError(orderId)
    }

    // 2. 验证权限：只有卖家可以处理退款申请
    if (order.sellerId !== userId) {
      throw new ForbiddenError('只有卖家可以处理退款申请')
    }

    // 3. 验证退款申请状态
    if (!order.refundRequested || order.refundStatus !== 'PENDING') {
      throw new InvalidOrderStateError(
        '没有待处理的退款申请',
        order.refundStatus || 'NONE',
        'PENDING'
      )
    }

    // 4. 使用事务执行退款（原子操作）
    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 4.1 使用乐观锁更新订单状态
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            status: 'PAID',
            refundRequested: true,
            refundStatus: 'PENDING',
            version: order.version || 0  // 版本号必须匹配
          },
          data: {
            status: 'CANCELLED',
            refundStatus: 'APPROVED',
            refundApprovedAt: new Date(),
            cancelledAt: new Date(),
            version: {
              increment: 1  // 版本号+1
            }
          }
        })

        // 4.2 检查更新是否成功
        if (result.count === 0) {
          throw new OptimisticLockError('订单状态或退款申请已变更，请刷新页面后重试')
        }

        // 4.3 创建退款记录并更新买家余额
        if (order.buyerId) {
          const refundAmount = order.escrowAmount || order.price

          // 4.3.1 创建退款记录
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

          // 4.3.2 更新买家余额
          await tx.user.update({
            where: { id: order.buyerId },
            data: {
              balance: {
                increment: refundAmount
              }
            }
          })
        }

        // 4.4 重新查询订单获取最新数据
        const refunded = await tx.order.findUnique({
          where: { id: orderId }
        })

        return refunded!
      })

      return { order: updatedOrder }

    } catch (error) {
      // 如果是已知的业务错误，直接抛出
      if (error instanceof OptimisticLockError) {
        throw error
      }

      // 事务失败（可能是余额更新失败等）
      if (error instanceof Error) {
        throw new InternalServerError(error.message, error)
      }

      throw new InternalServerError('同意退款失败，请重试')
    }
  }
}
