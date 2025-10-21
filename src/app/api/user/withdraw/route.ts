/**
 * 用户提现申请 API
 *
 * POST /api/user/withdraw
 *
 * 认证要求: 已登录用户
 * 请求体:
 * - amount: 提现金额
 * - withdrawMethod: 提现方式 (bank/alipay/wechat)
 * - bankName, bankAccount, accountName: 银行卡信息（method=bank时必需）
 * - alipayAccount: 支付宝账号（method=alipay时必需）
 * - wechatAccount: 微信账号（method=wechat时必需）
 * - verificationCode: 邮箱验证码
 */

import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/infrastructure/middleware/auth'
import { apiLimiter, checkRateLimit } from '@/lib/infrastructure/security/ratelimit'
import { verifyCode } from '@/lib/services/verification-code'
import { logAudit, AUDIT_ACTIONS } from '@/lib/infrastructure/audit/audit-logger'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { ApiResponse } from '@/types'

export const POST = withAuth(async (request, context, auth) => {
  try {
    // 限流保护: 每个用户每小时最多申请3次提现
    const rateLimitResult = await checkRateLimit(
      apiLimiter,
      `api:${auth.userId}:withdraw`
    )
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    // 解析请求体
    const body = await request.json()
    const {
      amount,
      withdrawMethod,
      bankName,
      bankAccount,
      accountName,
      alipayAccount,
      wechatAccount,
      verificationCode
    } = body

    // 参数验证
    if (!amount || amount <= 0) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '提现金额无效'
        },
        { status: 400 }
      )
    }

    if (!withdrawMethod || !['bank', 'alipay', 'wechat'].includes(withdrawMethod)) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '提现方式无效'
        },
        { status: 400 }
      )
    }

    // 验证验证码
    if (!verificationCode) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '请输入邮箱验证码'
        },
        { status: 400 }
      )
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { email: true, balance: true }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '用户不存在'
        },
        { status: 404 }
      )
    }

    // 验证验证码
    const codeVerification = await verifyCode(user.email, verificationCode, 'WITHDRAWAL')
    if (!codeVerification.success) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: codeVerification.error || '验证码验证失败'
        },
        { status: 400 }
      )
    }

    // 检查余额
    if (Number(user.balance) < amount) {
      return NextResponse.json<ApiResponse>(
        {
          success: false,
          error: '余额不足'
        },
        { status: 400 }
      )
    }

    // 计算手续费（2%）
    const fee = amount * 0.02
    const actualAmount = amount - fee

    // ✅ 使用事务：扣除余额 + 创建提现记录 + 创建账务记录
    const withdrawal = await prisma.$transaction(async (tx) => {
      console.log('[提现] 开始事务执行...')

      // 1. 扣除用户余额
      console.log('[提现] 扣除用户余额:', amount)
      const updatedUser = await tx.user.update({
        where: { id: auth.userId },
        data: {
          balance: {
            decrement: amount
          }
        }
      })
      console.log('[提现] 余额已扣除，新余额:', updatedUser.balance)

      // 2. 创建提现申请
      console.log('[提现] 创建Withdrawal记录...')
      const newWithdrawal = await tx.withdrawal.create({
        data: {
          userId: auth.userId,
          amount,
          fee,
          actualAmount,
          withdrawMethod,
          bankName: withdrawMethod === 'bank' ? bankName : null,
          bankAccount: withdrawMethod === 'bank' ? bankAccount : null,
          accountName: withdrawMethod === 'bank' ? accountName : null,
          alipayAccount: withdrawMethod === 'alipay' ? alipayAccount : null,
          wechatAccount: withdrawMethod === 'wechat' ? wechatAccount : null,
          status: 'PENDING'
        }
      })
      console.log('[提现] Withdrawal已创建:', newWithdrawal.id)

      // 3. 创建账务记录（WITHDRAW类型）
      console.log('[提现] 创建Payment记录...')
      const payment = await tx.payment.create({
        data: {
          userId: auth.userId,
          amount,
          type: 'WITHDRAW',
          status: 'PENDING',
          withdrawalId: newWithdrawal.id,  // ✅ 修复: 关联Withdrawal记录
          note: `提现申请 - ${withdrawMethod === 'bank' ? '银行卡' : withdrawMethod === 'alipay' ? '支付宝' : '微信'}`
        }
      })
      console.log('[提现] Payment已创建:', payment.id)

      console.log('[提现] 事务执行完成')
      return newWithdrawal
    })

    // 审计日志
    await logAudit({
      userId: auth.userId,
      action: 'CREATE_WITHDRAWAL',
      target: withdrawal.id,
      targetType: 'Withdrawal',
      newValue: {
        amount,
        withdrawMethod,
        status: 'PENDING'
      },
      description: `申请提现 ¥${amount}`,
      req: request
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: {
        withdrawal,
        message: '提现申请已提交，请等待审核'
      }
    })
  } catch (error) {
    console.error('提现申请错误:', error)
    return NextResponse.json<ApiResponse>(
      {
        success: false,
        error: '服务器错误'
      },
      { status: 500 }
    )
  }
})
