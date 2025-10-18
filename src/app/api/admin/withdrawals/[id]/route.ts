import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit'
import { ApiResponse } from '@/types'

// 审核提现申请
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

    const { id } = params
    const body = await request.json()
    const { action, reviewNote, rejectReason, transactionId } = body

    // 获取提现申请
    const withdrawal = await prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: true
      }
    })

    if (!withdrawal) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '提现申请不存在'
      }, { status: 404 })
    }

    // 处理不同的操作
    if (action === 'approve' || action === 'reject') {
      // PENDING状态才能批准或拒绝
      if (withdrawal.status !== 'PENDING') {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '该提现申请已被处理'
        }, { status: 400 })
      }
    } else if (action === 'processing') {
      // APPROVED状态才能标记为处理中
      if (withdrawal.status !== 'APPROVED') {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '只有已批准的申请才能标记为处理中'
        }, { status: 400 })
      }
    } else if (action === 'complete' || action === 'fail') {
      // APPROVED或PROCESSING状态才能完成或失败
      if (withdrawal.status !== 'APPROVED' && withdrawal.status !== 'PROCESSING') {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '只有已批准或处理中的申请才能完成或标记为失败'
        }, { status: 400 })
      }
    }

    if (action === 'approve') {
      // 批准提现（余额已在申请时扣除，这里只需要更新状态）
      await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: payload.userId,
          reviewNote,
          reviewedAt: new Date()
        }
      })

      // 记录审计日志
      await logAudit({
        userId: payload.userId,
        action: AUDIT_ACTIONS.APPROVE_WITHDRAWAL,
        target: id,
        targetType: 'Withdrawal',
        oldValue: { status: 'PENDING' },
        newValue: {
          status: 'APPROVED',
          amount: withdrawal.amount,
          reviewNote
        },
        description: `批准提现申请，金额: ${withdrawal.amount}`,
        req: request
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        message: '已批准提现申请'
      })
    } else if (action === 'reject') {
      // 拒绝提现（需要恢复用户余额）
      if (!rejectReason) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '请填写拒绝原因'
        }, { status: 400 })
      }

      await prisma.$transaction([
        // 更新提现申请状态
        prisma.withdrawal.update({
          where: { id },
          data: {
            status: 'REJECTED',
            reviewedBy: payload.userId,
            reviewNote,
            rejectReason,
            reviewedAt: new Date()
          }
        }),
        // 恢复用户余额
        prisma.user.update({
          where: { id: withdrawal.userId },
          data: {
            balance: {
              increment: withdrawal.amount
            }
          }
        })
      ])

      // 记录审计日志
      await logAudit({
        userId: payload.userId,
        action: AUDIT_ACTIONS.REJECT_WITHDRAWAL,
        target: id,
        targetType: 'Withdrawal',
        oldValue: { status: 'PENDING' },
        newValue: {
          status: 'REJECTED',
          rejectReason
        },
        description: `拒绝提现申请: ${rejectReason}`,
        req: request
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        message: '已拒绝提现申请，用户余额已恢复'
      })
    } else if (action === 'processing') {
      // 标记为处理中
      await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'PROCESSING'
        }
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        message: '提现申请已标记为处理中'
      })
    } else if (action === 'complete') {
      // 完成提现
      if (!transactionId) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '请填写交易ID'
        }, { status: 400 })
      }

      await prisma.withdrawal.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          transactionId,
          completedAt: new Date()
        }
      })

      // 记录审计日志
      await logAudit({
        userId: payload.userId,
        action: AUDIT_ACTIONS.COMPLETE_WITHDRAWAL,
        target: id,
        targetType: 'Withdrawal',
        oldValue: { status: withdrawal.status },
        newValue: {
          status: 'COMPLETED',
          transactionId
        },
        description: `完成提现，交易ID: ${transactionId}`,
        req: request
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        message: '提现已完成'
      })
    } else if (action === 'fail') {
      // 标记为失败，恢复用户余额
      await prisma.$transaction([
        prisma.withdrawal.update({
          where: { id },
          data: {
            status: 'FAILED',
            reviewNote
          }
        }),
        prisma.user.update({
          where: { id: withdrawal.userId },
          data: {
            balance: {
              increment: withdrawal.amount
            }
          }
        })
      ])

      // 记录审计日志
      await logAudit({
        userId: payload.userId,
        action: AUDIT_ACTIONS.FAIL_WITHDRAWAL,
        target: id,
        targetType: 'Withdrawal',
        oldValue: { status: withdrawal.status },
        newValue: {
          status: 'FAILED',
          reviewNote
        },
        description: `提现失败，已恢复用户余额`,
        req: request
      })

      return NextResponse.json<ApiResponse>({
        success: true,
        message: '提现已标记为失败，用户余额已恢复'
      })
    } else {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的操作'
      }, { status: 400 })
    }
  } catch (error) {
    console.error('审核提现申请错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
