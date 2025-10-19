/**
 * 密码修改API（使用统一认证中间件）
 */

import { NextResponse } from 'next/server'
import { hashPassword, comparePassword } from '@/lib/infrastructure/auth/jwt'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { withAuth } from '@/lib/infrastructure/middleware/auth'
import { ApiResponse } from '@/types'

/**
 * PATCH /api/user/password - 修改用户密码
 *
 * 认证要求: 已登录用户
 * 请求体: { oldPassword: string, newPassword: string }
 */
export const PATCH = withAuth(async (request, context, auth) => {
  try {
    // 获取请求参数
    const body = await request.json()
    const { oldPassword, newPassword } = body

    // 验证参数
    if (!oldPassword || !newPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '旧密码和新密码不能为空' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '新密码长度不能少于6位' },
        { status: 400 }
      )
    }

    if (oldPassword === newPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '新密码不能与旧密码相同' },
        { status: 400 }
      )
    }

    // 查询用户
    const user = await prisma.user.findUnique({
      where: { id: auth.userId }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 验证旧密码
    const isValidPassword = await comparePassword(oldPassword, user.password)
    if (!isValidPassword) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: '旧密码不正确' },
        { status: 400 }
      )
    }

    // 加密新密码
    const hashedPassword = await hashPassword(newPassword)

    // 更新密码
    await prisma.user.update({
      where: { id: auth.userId },
      data: { password: hashedPassword }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '密码修改成功'
    })

  } catch (error) {
    console.error('修改密码失败:', error)
    return NextResponse.json<ApiResponse>(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
})
