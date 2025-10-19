/**
 * 领域错误类层次结构
 *
 * 设计原则:
 * 1. 所有业务错误继承自 DomainError
 * 2. 每个错误携带错误码和HTTP状态码
 * 3. 错误信息对用户友好
 * 4. 支持错误追踪和日志
 */

import { ERROR_CODES, HTTP_STATUS } from '@/lib/domain/policies/business-rules'

/**
 * 基础领域错误
 *
 * 所有业务错误的基类，不应该直接抛出
 */
export abstract class DomainError extends Error {
  /**
   * @param message 用户友好的错误信息
   * @param code 错误代码（用于前端识别和国际化）
   * @param statusCode HTTP 状态码
   * @param metadata 附加元数据（用于日志和调试）
   */
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly metadata?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name

    // 确保错误堆栈正确
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  /**
   * 将错误转换为 JSON 响应格式
   */
  toJSON() {
    return {
      success: false,
      error: this.message,
      code: this.code,
      ...(this.metadata && { metadata: this.metadata }),
    }
  }
}

// ============================================================================
// 认证和授权错误
// ============================================================================

/**
 * 未授权错误 - 用户未登录或token无效
 */
export class UnauthorizedError extends DomainError {
  constructor(message: string = '请先登录') {
    super(message, ERROR_CODES.UNAUTHORIZED, HTTP_STATUS.UNAUTHORIZED)
  }
}

/**
 * Token 无效错误
 */
export class InvalidTokenError extends DomainError {
  constructor(message: string = 'Token无效或已过期') {
    super(message, ERROR_CODES.INVALID_TOKEN, HTTP_STATUS.UNAUTHORIZED)
  }
}

/**
 * 权限不足错误 - 用户已登录但无权限执行操作
 */
export class ForbiddenError extends DomainError {
  constructor(message: string = '无权限执行此操作') {
    super(message, ERROR_CODES.FORBIDDEN, HTTP_STATUS.FORBIDDEN)
  }
}

// ============================================================================
// 订单相关错误
// ============================================================================

/**
 * 订单不存在错误
 */
export class OrderNotFoundError extends DomainError {
  constructor(orderId: string) {
    super(
      `订单 ${orderId} 不存在`,
      ERROR_CODES.ORDER_NOT_FOUND,
      HTTP_STATUS.NOT_FOUND,
      { orderId }
    )
  }
}

/**
 * 订单状态无效错误 - 当前订单状态不允许执行该操作
 */
export class InvalidOrderStateError extends DomainError {
  constructor(
    message: string,
    currentState?: string,
    requiredState?: string | string[]
  ) {
    const metadata: Record<string, unknown> = {}
    if (currentState) metadata.currentState = currentState
    if (requiredState) metadata.requiredState = requiredState

    super(
      message,
      ERROR_CODES.INVALID_ORDER_STATE,
      HTTP_STATUS.BAD_REQUEST,
      metadata
    )
  }
}

/**
 * 订单已被购买错误
 */
export class OrderAlreadyPurchasedError extends DomainError {
  constructor(orderId: string, buyerId?: string) {
    super(
      '该订单已被其他用户购买',
      ERROR_CODES.ORDER_ALREADY_PURCHASED,
      HTTP_STATUS.CONFLICT,
      { orderId, buyerId }
    )
  }
}

/**
 * 乐观锁失败错误 - 订单在操作期间被其他请求修改
 */
export class OptimisticLockError extends DomainError {
  constructor(message: string = '订单状态已变更，请刷新页面后重试') {
    super(message, ERROR_CODES.OPTIMISTIC_LOCK_FAILED, HTTP_STATUS.CONFLICT)
  }
}

// ============================================================================
// 退款相关错误
// ============================================================================

/**
 * 退款操作不允许错误
 */
export class RefundNotAllowedError extends DomainError {
  constructor(reason: string) {
    super(
      reason,
      ERROR_CODES.REFUND_NOT_ALLOWED,
      HTTP_STATUS.BAD_REQUEST
    )
  }
}

/**
 * 退款已申请错误
 */
export class RefundAlreadyRequestedError extends DomainError {
  constructor() {
    super(
      '退款申请已存在',
      ERROR_CODES.REFUND_ALREADY_REQUESTED,
      HTTP_STATUS.CONFLICT
    )
  }
}

/**
 * 退款超时错误
 */
export class RefundTimeoutError extends DomainError {
  constructor(deadline: Date) {
    super(
      '退款处理已超时',
      ERROR_CODES.REFUND_TIMEOUT,
      HTTP_STATUS.BAD_REQUEST,
      { deadline: deadline.toISOString() }
    )
  }
}

// ============================================================================
// 验证相关错误
// ============================================================================

/**
 * 验证错误 - 用户输入不符合业务规则
 */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    field?: string,
    value?: unknown
  ) {
    const metadata: Record<string, unknown> = {}
    if (field) metadata.field = field
    if (value !== undefined) metadata.value = value

    super(
      message,
      ERROR_CODES.VALIDATION_ERROR,
      HTTP_STATUS.BAD_REQUEST,
      metadata
    )
  }
}

// ============================================================================
// 系统错误
// ============================================================================

/**
 * 内部服务器错误 - 不应该暴露给用户的错误
 */
export class InternalServerError extends DomainError {
  constructor(
    message: string = '服务器内部错误，请稍后重试',
    originalError?: Error
  ) {
    super(
      message,
      ERROR_CODES.INTERNAL_ERROR,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      originalError ? { originalError: originalError.message } : undefined
    )

    // 保留原始错误堆栈（用于调试）
    if (originalError) {
      this.stack = originalError.stack
    }
  }
}

// ============================================================================
// 错误处理辅助函数
// ============================================================================

/**
 * 判断是否是领域错误
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}

/**
 * 从任意错误创建 DomainError
 *
 * 用于将第三方库错误转换为领域错误
 */
export function toDomainError(error: unknown): DomainError {
  if (isDomainError(error)) {
    return error
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, error)
  }

  return new InternalServerError(String(error))
}

/**
 * 错误日志记录器
 *
 * 区分用户错误和系统错误，采用不同的日志级别
 */
export function logError(error: DomainError, context?: Record<string, unknown>) {
  const logData = {
    name: error.name,
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    metadata: error.metadata,
    stack: error.stack,
    ...context,
  }

  // 系统错误（5xx）使用 error 级别
  if (error.statusCode >= 500) {
    console.error('[System Error]', logData)
  }
  // 业务错误（4xx）使用 warn 级别
  else {
    console.warn('[Business Error]', logData)
  }
}
