import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, hashPassword, comparePassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const { oldPassword, newPassword } = body

    // 验证参数
    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: '旧密码和新密码不能为空' },
        { status: 400 }
      )
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: '新密码长度不能少于6位' },
        { status: 400 }
      )
    }

    if (oldPassword === newPassword) {
      return NextResponse.json(
        { success: false, error: '新密码不能与旧密码相同' },
        { status: 400 }
      )
    }

    // 查询用户
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    })

    if (!user) {
      return NextResponse.json(
        { success: false, error: '用户不存在' },
        { status: 404 }
      )
    }

    // 验证旧密码
    const isValidPassword = await comparePassword(oldPassword, user.password)
    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: '旧密码不正确' },
        { status: 400 }
      )
    }

    // 加密新密码
    const hashedPassword = await hashPassword(newPassword)

    // 更新密码
    await prisma.user.update({
      where: { id: payload.userId },
      data: { password: hashedPassword }
    })

    return NextResponse.json({
      success: true,
      message: '密码修改成功'
    })

  } catch (error) {
    console.error('修改密码失败:', error)
    return NextResponse.json(
      { success: false, error: '服务器错误' },
      { status: 500 }
    )
  }
}
