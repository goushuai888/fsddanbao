import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { ApiResponse } from '@/types'

// 获取管理员订单列表
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
    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无权访问'
      }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    // 构建查询条件
    const where: any = {}

    // 状态筛选
    if (status && status !== 'all') {
      where.status = status
    }

    // 搜索条件（订单号、买家邮箱、卖家邮箱、车辆信息）
    if (search) {
      where.OR = [
        { orderNo: { contains: search } },
        { vehicleBrand: { contains: search } },
        { vehicleModel: { contains: search } },
        { seller: { email: { contains: search } } },
        { seller: { name: { contains: search } } },
        { buyer: { email: { contains: search } } },
        { buyer: { name: { contains: search } } }
      ]
    }

    // 日期范围筛选
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        // 结束日期包含当天的23:59:59
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        where.createdAt.lte = endDateTime
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        seller: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        buyer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        _count: {
          select: {
            disputes: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: orders
    })
  } catch (error) {
    console.error('获取订单列表错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
