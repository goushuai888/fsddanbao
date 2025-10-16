import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, generateToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '请输入邮箱和密码'
      }, { status: 400 })
    }

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
