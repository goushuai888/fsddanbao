/**
 * 创建申诉用例
 *
 * 业务规则:
 * 1. 只有买家可以发起申诉
 * 2. 允许在两种情况下申诉：
 *    - TRANSFERRING 状态：未收到FSD权限
 *    - PAID 状态：退款被拒绝后申请平台介入
 * 3. PAID 状态申诉必须是退款被拒绝的情况
 * 4. 使用事务保证：创建申诉记录 + 更新订单状态的原子性
 * 5. 使用乐观锁防止并发冲突
 *
 * 状态转换: TRANSFERRING/PAID → DISPUTE
 * 副作用: 创建 Dispute 记录
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

export interface CreateDisputeInput {
  orderId: string
  userId: string
  reason?: string       // 申诉原因（TRANSFERRING状态时使用，可选）
  description?: string  // 申诉详情（必填）
}

export interface CreateDisputeOutput {
  order: Order
}

export class CreateDisputeUseCase {
  /**
   * 执行创建申诉
   */
  async execute(input: CreateDisputeInput): Promise<CreateDisputeOutput> {
    const { orderId, userId, reason, description } = input

    // 1. 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true } }
      }
    })

    if (!order) {
      throw new OrderNotFoundError(orderId)
    }

    // 2. 验证订单状态：只允许 TRANSFERRING 或 PAID 状态申诉
    if (order.status !== 'TRANSFERRING' && order.status !== 'PAID') {
      throw new InvalidOrderStateError(
        '只有转移中或已支付的订单才能申诉',
        order.status,
        ['TRANSFERRING', 'PAID']
      )
    }

    // 3. PAID 状态申诉必须是退款被拒绝的情况
    if (order.status === 'PAID') {
      if (!order.refundRequested || order.refundStatus !== 'REJECTED') {
        throw new InvalidOrderStateError(
          '只有退款被拒绝后才能申请平台介入',
          order.refundStatus || 'NONE',
          'REJECTED'
        )
      }
    }

    // 4. 验证权限：只有买家可以发起申诉
    if (order.buyerId !== userId) {
      throw new ForbiddenError('只有买家可以发起申诉')
    }

    // 5. 构建申诉原因和描述
    const disputeReason = order.status === 'PAID'
      ? '退款申请被拒绝，申请平台介入'
      : reason || '未收到FSD权限'

    const disputeDesc = order.status === 'PAID'
      ? `买家申请退款被卖家拒绝。\n\n买家退款原因：${order.refundReason}\n\n卖家拒绝理由：${order.refundRejectedReason}\n\n买家诉求：${description || '要求平台介入，核实情况后退款'}`
      : description || '卖家已标记发货，但买家未收到FSD权限'

    // 6. 使用事务执行创建申诉（原子操作）
    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 6.1 创建申诉记录
        await tx.dispute.create({
          data: {
            orderId: order.id,
            initiatorId: userId,
            reason: disputeReason,
            description: disputeDesc,
            status: 'PENDING'
          }
        })

        // 6.2 使用乐观锁更新订单状态为申诉中
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            status: order.status,  // 必须匹配当前状态
            version: order.version || 0  // 版本号必须匹配
          },
          data: {
            status: 'DISPUTE',
            version: {
              increment: 1  // 版本号+1
            }
          }
        })

        // 6.3 检查更新是否成功
        if (result.count === 0) {
          throw new OptimisticLockError('订单状态已变更，请刷新页面后重试')
        }

        // 6.4 重新查询订单获取最新数据
        const disputed = await tx.order.findUnique({
          where: { id: orderId }
        })

        return disputed!
      })

      return { order: updatedOrder }

    } catch (error) {
      // 如果是已知的业务错误，直接抛出
      if (error instanceof OptimisticLockError) {
        throw error
      }

      // 事务失败（可能是创建申诉记录失败等）
      if (error instanceof Error) {
        throw new InternalServerError(error.message, error)
      }

      throw new InternalServerError('创建申诉失败，请重试')
    }
  }
}
