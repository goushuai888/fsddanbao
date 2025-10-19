/**
 * 拒绝退款用例
 *
 * 业务规则:
 * 1. 只有卖家可以拒绝退款
 * 2. 必须存在待处理的退款申请（refundStatus = PENDING）
 * 3. 必须提供拒绝理由（强制要求，提高透明度）
 * 4. 使用乐观锁防止并发冲突
 *
 * 状态转换: PAID → PAID (refundStatus: PENDING → REJECTED)
 * 副作用: 买家可在拒绝后申请平台介入
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import {
  InvalidOrderStateError,
  ForbiddenError,
  OptimisticLockError,
  OrderNotFoundError,
  ValidationError
} from '@/lib/domain/DomainErrors'
import type { Order } from '@prisma/client'

export interface RejectRefundInput {
  orderId: string
  userId: string
  reason: string  // 拒绝理由（必填）
}

export interface RejectRefundOutput {
  order: Order
}

export class RejectRefundUseCase {
  /**
   * 执行拒绝退款
   */
  async execute(input: RejectRefundInput): Promise<RejectRefundOutput> {
    const { orderId, userId, reason } = input

    // 1. 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { id: true } }
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

    // 4. 验证必须提供拒绝理由
    if (!reason || reason.trim() === '') {
      throw new ValidationError(
        '请填写拒绝退款的理由',
        'reason',
        reason
      )
    }

    // 5. 使用乐观锁执行拒绝退款
    try {
      const result = await prisma.order.updateMany({
        where: {
          id: orderId,
          refundRequested: true,
          refundStatus: 'PENDING',
          version: order.version || 0  // 版本号必须匹配
        },
        data: {
          refundStatus: 'REJECTED',
          refundRejectedReason: reason,
          refundRejectedAt: new Date(),
          version: {
            increment: 1  // 版本号+1
          }
        }
      })

      // 5.2 检查更新是否成功
      if (result.count === 0) {
        throw new OptimisticLockError('退款申请状态已变更，请刷新页面')
      }

      // 5.3 重新查询订单获取最新数据
      const updatedOrder = await prisma.order.findUnique({
        where: { id: orderId }
      })

      return { order: updatedOrder! }

    } catch (error) {
      // 如果是已知的业务错误，直接抛出
      if (error instanceof OptimisticLockError) {
        throw error
      }

      // 其他错误
      throw new OptimisticLockError('拒绝退款失败，请刷新页面后重试')
    }
  }
}
