/**
 * 提现申请API（使用统一认证中间件）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { withAuth } from '@/lib/infrastructure/middleware/auth'
import { ApiResponse } from '@/types'

/**
 * GET /api/withdrawals - 获取用户的提现申请列表
 *
 * 认证要求: 已登录用户
 */
export const GET = withAuth(async (request, context, auth) => {
  try {
    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        userId: auth.userId
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: withdrawals
    })
  } catch (error) {
    console.error('获取提现记录错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
})

/**
 * POST /api/withdrawals - 创建提现申请
 *
 * 认证要求: 已登录用户
 * 请求体: {
 *   amount: number,
 *   withdrawMethod: 'bank' | 'alipay' | 'wechat',
 *   bankName?: string,
 *   bankAccount?: string,
 *   accountName?: string,
 *   alipayAccount?: string,
 *   wechatAccount?: string
 * }
 */
export const POST = withAuth(async (request, context, auth) => {
  try {
    const body = await request.json()
    const {
      amount,
      withdrawMethod,
      bankName,
      bankAccount,
      accountName,
      alipayAccount,
      wechatAccount
    } = body

    // 验证必填字段
    if (!amount || amount <= 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '提现金额必须大于0'
      }, { status: 400 })
    }

    if (!withdrawMethod) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '请选择提现方式'
      }, { status: 400 })
    }

    // 根据提现方式验证收款信息
    if (withdrawMethod === 'bank' && (!bankName || !bankAccount || !accountName)) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '请完整填写银行账户信息'
      }, { status: 400 })
    }

    if (withdrawMethod === 'alipay' && !alipayAccount) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '请填写支付宝账号'
      }, { status: 400 })
    }

    if (withdrawMethod === 'wechat' && !wechatAccount) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '请填写微信账号'
      }, { status: 400 })
    }

    // 获取用户信息
    const user = await prisma.user.findUnique({
      where: { id: auth.userId }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 检查余额是否足够
    if (user.balance < amount) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '账户余额不足'
      }, { status: 400 })
    }

    // 计算手续费（假设手续费为提现金额的1%）
    const fee = amount * 0.01
    const actualAmount = amount - fee

    // 使用事务：创建提现申请并立即扣除余额
    const withdrawal = await prisma.$transaction(async (tx) => {
      // 创建提现申请
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

      // 立即扣除用户余额（冻结资金）
      await tx.user.update({
        where: { id: auth.userId },
        data: {
          balance: {
            decrement: amount
          }
        }
      })

      return newWithdrawal
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: withdrawal,
      message: '提现申请已提交，余额已冻结，等待管理员审核'
    })
  } catch (error) {
    console.error('创建提现申请错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
})
