/**
 * Wallet Service - 统一钱包服务
 *
 * 所有财务操作的统一入口，确保：
 * 1. Payment记录和User.balance严格同步
 * 2. 所有操作在事务中执行
 * 3. 完整的审计追溯
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import { Decimal } from '@prisma/client/runtime/library'
import { PaymentGateway } from './PaymentGateway'
import { logAudit, AUDIT_ACTIONS } from '@/lib/infrastructure/audit/audit-logger'
import type {
  CreditParams,
  DebitParams,
  AdminAdjustBalanceParams,
  RefundWithdrawalParams,
  FinancialOperationResult,
  PrismaTransactionClient
} from './types'
import { FinancialError, FinancialErrorCode } from './types'

export class WalletService {
  private paymentGateway: PaymentGateway

  constructor() {
    this.paymentGateway = new PaymentGateway()
  }

  /**
   * 入账（增加余额）
   *
   * 使用场景:
   * - 确认收货释放款项给卖家
   * - 退款给买家
   * - 提现拒绝/失败恢复余额
   * - 管理员增加用户余额
   *
   * @param params 入账参数
   * @param tx Prisma事务客户端（可选，用于在现有事务中执行）
   * @returns 操作结果
   */
  async credit(
    params: CreditParams,
    tx?: PrismaTransactionClient
  ): Promise<FinancialOperationResult> {
    // 参数验证
    this.validateAmount(params.amount, 'credit')
    await this.validateUser(params.userId)

    // 执行财务操作
    const execute = async (client: PrismaTransactionClient) => {
      // 1. 创建Payment记录
      const payment = await this.paymentGateway.createPayment(
        {
          userId: params.userId,
          amount: params.amount,
          type: params.type,
          status: 'COMPLETED', // 入账立即完成
          orderId: params.orderId,
          withdrawalId: params.withdrawalId,
          performedBy: params.performedBy,
          paymentMethod: params.paymentMethod,
          transactionId: params.transactionId,
          note: params.note,
          metadata: params.metadata
        },
        client
      )

      // 2. 更新用户余额
      const updatedUser = await client.user.update({
        where: { id: params.userId },
        data: {
          balance: {
            increment: params.amount
          }
        }
      })

      return {
        payment,
        newBalance: updatedUser.balance
      }
    }

    // 在事务中执行或使用外部事务
    const result = tx
      ? await execute(tx)
      : await prisma.$transaction(execute)

    console.log(
      `[WalletService] credit: userId=${params.userId}, amount=${params.amount}, type=${params.type}, newBalance=${result.newBalance}`
    )

    return {
      payment: result.payment,
      newBalance: result.newBalance,
      success: true
    }
  }

  /**
   * 出账（扣除余额）
   *
   * 使用场景:
   * - 用户申请提现
   * - 管理员扣除用户余额
   *
   * @param params 出账参数
   * @param tx Prisma事务客户端（可选）
   * @returns 操作结果
   */
  async debit(
    params: DebitParams,
    tx?: PrismaTransactionClient
  ): Promise<FinancialOperationResult> {
    // 参数验证
    this.validateAmount(params.amount, 'debit')
    await this.validateUser(params.userId)

    // 检查余额是否足够
    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { balance: true }
    })

    if (!user) {
      throw new FinancialError(
        '用户不存在',
        FinancialErrorCode.USER_NOT_FOUND,
        { userId: params.userId }
      )
    }

    if (Number(user.balance) < Number(params.amount)) {
      throw new FinancialError(
        `余额不足: 当前余额 ¥${user.balance}, 需要 ¥${params.amount}`,
        FinancialErrorCode.INSUFFICIENT_BALANCE,
        {
          userId: params.userId,
          currentBalance: user.balance,
          requestedAmount: params.amount
        }
      )
    }

    // 执行财务操作
    const execute = async (client: PrismaTransactionClient) => {
      // 1. 创建Payment记录
      const payment = await this.paymentGateway.createPayment(
        {
          userId: params.userId,
          amount: params.amount,
          type: params.type,
          status: params.type === 'WITHDRAW' ? 'PENDING' : 'COMPLETED',
          orderId: params.orderId,
          withdrawalId: params.withdrawalId,
          performedBy: params.performedBy,
          paymentMethod: params.paymentMethod,
          transactionId: params.transactionId,
          note: params.note,
          metadata: params.metadata
        },
        client
      )

      // 2. 扣除用户余额
      const updatedUser = await client.user.update({
        where: { id: params.userId },
        data: {
          balance: {
            decrement: params.amount
          }
        }
      })

      return {
        payment,
        newBalance: updatedUser.balance
      }
    }

    // 在事务中执行或使用外部事务
    const result = tx
      ? await execute(tx)
      : await prisma.$transaction(execute)

    console.log(
      `[WalletService] debit: userId=${params.userId}, amount=${params.amount}, type=${params.type}, newBalance=${result.newBalance}`
    )

    return {
      payment: result.payment,
      newBalance: result.newBalance,
      success: true
    }
  }

  /**
   * 管理员调整余额
   *
   * 使用场景:
   * - 补偿用户损失
   * - 扣除违规用户资金
   * - 其他人工干预调整
   *
   * @param params 调账参数
   * @returns 操作结果
   */
  async adminAdjustBalance(
    params: AdminAdjustBalanceParams
  ): Promise<FinancialOperationResult> {
    // 参数验证
    this.validateAmount(params.amount, 'adminAdjustBalance')

    if (!params.reason || params.reason.trim() === '') {
      throw new FinancialError(
        '管理员调账必须提供原因',
        FinancialErrorCode.VALIDATION_ERROR,
        { reason: params.reason }
      )
    }

    // 构建元数据
    const metadata = {
      reason: params.reason,
      note: params.note || '',
      relatedOrderNo: params.relatedOrderNo,
      isCredit: params.isCredit,
      adminUserId: params.adminUserId,
      timestamp: new Date().toISOString()
    }

    // 根据 isCredit 决定调用 credit 或 debit
    const result = params.isCredit
      ? await this.credit({
          userId: params.userId,
          amount: params.amount,
          type: 'ADMIN_ADJUSTMENT',
          note: `管理员调账（增加）: ${params.reason}`,
          performedBy: params.adminUserId,
          metadata
        })
      : await this.debit({
          userId: params.userId,
          amount: params.amount,
          type: 'ADMIN_ADJUSTMENT',
          note: `管理员调账（扣除）: ${params.reason}`,
          performedBy: params.adminUserId,
          metadata
        })

    // 记录审计日志
    await logAudit({
      userId: params.adminUserId,
      action: AUDIT_ACTIONS.UPDATE_USER_BALANCE,
      target: params.userId,
      targetType: 'User',
      newValue: {
        amount: params.amount,
        isCredit: params.isCredit,
        reason: params.reason,
        paymentId: result.payment.id
      },
      description: `管理员调账: ${params.isCredit ? '增加' : '扣除'} ¥${params.amount} - ${params.reason}`
      // req字段省略，logAudit会使用undefined
    })

    console.log(
      `[WalletService] adminAdjustBalance: userId=${params.userId}, amount=${params.amount}, isCredit=${params.isCredit}, adminUserId=${params.adminUserId}`
    )

    return result
  }

  /**
   * 提现退款（拒绝或失败时恢复余额）
   *
   * 使用场景:
   * - 管理员拒绝提现申请
   * - 提现处理失败（如银行转账失败）
   *
   * @param params 提现退款参数
   * @returns 操作结果
   */
  async refundWithdrawal(
    params: RefundWithdrawalParams
  ): Promise<FinancialOperationResult> {
    // 查询提现申请
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id: params.withdrawalId },
      include: {
        payments: {
          where: { type: 'WITHDRAW' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    })

    if (!withdrawal) {
      throw new FinancialError(
        '提现申请不存在',
        FinancialErrorCode.WITHDRAWAL_NOT_FOUND,
        { withdrawalId: params.withdrawalId }
      )
    }

    // 验证状态（只有PENDING/APPROVED/PROCESSING状态可以退款）
    if (!['PENDING', 'APPROVED', 'PROCESSING'].includes(withdrawal.status)) {
      throw new FinancialError(
        `提现状态不正确: ${withdrawal.status}`,
        FinancialErrorCode.INVALID_WITHDRAWAL_STATUS,
        {
          withdrawalId: params.withdrawalId,
          status: withdrawal.status
        }
      )
    }

    // 在事务中执行
    const result = await prisma.$transaction(async (tx) => {
      // 1. 创建退款Payment并恢复用户余额
      const refundResult = await this.credit(
        {
          userId: withdrawal.userId,
          amount: withdrawal.amount,
          type: 'REFUND',
          withdrawalId: params.withdrawalId,
          note: `提现退款: ${params.reason}`,
          performedBy: params.adminUserId,
          metadata: {
            refundReason: params.reason,
            note: params.note,
            adminUserId: params.adminUserId,
            originalWithdrawalId: params.withdrawalId
          }
        },
        tx
      )

      // 2. 更新原始WITHDRAW类型的Payment状态为CANCELLED
      if (withdrawal.payments.length > 0) {
        const originalPayment = withdrawal.payments[0]
        await this.paymentGateway.updatePaymentStatus(
          originalPayment.id,
          'CANCELLED',
          tx
        )
      }

      return refundResult
    })

    // 记录审计日志
    await logAudit({
      userId: params.adminUserId,
      action: AUDIT_ACTIONS.REJECT_WITHDRAWAL,
      target: params.withdrawalId,
      targetType: 'Withdrawal',
      newValue: {
        refundAmount: withdrawal.amount,
        reason: params.reason,
        paymentId: result.payment.id
      },
      description: `提现退款: ${params.reason}`,
      // req字段省略，logAudit会使用undefined
    })

    console.log(
      `[WalletService] refundWithdrawal: withdrawalId=${params.withdrawalId}, amount=${withdrawal.amount}, userId=${withdrawal.userId}`
    )

    return result
  }

  /**
   * 查询用户当前余额
   *
   * @param userId 用户ID
   * @returns 当前余额
   */
  async getBalance(userId: string): Promise<Decimal> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { balance: true }
    })

    if (!user) {
      throw new FinancialError(
        '用户不存在',
        FinancialErrorCode.USER_NOT_FOUND,
        { userId }
      )
    }

    return user.balance
  }

  /**
   * 从Payment记录计算余额（用于验证数据一致性）
   *
   * @param userId 用户ID
   * @returns 计算出的余额
   */
  async calculateBalanceFromPayments(userId: string): Promise<number> {
    return await this.paymentGateway.calculateBalanceFromPayments(userId)
  }

  /**
   * 验证金额有效性
   *
   * @param amount 金额
   * @param operation 操作名称
   */
  private validateAmount(amount: number | Decimal, operation: string): void {
    const numAmount = Number(amount)

    if (isNaN(numAmount) || numAmount <= 0) {
      throw new FinancialError(
        `无效的金额: ${amount}`,
        FinancialErrorCode.INVALID_AMOUNT,
        { amount, operation }
      )
    }
  }

  /**
   * 验证用户存在
   *
   * @param userId 用户ID
   */
  private async validateUser(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    })

    if (!user) {
      throw new FinancialError(
        '用户不存在',
        FinancialErrorCode.USER_NOT_FOUND,
        { userId }
      )
    }
  }
}

// 导出单例
export const walletService = new WalletService()
