import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// 获取提现统计数据（用于通知）
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

    // 获取待审核数量
    const pendingCount = await prisma.withdrawal.count({
      where: {
        status: 'PENDING'
      }
    })

    // 获取处理中数量
    const processingCount = await prisma.withdrawal.count({
      where: {
        status: 'PROCESSING'
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        pendingCount,
        processingCount,
        totalNeedAttention: pendingCount + processingCount
      }
    })
  } catch (error) {
    console.error('获取提现统计错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
