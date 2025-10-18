import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { apiLimiter, checkRateLimit } from '@/lib/ratelimit'
import { ApiResponse } from '@/types'

/**
 * 获取当前用户的账务记录
 * GET /api/user/transactions
 *
 * 查询参数:
 * - type: 账务类型筛选 (ESCROW/RELEASE/REFUND/WITHDRAW)
 * - limit: 每页数量 (默认20，最大100)
 * - offset: 分页偏移量 (默认0)
 */
export async function GET(request: NextRequest) {
  try {
    // 认证检查
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

    // 限流保护
    const rateLimitResult = await checkRateLimit(
      apiLimiter,
      `api:${payload.userId}:transactions`
    )
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    // 解析查询参数
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || undefined
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)
    const offset = parseInt(searchParams.get('offset') || '0')

    // 构建查询条件
    const where: any = {
      userId: payload.userId
    }

    // 按类型筛选
    if (type && ['ESCROW', 'RELEASE', 'REFUND', 'WITHDRAW'].includes(type)) {
      where.type = type
    }

    // 查询账务记录
    const [transactions, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNo: true,
              vehicleBrand: true,
              vehicleModel: true,
              status: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: limit,
        skip: offset
      }),
      prisma.payment.count({ where })
    ])

    // 返回结果
    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          limit,
          offset,
          hasMore: offset + limit < total
        }
      }
    })
  } catch (error) {
    console.error('获取账务记录错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
