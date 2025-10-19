/**
 * 支付订单用例
 *
 * 业务规则:
 * 1. 订单状态必须是 PUBLISHED
 * 2. 卖家不能购买自己的订单
 * 3. 使用乐观锁防止并发购买
 * 4. 创建托管支付记录
 *
 * 状态转换: PUBLISHED → PAID
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import {
  InvalidOrderStateError,
  ForbiddenError,
  OptimisticLockError,
  OrderNotFoundError
} from '@/lib/domain/DomainErrors'
import type { Order } from '@prisma/client'

export interface PayOrderInput {
  orderId: string
  userId: string
}

export interface PayOrderOutput {
  order: Order
}

export class PayOrderUseCase {
  /**
   * 执行支付订单
   */
  async execute(input: PayOrderInput): Promise<PayOrderOutput> {
    const { orderId, userId } = input

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

    // 2. 验证订单状态
    if (order.status !== 'PUBLISHED') {
      throw new InvalidOrderStateError(
        '订单状态不允许支付',
        order.status,
        'PUBLISHED'
      )
    }

    // 3. 验证卖家不能购买自己的订单
    if (order.sellerId === userId) {
      throw new ForbiddenError('卖家不能购买自己的订单')
    }

    // 4. 使用事务和乐观锁执行支付
    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 4.1 使用乐观锁更新订单状态
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            status: 'PUBLISHED',
            version: order.version || 0  // 版本号必须匹配
          },
          data: {
            buyerId: userId,
            status: 'PAID',
            paidAt: new Date(),
            escrowAmount: order.price,
            version: {
              increment: 1  // 版本号+1
            }
          }
        })

        // 4.2 检查更新是否成功
        if (result.count === 0) {
          throw new OptimisticLockError('订单已被其他买家购买或状态已变更')
        }

        // 4.3 创建托管支付记录
        await tx.payment.create({
          data: {
            orderId: order.id,
            userId,
            amount: order.price,
            type: 'ESCROW',
            status: 'COMPLETED',
            note: '买家支付到平台托管'
          }
        })

        // 4.4 重新查询订单获取最新数据
        const updated = await tx.order.findUnique({
          where: { id: orderId }
        })

        return updated!
      })

      return { order: updatedOrder }

    } catch (error) {
      // 如果是已知的业务错误，直接抛出
      if (error instanceof OptimisticLockError) {
        throw error
      }

      // 其他事务错误
      throw new OptimisticLockError('支付失败，请刷新页面后重试')
    }
  }
}
