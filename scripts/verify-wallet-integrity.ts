/**
 * 钱包完整性验证脚本
 *
 * 验证目标:
 * 1. User.balance 与 Payment 记录计算的余额是否一致
 * 2. 检测数据不一致的用户
 * 3. 提供详细的诊断信息
 *
 * 运行方式:
 * ```bash
 * DATABASE_URL="your-db-url" npx tsx scripts/verify-wallet-integrity.ts
 * ```
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

// 计算 Payment 类型对余额的影响
function getBalanceImpact(type: string, amount: Prisma.Decimal): number {
  const value = Number(amount)

  switch (type) {
    case 'RELEASE':           // 收款入账（增加）
    case 'REFUND':            // 退款到账（增加）
    case 'ADMIN_ADJUSTMENT':  // 管理员调账（可增可减，默认增加）
      return value

    case 'ESCROW':            // 托管支付（减少）
    case 'WITHDRAW':          // 提现扣除（减少）
      return -value

    default:
      console.warn(`⚠️  未知的Payment类型: ${type}`)
      return 0
  }
}

// 从 Payment 记录计算余额
function calculateBalanceFromPayments(payments: Array<{ amount: Prisma.Decimal; type: string }>): number {
  return payments.reduce((balance, payment) => {
    return balance + getBalanceImpact(payment.type, payment.amount)
  }, 0)
}

async function verifyWalletIntegrity() {
  console.log('🔍 开始钱包完整性验证...\n')

  try {
    // 1. 获取所有用户
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        balance: true
      }
    })

    console.log(`📊 总用户数: ${users.length}\n`)

    let totalChecked = 0
    let totalPassed = 0
    let totalFailed = 0
    const failedUsers: Array<{
      userId: string
      email: string
      name: string | null
      actualBalance: number
      calculatedBalance: number
      diff: number
    }> = []

    // 2. 逐个验证用户余额
    for (const user of users) {
      totalChecked++

      // 2.1 获取该用户所有已完成的 Payment 记录
      const payments = await prisma.payment.findMany({
        where: {
          userId: user.id,
          status: 'COMPLETED'
        },
        select: {
          amount: true,
          type: true
        }
      })

      // 2.2 从 Payment 记录计算余额
      const calculatedBalance = calculateBalanceFromPayments(payments)
      const actualBalance = Number(user.balance)
      const diff = actualBalance - calculatedBalance

      // 2.3 检查是否一致（允许 0.01 的浮点数误差）
      if (Math.abs(diff) > 0.01) {
        totalFailed++
        failedUsers.push({
          userId: user.id,
          email: user.email,
          name: user.name,
          actualBalance,
          calculatedBalance,
          diff
        })
      } else {
        totalPassed++
      }

      // 2.4 显示进度
      if (totalChecked % 10 === 0) {
        process.stdout.write(`\r✓ 已检查 ${totalChecked}/${users.length} 用户...`)
      }
    }

    console.log(`\r✓ 已检查 ${totalChecked}/${users.length} 用户\n`)

    // 3. 输出验证结果
    console.log('=' .repeat(80))
    console.log('📋 验证结果汇总')
    console.log('=' .repeat(80))
    console.log(`总用户数:        ${totalChecked}`)
    console.log(`✅ 通过验证:     ${totalPassed} (${((totalPassed / totalChecked) * 100).toFixed(1)}%)`)
    console.log(`❌ 验证失败:     ${totalFailed} (${((totalFailed / totalChecked) * 100).toFixed(1)}%)`)
    console.log('=' .repeat(80))

    // 4. 如果有失败的用户，显示详细信息
    if (failedUsers.length > 0) {
      console.log('\n❌ 发现余额不一致的用户:\n')

      for (const failed of failedUsers) {
        console.log('─' .repeat(80))
        console.log(`用户: ${failed.name || '(未设置)'} (${failed.email})`)
        console.log(`用户ID: ${failed.userId}`)
        console.log(`实际余额:       ¥${failed.actualBalance.toFixed(2)}`)
        console.log(`计算余额:       ¥${failed.calculatedBalance.toFixed(2)}`)
        console.log(`差额:           ¥${failed.diff.toFixed(2)} ${failed.diff > 0 ? '(多余)' : '(不足)'}`)

        // 显示该用户的 Payment 记录统计
        const payments = await prisma.payment.findMany({
          where: {
            userId: failed.userId,
            status: 'COMPLETED'
          },
          select: {
            type: true,
            amount: true
          }
        })

        console.log(`\nPayment 记录统计:`)
        const stats: Record<string, { count: number; total: number }> = {}

        for (const payment of payments) {
          const type = payment.type
          if (!stats[type]) {
            stats[type] = { count: 0, total: 0 }
          }
          stats[type].count++
          stats[type].total += Number(payment.amount)
        }

        for (const [type, data] of Object.entries(stats)) {
          const impact = type === 'ESCROW' || type === 'WITHDRAW' ? '-' : '+'
          console.log(`  ${type.padEnd(20)} ${data.count.toString().padStart(3)} 笔  ${impact}¥${data.total.toFixed(2)}`)
        }
        console.log()
      }

      console.log('=' .repeat(80))
      console.log('\n💡 建议:')
      console.log('1. 检查上述用户的 Payment 记录是否完整')
      console.log('2. 确认是否有遗漏的财务操作')
      console.log('3. 使用 WalletService 进行统一的财务操作以避免不一致')
      console.log('\n')

      process.exit(1) // 失败退出
    } else {
      console.log('\n✅ 所有用户的余额都与 Payment 记录一致!\n')
      process.exit(0) // 成功退出
    }

  } catch (error) {
    console.error('\n❌ 验证过程出错:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行验证
verifyWalletIntegrity()
