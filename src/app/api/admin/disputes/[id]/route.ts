import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// 处理申诉
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const body = await request.json()
    const { action, resolution } = body

    const dispute = await prisma.dispute.findUnique({
      where: { id: params.id },
      include: {
        order: true
      }
    })

    if (!dispute) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '申诉不存在'
      }, { status: 404 })
    }

    if (dispute.status !== 'PENDING') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该申诉已处理'
      }, { status: 400 })
    }

    let updatedDispute
    let updatedOrder

    if (action === 'approve') {
      // 同意申诉 - 退款给买家
      updatedDispute = await prisma.dispute.update({
        where: { id: params.id },
        data: {
          status: 'RESOLVED',
          resolution: resolution || '管理员同意申诉，订单已取消并退款给买家',
          resolvedBy: payload.userId,
          resolvedAt: new Date()
        }
      })

      // 更新订单状态为已取消
      updatedOrder = await prisma.order.update({
        where: { id: dispute.orderId },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      })

      // 创建退款记录
      if (dispute.order.buyerId) {
        await prisma.payment.create({
          data: {
            orderId: dispute.order.id,
            userId: dispute.order.buyerId,
            amount: dispute.order.escrowAmount || dispute.order.price,
            type: 'REFUND',
            status: 'COMPLETED',
            note: '申诉处理-退款给买家'
          }
        })
      }
    } else if (action === 'reject') {
      // 拒绝申诉 - 款项释放给卖家，订单完成
      updatedDispute = await prisma.dispute.update({
        where: { id: params.id },
        data: {
          status: 'CLOSED',
          resolution: resolution || '管理员拒绝申诉，认定交易正常完成',
          resolvedBy: payload.userId,
          resolvedAt: new Date()
        }
      })

      // 更新订单状态为已完成
      updatedOrder = await prisma.order.update({
        where: { id: dispute.orderId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      // 释放款项给卖家
      await prisma.payment.create({
        data: {
          orderId: dispute.order.id,
          userId: dispute.order.sellerId,
          amount: dispute.order.price - (dispute.order.platformFee || 0),
          type: 'RELEASE',
          status: 'COMPLETED',
          note: '申诉被拒-释放款项给卖家'
        }
      })
    } else {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的操作'
      }, { status: 400 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: { dispute: updatedDispute, order: updatedOrder },
      message: action === 'approve' ? '已同意申诉并退款' : '已拒绝申诉并完成订单'
    })
  } catch (error) {
    console.error('处理申诉错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
