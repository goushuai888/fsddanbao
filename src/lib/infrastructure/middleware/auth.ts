/**
 * 统一认证中间件
 *
 * 功能:
 * 1. 提取和验证JWT Token
 * 2. 检查用户角色权限（管理员、认证状态）
 * 3. 统一错误响应格式
 * 4. 集成领域错误系统
 *
 * 使用示例:
 * ```typescript
 * export const GET = withAuth(async (req, ctx, auth) => {
 *   // auth.userId, auth.role 已验证，直接使用
 *   const data = await fetchUserData(auth.userId)
 *   return NextResponse.json({ success: true, data })
 * }, { requireAdmin: true })
 * ```
 *
 * 优势:
 * - 消除500+行重复代码
 * - 统一认证逻辑
 * - 类型安全
 * - 易于测试
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { UnauthorizedError, ForbiddenError, isDomainError } from '@/lib/domain/DomainErrors'
import { ApiResponse } from '@/types'

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 认证上下文
 *
 * 在withAuth包装的处理器中可用，包含已验证的用户信息
 */
export interface AuthContext {
  /** 用户ID */
  userId: string
  /** 用户邮箱 */
  email: string
  /** 用户角色 (ADMIN | SELLER | BUYER) */
  role: string
  /** 是否已实名认证 */
  verified?: boolean
}

/**
 * 认证选项
 *
 * 配置认证中间件的行为
 */
export interface AuthOptions {
  /** 是否要求管理员权限 */
  requireAdmin?: boolean

  /** 是否要求用户已实名认证 */
  requireVerified?: boolean

  /** 是否允许未登录访问（可选认证） */
  optional?: boolean

  /** 自定义权限检查函数 */
  customCheck?: (auth: AuthContext) => boolean | Promise<boolean>
}

/**
 * 已认证的处理器类型
 *
 * @template TContext - Next.js路由上下文类型（如 { params: { id: string } }）
 */
export type AuthenticatedHandler<TContext = any> = (
  request: NextRequest,
  context: TContext,
  auth: AuthContext
) => Promise<NextResponse | Response> | NextResponse | Response

// ============================================================================
// 核心中间件函数
// ============================================================================

/**
 * 认证中间件包装器
 *
 * 将普通的API处理器包装为需要认证的处理器
 *
 * @param handler - 业务逻辑处理器
 * @param options - 认证选项
 * @returns 包装后的处理器
 *
 * @example
 * // 基础认证
 * export const GET = withAuth(async (req, ctx, auth) => {
 *   return NextResponse.json({ userId: auth.userId })
 * })
 *
 * @example
 * // 要求管理员权限
 * export const DELETE = withAuth(
 *   async (req, ctx, auth) => {
 *     await deleteUser(ctx.params.id)
 *     return NextResponse.json({ success: true })
 *   },
 *   { requireAdmin: true }
 * )
 *
 * @example
 * // 要求实名认证
 * export const POST = withAuth(
 *   async (req, ctx, auth) => {
 *     const order = await createOrder(auth.userId)
 *     return NextResponse.json({ success: true, data: order })
 *   },
 *   { requireVerified: true }
 * )
 *
 * @example
 * // 自定义权限检查
 * export const PATCH = withAuth(
 *   async (req, ctx, auth) => {
 *     // 业务逻辑
 *   },
 *   {
 *     customCheck: (auth) => {
 *       // 只允许VIP用户
 *       return auth.role === 'VIP'
 *     }
 *   }
 * )
 */
export function withAuth<TContext = unknown>(
  handler: AuthenticatedHandler<TContext>,
  options: AuthOptions = {}
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return async (request: NextRequest, context: TContext): Promise<NextResponse> => {
    try {
      // ========================================
      // 1. 提取Token
      // ========================================
      const token = extractToken(request)

      // 如果是可选认证且没有token，传递null作为auth
      if (options.optional && !token) {
        return await handler(request, context, null as any)
      }

      if (!token) {
        throw new UnauthorizedError('缺少认证令牌，请先登录')
      }

      // ========================================
      // 2. 验证Token
      // ========================================
      const payload = verifyToken(token)

      if (!payload) {
        throw new UnauthorizedError('认证令牌无效或已过期，请重新登录')
      }

      // ========================================
      // 3. 构建认证上下文
      // ========================================
      const authContext: AuthContext = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        verified: payload.verified
      }

      // ========================================
      // 4. 权限检查
      // ========================================

      // 4.1 检查管理员权限
      if (options.requireAdmin && authContext.role !== 'ADMIN') {
        throw new ForbiddenError('此操作需要管理员权限')
      }

      // 4.2 检查实名认证状态
      if (options.requireVerified && !authContext.verified) {
        throw new ForbiddenError('此操作需要完成实名认证')
      }

      // 4.3 自定义权限检查
      if (options.customCheck) {
        const hasPermission = await Promise.resolve(options.customCheck(authContext))
        if (!hasPermission) {
          throw new ForbiddenError('您没有权限执行此操作')
        }
      }

      // ========================================
      // 5. 执行业务处理器
      // ========================================
      return await handler(request, context, authContext)

    } catch (error) {
      // ========================================
      // 6. 统一错误处理
      // ========================================
      return handleAuthError(error)
    }
  }
}

// ============================================================================
// 辅助函数
// ============================================================================

/**
 * 从请求中提取JWT Token
 *
 * 支持两种格式:
 * 1. Authorization: Bearer <token>
 * 2. Cookie: token=<token>
 *
 * @param request - Next.js请求对象
 * @returns Token字符串或null
 */
function extractToken(request: NextRequest): string | null {
  // 方式1: 从Authorization头提取
  const authHeader = request.headers.get('authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.replace('Bearer ', '')
  }

  // 方式2: 从Cookie提取（未来扩展）
  // const cookieToken = request.cookies.get('token')?.value
  // if (cookieToken) {
  //   return cookieToken
  // }

  return null
}

/**
 * 统一处理认证错误
 *
 * 将各种错误转换为标准的JSON响应
 *
 * @param error - 捕获的错误
 * @returns 错误响应
 */
function handleAuthError(error: unknown): NextResponse {
  // 处理领域错误
  if (isDomainError(error)) {
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: error.message,
        code: error.code
      },
      { status: error.statusCode }
    )
  }

  // 处理未知错误
  console.error('认证中间件未知错误:', error)

  return NextResponse.json<ApiResponse>(
    {
      success: false,
      error: '服务器内部错误，请稍后重试'
    },
    { status: 500 }
  )
}

// ============================================================================
// 便捷函数（常用场景的快捷方式）
// ============================================================================

/**
 * 仅管理员可访问的处理器
 *
 * 等价于 withAuth(handler, { requireAdmin: true })
 *
 * @example
 * export const DELETE = adminOnly(async (req, ctx, auth) => {
 *   await deleteUser(ctx.params.id)
 *   return NextResponse.json({ success: true })
 * })
 */
export function adminOnly<TContext = any>(
  handler: AuthenticatedHandler<TContext>
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return withAuth(handler, { requireAdmin: true })
}

/**
 * 仅认证用户可访问的处理器
 *
 * 等价于 withAuth(handler, { requireVerified: true })
 *
 * @example
 * export const POST = verifiedOnly(async (req, ctx, auth) => {
 *   const order = await createOrder(auth.userId)
 *   return NextResponse.json({ success: true, data: order })
 * })
 */
export function verifiedOnly<TContext = any>(
  handler: AuthenticatedHandler<TContext>
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return withAuth(handler, { requireVerified: true })
}

/**
 * 可选认证（未登录也可访问，但会尝试获取用户信息）
 *
 * @example
 * export const GET = optionalAuth(async (req, ctx, auth) => {
 *   if (auth) {
 *     // 已登录，返回个性化内容
 *     return getPersonalizedData(auth.userId)
 *   } else {
 *     // 未登录，返回公开内容
 *     return getPublicData()
 *   }
 * })
 */
export function optionalAuth<TContext = any>(
  handler: AuthenticatedHandler<TContext>
): (request: NextRequest, context: TContext) => Promise<NextResponse> {
  return withAuth(handler, { optional: true })
}
