import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { ApiResponse } from '@/types'

// 获取用户列表（仅管理员）
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '未授权'
      }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的token'
      }, { status: 401 })
    }

    // 检查是否为管理员
    if (payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权访问'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const verified = searchParams.get('verified')
    const search = searchParams.get('search')

    // 构建查询条件
    const where: any = {}

    if (role && role !== 'all') {
      where.role = role
    }

    if (verified && verified !== 'all') {
      where.verified = verified === 'true'
    }

    if (search) {
      where.OR = [
        { email: { contains: search } },
        { name: { contains: search } },
        { phone: { contains: search } }
      ]
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
        sellOrders: {
          where: {
            status: 'COMPLETED'
          },
          select: {
            id: true
          }
        },
        buyOrders: {
          where: {
            status: 'COMPLETED'
          },
          select: {
            id: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // 转换数据格式，将订单数组转换为计数
    const usersWithCount = users.map(user => ({
      ...user,
      _count: {
        sellOrders: user.sellOrders.length,
        buyOrders: user.buyOrders.length
      },
      sellOrders: undefined,
      buyOrders: undefined
    }))

    return NextResponse.json<ApiResponse>({
      success: true,
      data: usersWithCount
    })
  } catch (error) {
    console.error('获取用户列表错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
