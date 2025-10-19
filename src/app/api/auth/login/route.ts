import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { comparePassword, generateToken } from '@/lib/infrastructure/auth/jwt'
import { authLimiter, getClientIp, checkRateLimit } from '@/lib/infrastructure/security/ratelimit'
import { loginSchema } from '@/lib/validations/auth'
import { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // 安全修复: 请求限流 - 防止暴力破解（5次/分钟）
    const ip = getClientIp(request)
    const rateLimitResult = await checkRateLimit(authLimiter, `login:${ip}`)
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    const body = await request.json()

    // 安全修复: 输入验证 - 使用Zod统一验证
    const validation = loginSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { email, password } = validation.data

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '邮箱或密码错误'
      }, { status: 401 })
    }

    // 验证密码
    const isValidPassword = await comparePassword(password, user.password)
    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '邮箱或密码错误'
      }, { status: 401 })
    }

    // 生成token
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          phone: user.phone,
          role: user.role,
          verified: user.verified,
          balance: user.balance
        },
        token
      },
      message: '登录成功'
    })
  } catch (error) {
    console.error('登录错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
