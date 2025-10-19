import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { ApiResponse } from '@/types'

// 获取申诉统计数据（用于通知）
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

    // 获取待处理数量
    const pendingCount = await prisma.dispute.count({
      where: {
        status: 'PENDING'
      }
    })

    // 获取处理中数量
    const processingCount = await prisma.dispute.count({
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
    console.error('获取申诉统计错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
