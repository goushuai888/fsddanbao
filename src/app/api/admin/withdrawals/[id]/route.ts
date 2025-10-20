/**
 * 管理员提现审核API（使用统一认证中间件）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { adminOnly } from '@/lib/infrastructure/middleware/auth'
import { logAudit, AUDIT_ACTIONS } from '@/lib/infrastructure/audit/audit-logger'
import { walletService } from '@/lib/domain/finance/WalletService'
import { FinancialError } from '@/lib/domain/finance/types'
import { ApiResponse } from '@/types'

/**
 * PATCH /api/admin/withdrawals/[id] - 审核提现申请
 *
 * 认证要求: 管理员权限
 * 操作类型:
 * - approve: 批准提现
 * - reject: 拒绝提现（恢复余额）
 * - processing: 标记为处理中
 * - complete: 完成提现
 * - fail: 标记为失败（恢复余额）
 */
export const PATCH = adminOnly(async (request, { params }, auth) => {
  try {
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
          reviewedBy: auth.userId,
          reviewNote,
          reviewedAt: new Date()
        }
      })

      // 记录审计日志
      await logAudit({
        userId: auth.userId,
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
      // 拒绝提现（使用WalletService恢复余额+同步Payment状态）
      if (!rejectReason) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '请填写拒绝原因'
        }, { status: 400 })
      }

      try {
        // 使用WalletService执行提现退款（创建REFUND Payment + 恢复余额 + 更新原Payment状态）
        await walletService.refundWithdrawal({
          withdrawalId: id,
          reason: rejectReason,
          adminUserId: auth.userId,
          note: reviewNote
        })

        // 更新提现申请状态
        await prisma.withdrawal.update({
          where: { id },
          data: {
            status: 'REJECTED',
            reviewedBy: auth.userId,
            reviewNote,
            rejectReason,
            reviewedAt: new Date()
          }
        })
      } catch (error) {
        if (error instanceof FinancialError) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: `拒绝提现失败: ${error.message}`
          }, { status: 400 })
        }
        throw error
      }

      // 注意: 审计日志已由walletService.refundWithdrawal()自动记录

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
      // 完成提现（同步更新Withdrawal和Payment状态）
      if (!transactionId) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '请填写交易ID'
        }, { status: 400 })
      }

      // 在事务中更新Withdrawal和关联的Payment状态
      await prisma.$transaction(async (tx) => {
        // 1. 更新Withdrawal状态
        await tx.withdrawal.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            transactionId,
            completedAt: new Date()
          }
        })

        // 2. 更新关联的WITHDRAW Payment状态为COMPLETED
        await tx.payment.updateMany({
          where: {
            withdrawalId: id,
            type: 'WITHDRAW'
          },
          data: {
            status: 'COMPLETED'
          }
        })
      })

      // 记录审计日志
      await logAudit({
        userId: auth.userId,
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
      // 标记为失败（使用WalletService恢复余额+同步Payment状态）
      try {
        // 使用WalletService执行提现退款（创建REFUND Payment + 恢复余额 + 更新原Payment状态）
        await walletService.refundWithdrawal({
          withdrawalId: id,
          reason: '提现处理失败',
          adminUserId: auth.userId,
          note: reviewNote || '银行转账失败或其他技术问题'
        })

        // 更新提现申请状态
        await prisma.withdrawal.update({
          where: { id },
          data: {
            status: 'FAILED',
            reviewNote
          }
        })
      } catch (error) {
        if (error instanceof FinancialError) {
          return NextResponse.json<ApiResponse>({
            success: false,
            error: `标记提现失败操作失败: ${error.message}`
          }, { status: 400 })
        }
        throw error
      }

      // 注意: 审计日志已由walletService.refundWithdrawal()自动记录

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
})
