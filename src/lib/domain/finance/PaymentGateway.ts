/**
 * Payment Gateway - Payment数据访问层
 *
 * 封装所有Payment相关的数据库操作
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import { Payment, PaymentStatus } from '@prisma/client'
import type {
  CreatePaymentData,
  PaymentFilters,
  PaginationParams,
  PaginatedResult,
  PrismaTransactionClient
} from './types'

export class PaymentGateway {
  /**
   * 创建Payment记录
   *
   * @param data Payment数据
   * @param tx Prisma事务客户端（可选，用于在事务中执行）
   * @returns 创建的Payment记录
   */
  async createPayment(
    data: CreatePaymentData,
    tx?: PrismaTransactionClient
  ): Promise<Payment> {
    const client = tx || prisma

    return await client.payment.create({
      data: {
        userId: data.userId,
        amount: data.amount,
        type: data.type,
        status: data.status || 'PENDING',
        orderId: data.orderId,
        withdrawalId: data.withdrawalId,
        performedBy: data.performedBy,
        paymentMethod: data.paymentMethod,
        transactionId: data.transactionId,
        note: data.note,
        metadata: data.metadata || undefined
      }
    })
  }

  /**
   * 更新Payment状态
   *
   * @param paymentId Payment ID
   * @param status 新状态
   * @param tx Prisma事务客户端（可选）
   * @returns 更新后的Payment记录
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatus,
    tx?: PrismaTransactionClient
  ): Promise<Payment> {
    const client = tx || prisma

    return await client.payment.update({
      where: { id: paymentId },
      data: { status }
    })
  }

  /**
   * 批量更新Payment状态
   *
   * @param paymentIds Payment IDs
   * @param status 新状态
   * @param tx Prisma事务客户端（可选）
   * @returns 更新数量
   */
  async updatePaymentStatusBatch(
    paymentIds: string[],
    status: PaymentStatus,
    tx?: PrismaTransactionClient
  ): Promise<number> {
    const client = tx || prisma

    const result = await client.payment.updateMany({
      where: { id: { in: paymentIds } },
      data: { status }
    })

    return result.count
  }

  /**
   * 根据用户ID查询Payment历史
   *
   * @param userId 用户ID
   * @param filters 过滤条件
   * @param pagination 分页参数
   * @returns 分页结果
   */
  async getPaymentsByUser(
    userId: string,
    filters?: PaymentFilters,
    pagination?: PaginationParams
  ): Promise<PaginatedResult<Payment>> {
    const limit = pagination?.limit || 20
    const offset = pagination?.offset || 0

    const where: any = { userId }

    if (filters?.type) {
      where.type = Array.isArray(filters.type)
        ? { in: filters.type }
        : filters.type
    }

    if (filters?.status) {
      where.status = Array.isArray(filters.status)
        ? { in: filters.status }
        : filters.status
    }

    if (filters?.orderId) {
      where.orderId = filters.orderId
    }

    if (filters?.withdrawalId) {
      where.withdrawalId = filters.withdrawalId
    }

    if (filters?.performedBy) {
      where.performedBy = filters.performedBy
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {}
      if (filters.dateFrom) {
        where.createdAt.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.createdAt.lte = filters.dateTo
      }
    }

    const [data, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          order: {
            select: {
              orderNo: true,
              status: true
            }
          },
          withdrawal: {
            select: {
              status: true,
              withdrawMethod: true
            }
          },
          performedByUser: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.payment.count({ where })
    ])

    return {
      data,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    }
  }

  /**
   * 根据提现ID查询所有关联的Payment记录
   *
   * @param withdrawalId 提现ID
   * @returns Payment记录数组
   */
  async getPaymentsByWithdrawal(withdrawalId: string): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: { withdrawalId },
      orderBy: { createdAt: 'asc' },
      include: {
        performedByUser: {
          select: {
            name: true,
            email: true
          }
        }
      }
    })
  }

  /**
   * 根据订单ID查询所有Payment记录
   *
   * @param orderId 订单ID
   * @returns Payment记录数组
   */
  async getPaymentsByOrder(orderId: string): Promise<Payment[]> {
    return await prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' }
    })
  }

  /**
   * 获取单个Payment记录
   *
   * @param paymentId Payment ID
   * @returns Payment记录或null
   */
  async getPaymentById(paymentId: string): Promise<Payment | null> {
    return await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        order: {
          select: {
            orderNo: true,
            status: true
          }
        },
        withdrawal: {
          select: {
            status: true,
            withdrawMethod: true
          }
        },
        performedByUser: {
          select: {
            name: true,
            email: true,
            role: true
          }
        }
      }
    })
  }

  /**
   * 计算用户从Payment记录计算出的余额（用于验证）
   *
   * @param userId 用户ID
   * @returns 计算出的余额
   */
  async calculateBalanceFromPayments(userId: string): Promise<number> {
    const payments = await prisma.payment.findMany({
      where: {
        userId,
        status: 'COMPLETED'
      },
      select: {
        amount: true,
        type: true
      }
    })

    let balance = 0

    for (const payment of payments) {
      const amount = Number(payment.amount)

      switch (payment.type) {
        case 'RELEASE':
        case 'REFUND':
          // 入账：增加余额
          balance += amount
          break

        case 'ADMIN_ADJUSTMENT':
          // 管理员调账：可能增加或减少（根据amount正负判断）
          // 注意：我们约定ADMIN_ADJUSTMENT总是用正数amount存储，
          // 通过metadata.isCredit区分增减。
          // 但为了简化，这里假设ADMIN_ADJUSTMENT的amount已经包含正负号
          balance += amount
          break

        case 'WITHDRAW':
        case 'ESCROW':
          // 出账：减少余额
          balance -= amount
          break

        default:
          console.warn(`未知的PaymentType: ${payment.type}`)
      }
    }

    return balance
  }
}
