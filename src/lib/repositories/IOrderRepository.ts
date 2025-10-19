/**
 * 订单仓储接口
 *
 * 遵循 Repository 模式，将数据访问逻辑从业务逻辑中分离
 *
 * 优势:
 * 1. 业务层不依赖具体的数据库实现
 * 2. 易于切换数据库（Prisma → TypeORM → MongoDB）
 * 3. 易于测试（可以 Mock）
 * 4. 使用领域术语而非数据库术语
 */

import { Order, OrderStatus, Payment, Dispute } from '@prisma/client'

/**
 * 事务上下文类型
 *
 * 具体实现由基础设施层决定（如 Prisma.TransactionClient）
 */
export type TransactionContext = unknown

/**
 * 订单仓储接口
 */
export interface IOrderRepository {
  // ============================================================================
  // 查询操作
  // ============================================================================

  /**
   * 根据ID查找订单（包含完整关联数据）
   */
  findById(id: string): Promise<OrderWithRelations | null>

  /**
   * 根据订单号查找订单
   */
  findByOrderNo(orderNo: string): Promise<OrderWithRelations | null>

  /**
   * 查找卖家的订单列表
   */
  findBySellerId(sellerId: string, options?: QueryOptions): Promise<PaginatedResult<Order>>

  /**
   * 查找买家的订单列表
   */
  findByBuyerId(buyerId: string, options?: QueryOptions): Promise<PaginatedResult<Order>>

  /**
   * 查找公开订单（PUBLISHED状态）
   */
  findPublishedOrders(options?: QueryOptions): Promise<PaginatedResult<Order>>

  /**
   * 查找需要自动确认的订单
   *
   * 条件: TRANSFERRING 状态 + confirmDeadline 已过 + autoConfirmed = false
   */
  findOverdueConfirmOrders(): Promise<Order[]>

  /**
   * 查找需要自动处理退款的订单
   *
   * 条件: PAID 状态 + refundRequested = true + refundResponseDeadline 已过
   */
  findOverdueRefundOrders(): Promise<Order[]>

  // ============================================================================
  // 状态转换操作（使用乐观锁）
  // ============================================================================

  /**
   * 标记订单为已支付
   *
   * 状态转换: PUBLISHED → PAID
   * 乐观锁: 使用 version 字段
   */
  markAsPaid(
    orderId: string,
    buyerId: string,
    version: number
  ): Promise<Order>

  /**
   * 标记订单为转移中
   *
   * 状态转换: PAID → TRANSFERRING
   * 乐观锁: 使用 version 字段
   */
  markAsTransferring(
    orderId: string,
    transferProof: string,
    transferNote: string,
    version: number
  ): Promise<Order>

  /**
   * 标记订单为已完成
   *
   * 状态转换: TRANSFERRING → COMPLETED
   * 乐观锁: 使用 version 字段
   * 副作用: 需要释放款项给卖家
   */
  markAsCompleted(
    orderId: string,
    version: number,
    autoConfirmed?: boolean
  ): Promise<Order>

  /**
   * 标记订单为已取消
   *
   * 状态转换: PUBLISHED/PAID → CANCELLED
   * 乐观锁: 使用 version 字段
   */
  markAsCancelled(
    orderId: string,
    version: number
  ): Promise<Order>

  /**
   * 标记订单为申诉中
   *
   * 状态转换: TRANSFERRING/PAID → DISPUTE
   * 乐观锁: 使用 version 字段
   */
  markAsDisputed(
    orderId: string,
    version: number
  ): Promise<Order>

  // ============================================================================
  // 退款相关操作
  // ============================================================================

  /**
   * 申请退款
   *
   * 更新字段:
   * - refundRequested = true
   * - refundStatus = 'PENDING'
   * - refundReason
   * - refundRequestedAt
   * - refundResponseDeadline（自动计算）
   */
  requestRefund(
    orderId: string,
    reason: string,
    responseDeadline: Date,
    version: number
  ): Promise<Order>

  /**
   * 同意退款
   *
   * 状态转换: PAID → CANCELLED
   * 更新字段: refundStatus = 'APPROVED'
   * 副作用: 需要退款给买家
   */
  approveRefund(
    orderId: string,
    version: number
  ): Promise<Order>

  /**
   * 拒绝退款
   *
   * 更新字段:
   * - refundStatus = 'REJECTED'
   * - refundRejectedReason
   * - refundRejectedAt
   */
  rejectRefund(
    orderId: string,
    reason: string,
    version: number
  ): Promise<Order>

  /**
   * 申请退款延期
   *
   * 更新字段:
   * - refundExtensionRequested = true
   * - refundExtensionReason
   * - refundResponseDeadline（延长24小时）
   */
  requestRefundExtension(
    orderId: string,
    reason: string,
    newDeadline: Date,
    version: number
  ): Promise<Order>

  // ============================================================================
  // 确认收货相关
  // ============================================================================

  /**
   * 自动修复缺失的 confirmDeadline
   *
   * 用于处理功能上线前已存在的订单
   */
  ensureConfirmDeadline(
    orderId: string,
    confirmDeadline: Date
  ): Promise<Order>

  // ============================================================================
  // 事务支持
  // ============================================================================

  /**
   * 执行事务
   *
   * 示例:
   * ```typescript
   * await orderRepo.transaction(async (tx) => {
   *   await orderRepo.markAsCompleted(orderId, version)
   *   await paymentRepo.createReleasePayment(payment, tx)
   *   await userRepo.updateBalance(sellerId, amount, tx)
   * })
   * ```
   */
  transaction<T>(
    callback: (tx: TransactionContext) => Promise<T>
  ): Promise<T>

  // ============================================================================
  // 统计和聚合
  // ============================================================================

  /**
   * 统计订单数量（按状态）
   */
  countByStatus(status: OrderStatus): Promise<number>

  /**
   * 统计用户的订单数量
   */
  countByUserId(userId: string, role: 'seller' | 'buyer'): Promise<number>

  /**
   * 计算平台总交易额（仅 COMPLETED 状态）
   */
  calculateTotalRevenue(): Promise<number>
}

// ============================================================================
// 辅助类型定义
// ============================================================================

/**
 * 完整的订单数据（包含关联数据）
 */
export type OrderWithRelations = Order & {
  seller: {
    id: string
    name: string | null
    email: string
    phone: string | null
    verified: boolean
  }
  buyer: {
    id: string
    name: string | null
    email: string
    phone: string | null
    verified: boolean
  } | null
  payments: Payment[]
  disputes: Dispute[]
}

/**
 * 查询选项
 */
export interface QueryOptions {
  /** 页码（从1开始） */
  page?: number
  /** 每页数量 */
  pageSize?: number
  /** 排序字段 */
  orderBy?: string
  /** 排序方向 */
  order?: 'asc' | 'desc'
  /** 状态过滤 */
  status?: OrderStatus | OrderStatus[]
  /** 搜索关键词 */
  search?: string
}

/**
 * 分页结果
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  data: T[]
  /** 总记录数 */
  total: number
  /** 当前页码 */
  page: number
  /** 每页数量 */
  pageSize: number
  /** 总页数 */
  totalPages: number
  /** 是否有下一页 */
  hasNext: boolean
  /** 是否有上一页 */
  hasPrev: boolean
}

/**
 * 创建分页结果的辅助函数
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / pageSize)

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}
