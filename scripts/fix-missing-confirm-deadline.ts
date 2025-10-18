/**
 * 修复缺失confirmDeadline的TRANSFERRING订单
 *
 * 用途：
 * 1. 查找所有TRANSFERRING状态但没有confirmDeadline的订单
 * 2. 根据transferredAt时间和卖家认证状态计算正确的deadline
 * 3. 更新数据库
 *
 * 运行方式：
 * DATABASE_URL="..." npx tsx scripts/fix-missing-confirm-deadline.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 确认期限配置（小时）
const CONFIRM_DEADLINE_CONFIG = {
  VERIFIED_SELLER: 72,      // 认证卖家：3天
  NORMAL_SELLER: 168,       // 普通卖家：7天
  HOLIDAY_EXTENSION: 24     // 节假日延期：24小时
} as const

function calculateConfirmDeadline(
  transferTime: Date,
  isVerifiedSeller: boolean
): Date {
  const baseHours = isVerifiedSeller
    ? CONFIRM_DEADLINE_CONFIG.VERIFIED_SELLER
    : CONFIRM_DEADLINE_CONFIG.NORMAL_SELLER

  const deadline = new Date(transferTime)
  deadline.setHours(deadline.getHours() + baseHours)

  return deadline
}

async function fixMissingConfirmDeadlines() {
  console.log('🔍 查找缺失confirmDeadline的TRANSFERRING订单...\n')

  const orders = await prisma.order.findMany({
    where: {
      status: 'TRANSFERRING',
      confirmDeadline: null,
      transferredAt: { not: null }
    },
    include: {
      seller: {
        select: {
          id: true,
          name: true,
          verified: true
        }
      },
      buyer: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })

  if (orders.length === 0) {
    console.log('✅ 没有需要修复的订单')
    return
  }

  console.log(`📦 找到 ${orders.length} 个需要修复的订单:\n`)

  for (const order of orders) {
    const isVerifiedSeller = order.seller?.verified || false
    const confirmDeadline = calculateConfirmDeadline(
      new Date(order.transferredAt!),
      isVerifiedSeller
    )

    console.log(`订单 ${order.orderNo}:`)
    console.log(`  - 卖家: ${order.seller.name} (${isVerifiedSeller ? '已认证' : '未认证'})`)
    console.log(`  - 买家: ${order.buyer?.name || '无'}`)
    console.log(`  - 转移时间: ${new Date(order.transferredAt!).toLocaleString('zh-CN')}`)
    console.log(`  - 计算的截止时间: ${confirmDeadline.toLocaleString('zh-CN')}`)

    try {
      await prisma.order.update({
        where: { id: order.id },
        data: { confirmDeadline }
      })
      console.log(`  ✅ 已更新\n`)
    } catch (error) {
      console.error(`  ❌ 更新失败:`, error)
    }
  }

  console.log(`\n🎉 完成! 修复了 ${orders.length} 个订单`)
}

async function main() {
  try {
    await fixMissingConfirmDeadlines()
  } catch (error) {
    console.error('❌ 执行失败:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
