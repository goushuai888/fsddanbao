import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken } from '@/lib/auth'
import { ApiResponse } from '@/types'

// 获取用户的提现申请列表
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
    if (!payload) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的token'
      }, { status: 401 })
    }

    const withdrawals = await prisma.withdrawal.findMany({
      where: {
        userId: payload.userId
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
}

// 创建提现申请
export async function POST(request: NextRequest) {
  try {
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
      where: { id: payload.userId }
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
          userId: payload.userId,
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
        where: { id: payload.userId },
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
}
