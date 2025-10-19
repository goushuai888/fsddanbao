import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { hashPassword, generateToken } from '@/lib/infrastructure/auth/jwt'
import { authLimiter, getClientIp, checkRateLimit } from '@/lib/infrastructure/security/ratelimit'
import { registerSchema } from '@/lib/validations/auth'
import { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    // 安全修复: 请求限流 - 防止恶意注册（5次/分钟）
    const ip = getClientIp(request)
    const rateLimitResult = await checkRateLimit(authLimiter, `register:${ip}`)
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    const body = await request.json()

    // 安全修复: 输入验证 - 使用Zod统一验证
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { email, password, name, phone, role } = validation.data

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该邮箱已被注册'
      }, { status: 400 })
    }

    // 加密密码
    const hashedPassword = await hashPassword(password)

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role: role || 'BUYER'
      }
    })

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
          verified: user.verified
        },
        token
      },
      message: '注册成功'
    })
  } catch (error) {
    console.error('注册错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
