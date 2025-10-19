/**
 * 取消订单用例
 *
 * 业务规则:
 * 1. 只允许在 PUBLISHED 状态下取消
 * 2. PAID 状态完全禁止取消（买家需通过退款流程）
 * 3. 只有卖家可以取消 PUBLISHED 状态的订单
 * 4. 使用乐观锁防止并发冲突
 *
 * 状态转换: PUBLISHED → CANCELLED
 * 副作用: 无（PUBLISHED 状态未支付）
 *
 * 安全修复说明:
 * - 修复了 CVSS 9.1 严重漏洞：防止卖家在买家付款后取消订单
 * - 正确流程：PAID 状态下，买家申请退款 → 卖家同意/拒绝退款
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

export interface CancelOrderInput {
  orderId: string
  userId: string
}

export interface CancelOrderOutput {
  order: Order
}

export class CancelOrderUseCase {
  /**
   * 执行取消订单
   */
  async execute(input: CancelOrderInput): Promise<CancelOrderOutput> {
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

    // 2. 验证订单状态：禁止PAID状态取消
    if (order.status === 'PAID') {
      throw new InvalidOrderStateError(
        '已付款订单不能直接取消。买家可以申请退款，卖家可以同意或拒绝退款申请。',
        order.status,
        'PUBLISHED'
      )
    }

    // 3. 验证订单状态：只允许PUBLISHED状态取消
    if (order.status !== 'PUBLISHED') {
      throw new InvalidOrderStateError(
        '当前状态不允许取消',
        order.status,
        'PUBLISHED'
      )
    }

    // 4. 验证权限：只有卖家可以取消未付款的订单
    if (order.sellerId !== userId) {
      throw new ForbiddenError('只有卖家可以取消未付款的订单')
    }

    // 5. 使用事务和乐观锁执行取消
    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 5.1 使用乐观锁更新订单状态为已取消
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            status: 'PUBLISHED',  // 必须是 PUBLISHED 状态
            version: order.version || 0  // 版本号必须匹配
          },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            version: {
              increment: 1  // 版本号+1
            }
          }
        })

        // 5.2 检查更新是否成功
        if (result.count === 0) {
          throw new OptimisticLockError('订单状态已变更，请刷新页面后重试')
        }

        // 5.3 重新查询订单获取最新数据
        const cancelled = await tx.order.findUnique({
          where: { id: orderId }
        })

        return cancelled!
      })

      return { order: updatedOrder }

    } catch (error) {
      // 如果是已知的业务错误，直接抛出
      if (error instanceof OptimisticLockError) {
        throw error
      }

      // 事务失败
      if (error instanceof Error) {
        throw new InternalServerError(error.message, error)
      }

      throw new InternalServerError('取消订单失败，请重试')
    }
  }
}
