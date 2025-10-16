import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// 获取管理后台统计数据
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

    // 获取统计数据
    const [
      totalUsers,
      totalOrders,
      activeOrders,
      completedOrders,
      pendingDisputes,
      platformFeeSum
    ] = await Promise.all([
      // 总用户数
      prisma.user.count(),

      // 总订单数
      prisma.order.count(),

      // 进行中订单（PUBLISHED, PAID, TRANSFERRING状态）
      prisma.order.count({
        where: {
          status: {
            in: ['PUBLISHED', 'PAID', 'TRANSFERRING']
          }
        }
      }),

      // 已完成订单
      prisma.order.count({
        where: {
          status: 'COMPLETED'
        }
      }),

      // 待处理申诉
      prisma.dispute.count({
        where: {
          status: 'PENDING'
        }
      }),

      // 平台总收益（已完成订单的手续费总和）
      prisma.order.aggregate({
        where: {
          status: 'COMPLETED'
        },
        _sum: {
          platformFee: true
        }
      })
    ])

    const stats = {
      totalUsers,
      totalOrders,
      activeOrders,
      completedOrders,
      pendingDisputes,
      totalRevenue: platformFeeSum._sum.platformFee || 0
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('获取统计数据错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
