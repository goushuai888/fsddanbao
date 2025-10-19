/**
 * 用户资料API路由（使用统一认证中间件）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { withAuth } from '@/lib/infrastructure/middleware/auth'
import { ApiResponse } from '@/types'

/**
 * GET /api/user/profile - 获取当前用户信息
 *
 * 认证要求: 已登录用户
 */
export const GET = withAuth(async (request, context, auth) => {
  try {
    // 查询用户信息（排除密码）
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        updatedAt: true
      }
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

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user
    })

  } catch (error) {
    console.error('获取用户信息失败:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '服务器错误'
      },
      { status: 500 }
    )
  }
})

/**
 * PATCH /api/user/profile - 更新用户信息
 *
 * 认证要求: 已登录用户
 * 可更新字段: name, phone, avatar
 */
export const PATCH = withAuth(async (request, context, auth) => {
  try {
    // 获取请求参数
    const body = await request.json()
    const { name, phone, avatar } = body

    // 构建更新数据对象（只更新提供的字段）
    const updateData: Partial<{
      name: string | null
      phone: string | null
      avatar: string | null
    }> = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (avatar !== undefined) updateData.avatar = avatar

    // 验证至少有一个字段需要更新
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '没有需要更新的字段'
        },
        { status: 400 }
      )
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: auth.userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        avatar: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        updatedAt: true
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedUser,
      message: '个人信息更新成功'
    })

  } catch (error) {
    console.error('更新用户信息失败:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '服务器错误'
      },
      { status: 500 }
    )
  }
})
