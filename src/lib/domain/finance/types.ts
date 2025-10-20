/**
 * 财务领域类型定义
 *
 * 定义所有财务操作相关的类型和接口
 */

import { Decimal } from '@prisma/client/runtime/library'
import { PaymentType, PaymentStatus, Payment, Withdrawal } from '@prisma/client'
import { Prisma } from '@prisma/client'

/**
 * 入账（增加余额）参数
 */
export interface CreditParams {
  /** 用户ID */
  userId: string

  /** 入账金额（必须>0） */
  amount: number | Decimal

  /** 支付类型 */
  type: PaymentType

  /** 关联订单ID（可选） */
  orderId?: string

  /** 关联提现ID（可选） */
  withdrawalId?: string

  /** 备注说明 */
  note: string

  /** 操作人ID（管理员操作时必填） */
  performedBy?: string

  /** 元数据（存储额外信息） */
  metadata?: Record<string, any>

  /** 支付方式（可选） */
  paymentMethod?: string

  /** 第三方交易ID（可选） */
  transactionId?: string
}

/**
 * 出账（扣除余额）参数
 */
export interface DebitParams {
  /** 用户ID */
  userId: string

  /** 扣除金额（必须>0） */
  amount: number | Decimal

  /** 支付类型 */
  type: PaymentType

  /** 关联订单ID（可选） */
  orderId?: string

  /** 关联提现ID（可选） */
  withdrawalId?: string

  /** 备注说明 */
  note: string

  /** 操作人ID（管理员操作时必填） */
  performedBy?: string

  /** 元数据（存储额外信息） */
  metadata?: Record<string, any>

  /** 支付方式（可选） */
  paymentMethod?: string

  /** 第三方交易ID（可选） */
  transactionId?: string
}

/**
 * 管理员调账参数
 */
export interface AdminAdjustBalanceParams {
  /** 目标用户ID */
  userId: string

  /** 调整金额（绝对值） */
  amount: number | Decimal

  /** 是否为入账（true=增加余额, false=扣除余额） */
  isCredit: boolean

  /** 调账原因（必填） */
  reason: string

  /** 管理员ID */
  adminUserId: string

  /** 额外备注（可选） */
  note?: string

  /** 关联订单号（可选，用于关联具体业务） */
  relatedOrderNo?: string
}

/**
 * 提现退款参数
 */
export interface RefundWithdrawalParams {
  /** 提现申请ID */
  withdrawalId: string

  /** 退款原因 */
  reason: string

  /** 管理员ID */
  adminUserId: string

  /** 额外备注（可选） */
  note?: string
}

/**
 * 财务操作结果
 */
export interface FinancialOperationResult {
  /** 创建的Payment记录 */
  payment: Payment

  /** 操作后的用户新余额 */
  newBalance: Decimal

  /** 是否成功 */
  success: true
}

/**
 * 财务操作错误
 */
export class FinancialError extends Error {
  constructor(
    message: string,
    public code: FinancialErrorCode,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'FinancialError'
  }
}

/**
 * 财务错误代码
 */
export enum FinancialErrorCode {
  /** 余额不足 */
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',

  /** 无效的金额（≤0） */
  INVALID_AMOUNT = 'INVALID_AMOUNT',

  /** 用户不存在 */
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  /** 提现不存在 */
  WITHDRAWAL_NOT_FOUND = 'WITHDRAWAL_NOT_FOUND',

  /** 提现状态不正确 */
  INVALID_WITHDRAWAL_STATUS = 'INVALID_WITHDRAWAL_STATUS',

  /** 数据库事务失败 */
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',

  /** 参数验证失败 */
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  /** 内部错误 */
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

/**
 * Prisma事务客户端类型
 */
export type PrismaTransactionClient = Omit<
  Prisma.TransactionClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use'
>

/**
 * Payment创建数据（用于PaymentGateway）
 */
export interface CreatePaymentData {
  userId: string
  amount: number | Decimal
  type: PaymentType
  status?: PaymentStatus
  orderId?: string
  withdrawalId?: string
  performedBy?: string
  paymentMethod?: string
  transactionId?: string
  note?: string
  metadata?: Record<string, any>
}

/**
 * Payment查询过滤器
 */
export interface PaymentFilters {
  userId?: string
  type?: PaymentType | PaymentType[]
  status?: PaymentStatus | PaymentStatus[]
  orderId?: string
  withdrawalId?: string
  performedBy?: string
  dateFrom?: Date
  dateTo?: Date
}

/**
 * 分页参数
 */
export interface PaginationParams {
  limit?: number
  offset?: number
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  hasMore: boolean
}
