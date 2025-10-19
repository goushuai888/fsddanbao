import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { logAudit, AUDIT_ACTIONS } from '@/lib/infrastructure/audit/audit-logger'
import { ApiResponse } from '@/types'

// 处理退款申请
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
    const { action, note } = body

    const order = await prisma.order.findUnique({
      where: { id: params.id }
    })

    if (!order) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '订单不存在'
      }, { status: 404 })
    }

    if (!order.refundRequested) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该订单没有退款申请'
      }, { status: 400 })
    }

    if (order.refundStatus !== 'PENDING') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该退款申请已处理'
      }, { status: 400 })
    }

    let updatedOrder

    if (action === 'approve') {
      // 同意退款 - 退款给买家
      updatedOrder = await prisma.order.update({
        where: { id: params.id },
        data: {
          refundStatus: 'APPROVED',
          status: 'CANCELLED',
          cancelledAt: new Date()
        }
      })

      // 创建退款记录
      if (order.buyerId) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            userId: order.buyerId,
            amount: order.escrowAmount || order.price,
            type: 'REFUND',
            status: 'COMPLETED',
            note: note || '管理员批准退款申请'
          }
        })
      }

      // 记录审计日志
      await logAudit({
        userId: payload.userId,
        action: AUDIT_ACTIONS.APPROVE_REFUND,
        target: params.id,
        targetType: 'Order',
        oldValue: {
          refundStatus: 'PENDING',
          orderStatus: order.status
        },
        newValue: {
          refundStatus: 'APPROVED',
          orderStatus: 'CANCELLED'
        },
        description: `批准退款申请`,
        req: request
      })
    } else if (action === 'reject') {
      // 拒绝退款 - 订单保持已支付状态
      updatedOrder = await prisma.order.update({
        where: { id: params.id },
        data: {
          refundStatus: 'REJECTED'
        }
      })

      // 记录审计日志
      await logAudit({
        userId: payload.userId,
        action: AUDIT_ACTIONS.REJECT_REFUND,
        target: params.id,
        targetType: 'Order',
        oldValue: {
          refundStatus: 'PENDING',
          orderStatus: order.status
        },
        newValue: {
          refundStatus: 'REJECTED',
          orderStatus: order.status
        },
        description: `拒绝退款申请`,
        req: request
      })
    } else {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的操作'
      }, { status: 400 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: updatedOrder,
      message: action === 'approve' ? '已批准退款' : '已拒绝退款'
    })
  } catch (error) {
    console.error('处理退款申请错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
