/**
 * 提交转移凭证用例
 *
 * 业务规则:
 * 1. 订单状态必须是 PAID
 * 2. 只有卖家可以提交转移凭证
 * 3. 如果买家已申请退款，必须先处理退款
 * 4. 自动计算确认截止时间（认证卖家3天，普通卖家7天）
 * 5. 使用乐观锁防止并发冲突
 *
 * 状态转换: PAID → TRANSFERRING
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import {
  InvalidOrderStateError,
  ForbiddenError,
  OptimisticLockError,
  OrderNotFoundError
} from '@/lib/domain/DomainErrors'
import { calculateConfirmDeadline } from '@/lib/domain/policies/confirm-config'
import type { Order } from '@prisma/client'

export interface TransferOrderInput {
  orderId: string
  userId: string
  transferProof: string
  transferNote: string
}

export interface TransferOrderOutput {
  order: Order
}

export class TransferOrderUseCase {
  /**
   * 执行提交转移凭证
   */
  async execute(input: TransferOrderInput): Promise<TransferOrderOutput> {
    const { orderId, userId, transferProof, transferNote } = input

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

    // 2. 验证订单状态
    if (order.status !== 'PAID') {
      throw new InvalidOrderStateError(
        '订单状态不正确',
        order.status,
        'PAID'
      )
    }

    // 3. 验证权限：只有卖家可以提交转移凭证
    if (order.sellerId !== userId) {
      throw new ForbiddenError('无权操作')
    }

    // 4. 验证退款状态：如果买家已申请退款，必须先处理
    if (order.refundRequested && order.refundStatus === 'PENDING') {
      throw new InvalidOrderStateError(
        '买家已申请退款，请先处理退款申请（同意或拒绝），之后再提交转移凭证',
        order.status,
        'PAID'
      )
    }

    // 5. 计算确认截止时间
    const transferTime = new Date()
    const isVerifiedSeller = order.seller?.verified || false
    const confirmDeadline = calculateConfirmDeadline(transferTime, isVerifiedSeller)

    // 6. 使用乐观锁更新订单状态
    try {
      const result = await prisma.order.updateMany({
        where: {
          id: orderId,
          status: 'PAID',
          version: order.version || 0  // 版本号必须匹配
        },
        data: {
          status: 'TRANSFERRING',
          transferProof,
          transferNote,
          transferredAt: transferTime,
          confirmDeadline,  // 设置确认截止时间
          version: {
            increment: 1  // 版本号+1
          }
        }
      })

      // 6.2 检查更新是否成功
      if (result.count === 0) {
        throw new OptimisticLockError('订单状态已变更，请刷新页面后重试')
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
      throw new OptimisticLockError('提交转移凭证失败，请刷新页面后重试')
    }
  }
}
