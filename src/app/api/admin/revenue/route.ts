import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// 获取收益统计数据
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || 'day' // day, week, month

    // 构建日期范围
    let dateFilter: any = {
      status: 'COMPLETED'
    }

    if (startDate || endDate) {
      dateFilter.completedAt = {}
      if (startDate) {
        dateFilter.completedAt.gte = new Date(startDate)
      }
      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setHours(23, 59, 59, 999)
        dateFilter.completedAt.lte = endDateTime
      }
    }

    // 获取总收益和订单统计
    const [
      totalRevenue,
      totalOrders,
      avgOrderValue,
      completedOrders
    ] = await Promise.all([
      // 总收益（已完成订单的手续费总和）
      prisma.order.aggregate({
        where: dateFilter,
        _sum: {
          platformFee: true
        }
      }),

      // 总订单数
      prisma.order.count({
        where: dateFilter
      }),

      // 平均订单价值
      prisma.order.aggregate({
        where: dateFilter,
        _avg: {
          price: true
        }
      }),

      // 获取所有已完成订单用于趋势分析
      prisma.order.findMany({
        where: dateFilter,
        select: {
          completedAt: true,
          platformFee: true,
          price: true
        },
        orderBy: {
          completedAt: 'asc'
        }
      })
    ])

    // 按时间段分组统计
    const revenueByPeriod: Record<string, { revenue: number; orders: number }> = {}

    completedOrders.forEach(order => {
      if (!order.completedAt) return

      let key: string
      const date = new Date(order.completedAt)

      if (period === 'day') {
        key = date.toISOString().split('T')[0] // YYYY-MM-DD
      } else if (period === 'week') {
        const year = date.getFullYear()
        const week = getWeekNumber(date)
        key = `${year}-W${week.toString().padStart(2, '0')}`
      } else { // month
        key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
      }

      if (!revenueByPeriod[key]) {
        revenueByPeriod[key] = { revenue: 0, orders: 0 }
      }

      revenueByPeriod[key].revenue += Number(order.platformFee || 0)
      revenueByPeriod[key].orders += 1
    })

    // 转换为数组格式
    const trendData = Object.entries(revenueByPeriod)
      .map(([period, data]) => ({
        period,
        revenue: data.revenue,
        orders: data.orders
      }))
      .sort((a, b) => a.period.localeCompare(b.period))

    // 获取各状态订单数量
    const ordersByStatus = await prisma.order.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    })

    const stats = {
      totalRevenue: Number(totalRevenue._sum.platformFee || 0),
      totalOrders,
      avgOrderValue: Number(avgOrderValue._avg.price || 0),
      trendData,
      ordersByStatus: ordersByStatus.map(item => ({
        status: item.status,
        count: item._count.status
      }))
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('获取收益统计错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}

// 获取周数的辅助函数
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}
