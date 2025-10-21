/**
 * 发送验证码 API
 *
 * POST /api/verification/send
 *
 * 认证要求: 已登录用户
 * 请求体:
 * - type: 验证类型 (WITHDRAWAL/CHANGE_EMAIL/LARGE_PAYMENT等)
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/infrastructure/middleware/auth'
import { apiLimiter, checkRateLimit } from '@/lib/infrastructure/security/ratelimit'
import { sendCode, type VerificationType } from '@/lib/services/verification-code'
import { ApiResponse } from '@/types'
import { prisma } from '@/lib/infrastructure/database/prisma'

export const POST = withAuth(async (request, context, auth) => {
  try {
    // 限流保护: 每个用户每分钟最多发送3次
    const rateLimitResult = await checkRateLimit(
      apiLimiter,
      `api:${auth.userId}:send-code`
    )
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    // 解析请求体
    const body = await request.json()
    const { type } = body

    // 验证type参数
    const validTypes: VerificationType[] = [
      'WITHDRAWAL',
      'CHANGE_EMAIL',
      'LARGE_PAYMENT',
      'CHANGE_PASSWORD',
      'REGISTER',
      'LOGIN'
    ]

    if (!type || !validTypes.includes(type)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '验证类型无效'
        },
        { status: 400 }
      )
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '用户不存在'
        },
        { status: 404 }
      )
    }

    // 发送验证码
    const result = await sendCode(user.email, type, auth.userId)

    if (!result.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: result.error
        },
        { status: 400 }
      )
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        message: '验证码已发送到您的邮箱，请查收',
        email: user.email.replace(/(.{2}).*(@.*)/, '$1***$2') // 隐藏部分邮箱
      }
    })
  } catch (error) {
    console.error('发送验证码错误:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '服务器错误'
      },
      { status: 500 }
    )
  }
})
