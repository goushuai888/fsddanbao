/**
 * 验证验证码 API
 *
 * POST /api/verification/verify
 *
 * 认证要求: 已登录用户
 * 请求体:
 * - code: 6位验证码
 * - type: 验证类型 (WITHDRAWAL/CHANGE_EMAIL/LARGE_PAYMENT等)
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/infrastructure/middleware/auth'
import { apiLimiter, checkRateLimit } from '@/lib/infrastructure/security/ratelimit'
import { verifyCode, type VerificationType } from '@/lib/services/verification-code'
import { ApiResponse } from '@/types'
import { prisma } from '@/lib/infrastructure/database/prisma'

export const POST = withAuth(async (request, context, auth) => {
  try {
    // 限流保护: 每个用户每分钟最多验证5次
    const rateLimitResult = await checkRateLimit(
      apiLimiter,
      `api:${auth.userId}:verify-code`
    )
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    // 解析请求体
    const body = await request.json()
    const { code, type } = body

    // 验证参数
    if (!code || !type) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '参数不完整'
        },
        { status: 400 }
      )
    }

    // 验证code格式（6位数字）
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '验证码格式错误'
        },
        { status: 400 }
      )
    }

    // 验证type参数
    const validTypes: VerificationType[] = [
      'WITHDRAWAL',
      'CHANGE_EMAIL',
      'LARGE_PAYMENT',
      'CHANGE_PASSWORD',
      'REGISTER',
      'LOGIN'
    ]

    if (!validTypes.includes(type)) {
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

    // 验证验证码
    const result = await verifyCode(user.email, code, type)

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
        message: '验证成功'
      }
    })
  } catch (error) {
    console.error('验证验证码错误:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '服务器错误'
      },
      { status: 500 }
    )
  }
})
