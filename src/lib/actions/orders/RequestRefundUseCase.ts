/**
 * 申请退款用例
 *
 * 业务规则:
 * 1. 只能在 PAID 状态申请退款
 * 2. 只有买家可以申请退款
 * 3. 不能重复申请退款
 * 4. 自动计算卖家响应截止时间（认证卖家24小时，普通卖家48小时）
 * 5. 使用乐观锁防止并发冲突
 *
 * 状态转换: PAID → PAID (refundRequested = true, refundStatus = PENDING)
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import {
  InvalidOrderStateError,
  ForbiddenError,
  OptimisticLockError,
  OrderNotFoundError,
  RefundAlreadyRequestedError
} from '@/lib/domain/DomainErrors'
import { calculateRefundDeadline } from '@/lib/domain/policies/refund-config'
import type { Order } from '@prisma/client'

export interface RequestRefundInput {
  orderId: string
  userId: string
  reason?: string  // 退款原因（可选，默认为"买家申请退款"）
}

export interface RequestRefundOutput {
  order: Order
}

export class RequestRefundUseCase {
  /**
   * 执行申请退款
   */
  async execute(input: RequestRefundInput): Promise<RequestRefundOutput> {
    const { orderId, userId, reason } = input

    // 1. 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true } },
        seller: { select: { id: true, verified: true } }
      }
    })

    if (!order) {
      throw new OrderNotFoundError(orderId)
    }

    // 2. 验证订单状态：只能在PAID状态申请退款
    if (order.status !== 'PAID') {
      throw new InvalidOrderStateError(
        '只有已支付的订单才能申请退款',
        order.status,
        'PAID'
      )
    }

    // 3. 验证权限：只有买家可以申请退款
    if (order.buyerId !== userId) {
      throw new ForbiddenError('只有买家可以申请退款')
    }

    // 4. 验证不能重复申请
    if (order.refundRequested) {
      throw new RefundAlreadyRequestedError()
    }

    // 5. 计算退款响应截止时间（根据卖家是否认证）
    const requestTime = new Date()
    const isVerifiedSeller = order.seller?.verified || false
    const deadline = calculateRefundDeadline(requestTime, isVerifiedSeller, false)

    // 6. 使用乐观锁执行申请退款
    try {
      const result = await prisma.order.updateMany({
        where: {
          id: orderId,
          status: 'PAID',
          refundRequested: false,
          version: order.version || 0  // 版本号必须匹配
        },
        data: {
          refundRequested: true,
          refundReason: reason || '买家申请退款',
          refundRequestedAt: requestTime,
          refundStatus: 'PENDING',
          refundResponseDeadline: deadline,
          version: {
            increment: 1  // 版本号+1
          }
        }
      })

      // 6.2 检查更新是否成功
      if (result.count === 0) {
        throw new OptimisticLockError('订单状态已变更或已申请退款，请刷新页面')
      }

      // 6.3 重新查询订单获取最新数据
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
      throw new OptimisticLockError('申请退款失败，请刷新页面后重试')
    }
  }
}
