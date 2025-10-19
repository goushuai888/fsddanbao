/**
 * 申请退款延期用例
 *
 * 业务规则:
 * 1. 只有卖家可以申请延期
 * 2. 必须存在待处理的退款申请（refundStatus = PENDING）
 * 3. 每个退款申请只能延期一次
 * 4. 必须提供延期理由
 * 5. 不能在已超时后申请延期
 * 6. 延期时长为 24 小时
 * 7. 使用乐观锁防止并发冲突
 *
 * 状态转换: PAID → PAID (refundExtensionRequested: false → true)
 * 副作用: 延长 refundResponseDeadline
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import {
  InvalidOrderStateError,
  ForbiddenError,
  OptimisticLockError,
  OrderNotFoundError,
  ValidationError,
  RefundTimeoutError
} from '@/lib/domain/DomainErrors'
import { calculateRefundDeadline } from '@/lib/domain/policies/refund-config'
import type { Order } from '@prisma/client'

export interface RequestRefundExtensionInput {
  orderId: string
  userId: string
  reason: string  // 延期理由（必填）
}

export interface RequestRefundExtensionOutput {
  order: Order
}

export class RequestRefundExtensionUseCase {
  /**
   * 执行申请退款延期
   */
  async execute(input: RequestRefundExtensionInput): Promise<RequestRefundExtensionOutput> {
    const { orderId, userId, reason } = input

    // 1. 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        seller: { select: { id: true, verified: true } }
      }
    })

    if (!order) {
      throw new OrderNotFoundError(orderId)
    }

    // 2. 验证权限：只有卖家可以申请延期
    if (order.sellerId !== userId) {
      throw new ForbiddenError('只有卖家可以申请延期')
    }

    // 3. 验证退款申请状态
    if (!order.refundRequested || order.refundStatus !== 'PENDING') {
      throw new InvalidOrderStateError(
        '没有待处理的退款申请',
        order.refundStatus || 'NONE',
        'PENDING'
      )
    }

    // 4. 验证不能重复申请延期
    if (order.refundExtensionRequested) {
      throw new InvalidOrderStateError(
        '已经申请过延期，每个退款申请只能延期一次',
        'EXTENSION_REQUESTED',
        'NO_EXTENSION'
      )
    }

    // 5. 验证必须提供延期理由
    if (!reason || reason.trim() === '') {
      throw new ValidationError(
        '请填写申请延期的理由',
        'reason',
        reason
      )
    }

    // 6. 检查是否已经超时
    if (order.refundResponseDeadline && new Date() > order.refundResponseDeadline) {
      throw new RefundTimeoutError(order.refundResponseDeadline)
    }

    // 7. 重新计算截止时间（增加24小时延期）
    const isVerified = order.seller?.verified || false
    const newDeadline = calculateRefundDeadline(
      order.refundRequestedAt || new Date(),
      isVerified,
      true  // 已申请延期
    )

    // 8. 使用乐观锁执行申请延期
    try {
      const result = await prisma.order.updateMany({
        where: {
          id: orderId,
          refundRequested: true,
          refundStatus: 'PENDING',
          refundExtensionRequested: false,
          version: order.version || 0  // 版本号必须匹配
        },
        data: {
          refundExtensionRequested: true,
          refundExtensionReason: reason,
          refundExtensionGrantedAt: new Date(),
          refundResponseDeadline: newDeadline,
          version: {
            increment: 1  // 版本号+1
          }
        }
      })

      // 8.2 检查更新是否成功
      if (result.count === 0) {
        throw new OptimisticLockError('退款申请状态已变更或已申请延期，请刷新页面')
      }

      // 8.3 重新查询订单获取最新数据
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
      throw new OptimisticLockError('申请延期失败，请刷新页面后重试')
    }
  }
}
