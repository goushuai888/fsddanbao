import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// 获取当前用户信息
export async function GET(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json(
        { success: false, error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token无效或已过期' },
        { status: 401 }
      )
    }

    // 查询用户信息（排除密码）
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
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
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: user
    })

  } catch (error) {
    console.error('获取用户信息失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}

// 更新用户信息
export async function PATCH(request: NextRequest) {
  try {
    // 验证用户身份
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json(
        { success: false, error: '未授权，请先登录' },
        { status: 401 }
      )
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Token无效或已过期' },
        { status: 401 }
      )
    }

    // 获取请求参数
    const body = await request.json()
    const { name, phone, avatar } = body

    // 构建更新数据对象
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (avatar !== undefined) updateData.avatar = avatar

    // 验证至少有一个字段需要更新
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { success: false, error: '没有需要更新的字段' },
        { status: 400 }
      )
    }

    // 更新用户信息
    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
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

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: '个人信息更新成功'
    })

  } catch (error) {
    console.error('更新用户信息失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
