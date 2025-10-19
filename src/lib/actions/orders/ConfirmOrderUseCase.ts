/**
 * 确认收货用例
 *
 * 业务规则:
 * 1. 订单状态必须是 TRANSFERRING
 * 2. 只有买家可以确认收货
 * 3. 使用事务保证原子性：订单完成 + 款项释放 + 卖家余额更新
 * 4. 使用乐观锁防止并发冲突
 * 5. 自动扣除平台手续费
 *
 * 状态转换: TRANSFERRING → COMPLETED
 * 副作用: 释放款项给卖家
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import {
  InvalidOrderStateError,
  ForbiddenError,
  OptimisticLockError,
  OrderNotFoundError,
  InternalServerError
} from '@/lib/domain/DomainErrors'
import { calculatePlatformFee } from '@/lib/domain/policies/business-rules'
import type { Order } from '@prisma/client'

export interface ConfirmOrderInput {
  orderId: string
  userId: string
}

export interface ConfirmOrderOutput {
  order: Order
}

export class ConfirmOrderUseCase {
  /**
   * 执行确认收货
   */
  async execute(input: ConfirmOrderInput): Promise<ConfirmOrderOutput> {
    const { orderId, userId } = input

    // 1. 查询订单
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        buyer: { select: { id: true } },
        seller: { select: { id: true } }
      }
    })

    if (!order) {
      throw new OrderNotFoundError(orderId)
    }

    // 2. 验证订单状态
    if (order.status !== 'TRANSFERRING') {
      throw new InvalidOrderStateError(
        '订单状态不正确',
        order.status,
        'TRANSFERRING'
      )
    }

    // 3. 验证权限：只有买家可以确认收货
    if (order.buyerId !== userId) {
      throw new ForbiddenError('无权操作')
    }

    // 4. 使用事务执行确认收货（原子操作）
    try {
      const updatedOrder = await prisma.$transaction(async (tx) => {
        // 4.1 使用乐观锁更新订单状态为已完成
        const result = await tx.order.updateMany({
          where: {
            id: orderId,
            status: 'TRANSFERRING',
            version: order.version || 0  // 版本号必须匹配
          },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
            version: {
              increment: 1  // 版本号+1
            }
          }
        })

        // 4.2 检查更新是否成功
        if (result.count === 0) {
          throw new OptimisticLockError('订单状态已变更，请刷新页面后重试')
        }

        // 4.3 计算平台手续费和卖家应得金额
        // 注意: 如果订单没有保存platformFee(旧数据),使用当前规则重新计算
        const platformFee = order.platformFee
          ? Number(order.platformFee)
          : calculatePlatformFee(Number(order.price))

        const releaseAmount = Number(order.price) - platformFee

        console.log(`[ConfirmOrder] 订单${order.orderNo} 价格:${order.price} 手续费:${platformFee} 释放金额:${releaseAmount}`)

        // 4.4 创建释放款项记录
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

        // 4.5 更新卖家余额
        await tx.user.update({
          where: { id: order.sellerId },
          data: {
            balance: {
              increment: releaseAmount
            }
          }
        })

        // 4.6 重新查询订单获取最新数据
        const completed = await tx.order.findUnique({
          where: { id: orderId }
        })

        return completed!
      })

      return { order: updatedOrder }

    } catch (error) {
      // 如果是已知的业务错误，直接抛出
      if (error instanceof OptimisticLockError) {
        throw error
      }

      // 事务失败（可能是数据库错误、余额更新失败等）
      if (error instanceof Error) {
        throw new InternalServerError(error.message, error)
      }

      throw new InternalServerError('确认收货失败，请重试')
    }
  }
}
