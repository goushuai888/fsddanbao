import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, generateToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone, role } = await request.json()

    // 验证必填字段
    if (!email || !password) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '邮箱和密码为必填项'
      }, { status: 400 })
    }

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
