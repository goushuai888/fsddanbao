/**
 * 标准化 API 响应工具
 *
 * 用途：统一所有 API 路由的响应格式和状态码
 * 解决问题：当前不同 API 使用不一致的错误状态码和响应格式
 *
 * HTTP 状态码规范：
 * - 200: 成功
 * - 201: 创建成功
 * - 400: 客户端请求错误
 * - 401: 未授权
 * - 403: 无权限
 * - 404: 资源不存在
 * - 409: 冲突（如并发冲突）
 * - 422: 验证失败
 * - 429: 请求过多（限流）
 * - 500: 服务器内部错误
 */

import { NextResponse } from 'next/server'

export interface SuccessResponse<T = any> {
  success: true
  data: T
  message?: string
}

export interface ErrorResponse {
  success: false
  error: string
  details?: any
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse

/**
 * API 响应构造器
 */
export class ApiResponses {
  /**
   * 成功响应 (200 OK)
   */
  static success<T>(data: T, message?: string): NextResponse<SuccessResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        ...(message && { message })
      },
      { status: 200 }
    )
  }

  /**
   * 创建成功响应 (201 Created)
   */
  static created<T>(data: T, message?: string): NextResponse<SuccessResponse<T>> {
    return NextResponse.json(
      {
        success: true,
        data,
        ...(message && { message })
      },
      { status: 201 }
    )
  }

  /**
   * 无内容响应 (204 No Content)
   * 用于删除操作成功
   */
  static noContent(): NextResponse {
    return new NextResponse(null, { status: 204 })
  }

  /**
   * 客户端请求错误 (400 Bad Request)
   * 用于：请求参数错误、业务逻辑错误
   */
  static badRequest(error: string, details?: any): NextResponse<ErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        ...(details && { details })
      },
      { status: 400 }
    )
  }

  /**
   * 未授权 (401 Unauthorized)
   * 用于：Token 缺失、Token 过期、Token 无效
   */
  static unauthorized(error: string = '未授权，请先登录'): NextResponse<ErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error
      },
      { status: 401 }
    )
  }

  /**
   * 无权限 (403 Forbidden)
   * 用于：已登录但角色/权限不足
   */
  static forbidden(error: string = '无权访问此资源'): NextResponse<ErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error
      },
      { status: 403 }
    )
  }

  /**
   * 资源不存在 (404 Not Found)
   * 用于：订单不存在、用户不存在等
   */
  static notFound(error: string = '请求的资源不存在'): NextResponse<ErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error
      },
      { status: 404 }
    )
  }

  /**
   * 冲突 (409 Conflict)
   * 用于：乐观锁冲突、并发操作冲突、重复创建
   */
  static conflict(error: string, details?: any): NextResponse<ErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        ...(details && { details })
      },
      { status: 409 }
    )
  }

  /**
   * 验证失败 (422 Unprocessable Entity)
   * 用于：Zod 验证失败、表单验证失败
   */
  static validationError(error: string, details?: any): NextResponse<ErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error,
        ...(details && { details })
      },
      { status: 422 }
    )
  }

  /**
   * 请求过多 (429 Too Many Requests)
   * 用于：触发限流
   */
  static tooManyRequests(error: string = '请求过于频繁，请稍后再试'): NextResponse<ErrorResponse> {
    return NextResponse.json(
      {
        success: false,
        error
      },
      { status: 429 }
    )
  }

  /**
   * 服务器内部错误 (500 Internal Server Error)
   * 用于：未预期的错误、数据库错误
   */
  static serverError(
    error: string = '服务器内部错误',
    details?: any
  ): NextResponse<ErrorResponse> {
    // 在生产环境中不暴露详细错误信息
    const isDev = process.env.NODE_ENV === 'development'

    return NextResponse.json(
      {
        success: false,
        error,
        ...(isDev && details && { details })
      },
      { status: 500 }
    )
  }
}

/**
 * 使用示例：
 *
 * // API 路由中使用
 * import { ApiResponses } from '@/lib/utils/formatters/api-responses'
 *
 * export async function GET(request: NextRequest) {
 *   try {
 *     const token = request.headers.get('authorization')?.replace('Bearer ', '')
 *     if (!token) {
 *       return ApiResponses.unauthorized()
 *     }
 *
 *     const user = verifyToken(token)
 *     if (!user) {
 *       return ApiResponses.unauthorized('Token 无效')
 *     }
 *
 *     if (user.role !== 'ADMIN') {
 *       return ApiResponses.forbidden('需要管理员权限')
 *     }
 *
 *     const orders = await prisma.order.findMany()
 *     return ApiResponses.success(orders)
 *
 *   } catch (error) {
 *     console.error('API Error:', error)
 *     return ApiResponses.serverError()
 *   }
 * }
 *
 * export async function POST(request: NextRequest) {
 *   try {
 *     const body = await request.json()
 *
 *     // Zod 验证
 *     const result = orderSchema.safeParse(body)
 *     if (!result.success) {
 *       return ApiResponses.validationError(
 *         '验证失败',
 *         result.error.flatten()
 *       )
 *     }
 *
 *     const order = await prisma.order.create({ data: result.data })
 *     return ApiResponses.created(order, '订单创建成功')
 *
 *   } catch (error) {
 *     return ApiResponses.serverError()
 *   }
 * }
 *
 * // 业务逻辑错误
 * if (order.status !== 'PUBLISHED') {
 *   return ApiResponses.badRequest('订单状态不正确')
 * }
 *
 * // 资源不存在
 * const order = await prisma.order.findUnique({ where: { id } })
 *  if (!order) {
 *   return ApiResponses.notFound('订单不存在')
 * }
 *
 * // 乐观锁冲突
 * const result = await prisma.order.updateMany({
 *   where: { id, version: currentVersion },
 *   data: { status: 'PAID', version: { increment: 1 } }
 * })
 * if (result.count === 0) {
 *   return ApiResponses.conflict('订单状态已变更，请刷新页面后重试')
 * }
 */
