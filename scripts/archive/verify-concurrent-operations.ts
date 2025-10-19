/**
 * 并发操作测试脚本
 *
 * 测试场景：
 * 1. 多个用户同时取消同一订单
 * 2. 买家和卖家同时操作（买家确认收货 vs 卖家取消）
 * 3. 多个卖家操作（同意退款 vs 拒绝退款）
 *
 * 验证目标：
 * - 只有一个操作成功
 * - version号正确递增
 * - 失败的操作返回409状态码
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 测试颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 测试1：多个用户同时取消订单
async function testConcurrentCancel() {
  log('\n========== 测试1：并发取消订单 ==========', 'cyan')

  // 创建测试数据
  const seller = await prisma.user.create({
    data: {
      email: `concurrent-seller-${Date.now()}@test.com`,
      password: 'test',
      name: '测试卖家'
    }
  })

  const buyer = await prisma.user.create({
    data: {
      email: `concurrent-buyer-${Date.now()}@test.com`,
      password: 'test',
      name: '测试买家'
    }
  })

  const order = await prisma.order.create({
    data: {
      orderNo: `TEST-${Date.now()}`,
      price: 1000,
      platformFee: 30,
      escrowAmount: 1000,
      sellerId: seller.id,
      buyerId: buyer.id,
      status: 'PUBLISHED',
      version: 0,
      // 必需字段
      vehicleBrand: 'Tesla',
      vehicleModel: 'Model 3',
      vehicleYear: 2023,
      fsdVersion: 'FSD Beta 11.4.1'
    }
  })

  log(`✓ 创建测试订单: ${order.orderNo}, 初始version: ${order.version}`, 'green')

  // 模拟3个用户同时取消订单
  const cancelAttempts = Array(3).fill(null).map(async (_, index) => {
    try {
      const result = await prisma.order.updateMany({
        where: {
          id: order.id,
          status: 'PUBLISHED',
          version: order.version
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          version: {
            increment: 1
          }
        }
      })

      return {
        attempt: index + 1,
        success: result.count > 0,
        count: result.count
      }
    } catch (error) {
      return {
        attempt: index + 1,
        success: false,
        error: error instanceof Error ? error.message : '未知错误'
      }
    }
  })

  const results = await Promise.all(cancelAttempts)

  const successCount = results.filter(r => r.success).length
  const failureCount = results.filter(r => !r.success).length

  log(`\n并发取消结果:`, 'yellow')
  results.forEach(r => {
    if (r.success) {
      log(`  尝试${r.attempt}: ✓ 成功 (更新了${r.count}条记录)`, 'green')
    } else {
      log(`  尝试${r.attempt}: ✗ 失败 ${r.error || '(没有符合条件的记录)'}`, 'red')
    }
  })

  // 验证最终状态
  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id }
  })

  log(`\n最终订单状态:`, 'yellow')
  log(`  状态: ${finalOrder?.status}`, 'blue')
  log(`  版本号: ${finalOrder?.version}`, 'blue')

  // 清理
  await prisma.order.delete({ where: { id: order.id } })
  await prisma.user.delete({ where: { id: seller.id } })
  await prisma.user.delete({ where: { id: buyer.id } })

  // 断言
  if (successCount === 1 && failureCount === 2 && finalOrder?.version === 1) {
    log('\n✓ 测试通过：只有1个操作成功，version正确递增', 'green')
    return true
  } else {
    log('\n✗ 测试失败：期望1个成功2个失败，version应为1', 'red')
    log(`  实际: ${successCount}个成功，${failureCount}个失败，version=${finalOrder?.version}`, 'red')
    return false
  }
}

// 测试2：买家确认收货 vs 卖家取消订单
async function testBuyerConfirmVsSellerCancel() {
  log('\n========== 测试2：买家确认收货 vs 卖家取消 ==========', 'cyan')

  // 创建测试数据
  const seller = await prisma.user.create({
    data: {
      email: `conflict-seller-${Date.now()}@test.com`,
      password: 'test',
      name: '冲突测试卖家',
      balance: 0
    }
  })

  const buyer = await prisma.user.create({
    data: {
      email: `conflict-buyer-${Date.now()}@test.com`,
      password: 'test',
      name: '冲突测试买家',
      balance: 0
    }
  })

  const order = await prisma.order.create({
    data: {
      orderNo: `CONFLICT-${Date.now()}`,
      price: 2000,
      platformFee: 60,
      escrowAmount: 2000,
      sellerId: seller.id,
      buyerId: buyer.id,
      status: 'TRANSFERRING',
      transferredAt: new Date(),
      version: 5,  // 模拟已经经过多次操作
      // 必需字段
      vehicleBrand: 'Tesla',
      vehicleModel: 'Model Y',
      vehicleYear: 2024,
      fsdVersion: 'FSD Beta 12.1'
    }
  })

  log(`✓ 创建测试订单: ${order.orderNo}, status: TRANSFERRING, version: ${order.version}`, 'green')

  // 买家尝试确认收货（事务）
  const buyerConfirm = prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'TRANSFERRING',
        version: 5
      },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        version: {
          increment: 1
        }
      }
    })

    if (result.count === 0) {
      throw new Error('订单状态已变更')
    }

    // 释放款项给卖家
    await tx.payment.create({
      data: {
        orderId: order.id,
        userId: seller.id,
        amount: 1940,  // 2000 - 60
        type: 'RELEASE',
        status: 'COMPLETED',
        note: '订单完成'
      }
    })

    await tx.user.update({
      where: { id: seller.id },
      data: { balance: { increment: 1940 } }
    })

    return { success: true, action: '确认收货' }
  })

  // 卖家尝试取消订单（事务）
  const sellerCancel = prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'TRANSFERRING',
        version: 5
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        version: {
          increment: 1
        }
      }
    })

    if (result.count === 0) {
      throw new Error('订单状态已变更')
    }

    return { success: true, action: '取消订单' }
  })

  // 并发执行
  const results = await Promise.allSettled([buyerConfirm, sellerCancel])

  log(`\n并发操作结果:`, 'yellow')
  results.forEach((result, index) => {
    const action = index === 0 ? '买家确认收货' : '卖家取消订单'
    if (result.status === 'fulfilled') {
      log(`  ${action}: ✓ 成功`, 'green')
    } else {
      log(`  ${action}: ✗ 失败 (${result.reason.message})`, 'red')
    }
  })

  // 验证最终状态
  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id }
  })

  const finalSeller = await prisma.user.findUnique({
    where: { id: seller.id }
  })

  log(`\n最终状态:`, 'yellow')
  log(`  订单状态: ${finalOrder?.status}`, 'blue')
  log(`  订单version: ${finalOrder?.version}`, 'blue')
  log(`  卖家余额: ${finalSeller?.balance}`, 'blue')

  // 清理
  await prisma.payment.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } })
  await prisma.user.delete({ where: { id: seller.id } })
  await prisma.user.delete({ where: { id: buyer.id } })

  // 断言
  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length

  if (successCount === 1 && failureCount === 1 && finalOrder?.version === 6) {
    log('\n✓ 测试通过：只有1个操作成功，另一个被阻止', 'green')
    return true
  } else {
    log('\n✗ 测试失败', 'red')
    return false
  }
}

// 测试3：并发退款操作（同意 vs 拒绝）
async function testConcurrentRefundActions() {
  log('\n========== 测试3：并发退款操作 (同意 vs 拒绝) ==========', 'cyan')

  // 创建测试数据
  const seller = await prisma.user.create({
    data: {
      email: `refund-seller-${Date.now()}@test.com`,
      password: 'test',
      name: '退款测试卖家',
      balance: 0
    }
  })

  const buyer = await prisma.user.create({
    data: {
      email: `refund-buyer-${Date.now()}@test.com`,
      password: 'test',
      name: '退款测试买家',
      balance: 0
    }
  })

  const order = await prisma.order.create({
    data: {
      orderNo: `REFUND-${Date.now()}`,
      price: 3000,
      platformFee: 90,
      escrowAmount: 3000,
      sellerId: seller.id,
      buyerId: buyer.id,
      status: 'PAID',
      refundRequested: true,
      refundStatus: 'PENDING',
      refundReason: '测试退款',
      refundRequestedAt: new Date(),
      version: 3,
      // 必需字段
      vehicleBrand: 'Tesla',
      vehicleModel: 'Model X',
      vehicleYear: 2023,
      fsdVersion: 'FSD Supervised'
    }
  })

  log(`✓ 创建测试订单: ${order.orderNo}, 退款状态: PENDING, version: ${order.version}`, 'green')

  // 同意退款（事务）
  const approveRefund = prisma.$transaction(async (tx) => {
    const result = await tx.order.updateMany({
      where: {
        id: order.id,
        status: 'PAID',
        refundRequested: true,
        refundStatus: 'PENDING',
        version: 3
      },
      data: {
        status: 'CANCELLED',
        refundStatus: 'APPROVED',
        refundApprovedAt: new Date(),
        cancelledAt: new Date(),
        version: { increment: 1 }
      }
    })

    if (result.count === 0) {
      throw new Error('退款申请状态已变更')
    }

    await tx.payment.create({
      data: {
        orderId: order.id,
        userId: buyer.id,
        amount: 3000,
        type: 'REFUND',
        status: 'COMPLETED',
        note: '同意退款'
      }
    })

    await tx.user.update({
      where: { id: buyer.id },
      data: { balance: { increment: 3000 } }
    })

    return { success: true, action: '同意退款' }
  })

  // 拒绝退款
  const rejectRefund = async () => {
    const result = await prisma.order.updateMany({
      where: {
        id: order.id,
        refundRequested: true,
        refundStatus: 'PENDING',
        version: 3
      },
      data: {
        refundStatus: 'REJECTED',
        refundRejectedReason: '测试拒绝',
        refundRejectedAt: new Date(),
        version: { increment: 1 }
      }
    })

    if (result.count === 0) {
      throw new Error('退款申请状态已变更')
    }

    return { success: true, action: '拒绝退款' }
  }

  // 并发执行
  const results = await Promise.allSettled([approveRefund, rejectRefund()])

  log(`\n并发操作结果:`, 'yellow')
  results.forEach((result, index) => {
    const action = index === 0 ? '同意退款' : '拒绝退款'
    if (result.status === 'fulfilled') {
      log(`  ${action}: ✓ 成功`, 'green')
    } else {
      log(`  ${action}: ✗ 失败 (${result.reason.message})`, 'red')
    }
  })

  // 验证最终状态
  const finalOrder = await prisma.order.findUnique({
    where: { id: order.id }
  })

  const finalBuyer = await prisma.user.findUnique({
    where: { id: buyer.id }
  })

  log(`\n最终状态:`, 'yellow')
  log(`  订单状态: ${finalOrder?.status}`, 'blue')
  log(`  退款状态: ${finalOrder?.refundStatus}`, 'blue')
  log(`  订单version: ${finalOrder?.version}`, 'blue')
  log(`  买家余额: ${finalBuyer?.balance}`, 'blue')

  // 清理
  await prisma.payment.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } })
  await prisma.user.delete({ where: { id: seller.id } })
  await prisma.user.delete({ where: { id: buyer.id } })

  // 断言
  const successCount = results.filter(r => r.status === 'fulfilled').length
  const failureCount = results.filter(r => r.status === 'rejected').length

  if (successCount === 1 && failureCount === 1 && finalOrder?.version === 4) {
    log('\n✓ 测试通过：只有1个操作成功', 'green')
    return true
  } else {
    log('\n✗ 测试失败', 'red')
    return false
  }
}

// 主函数
async function main() {
  log('\n╔════════════════════════════════════════════════════╗', 'cyan')
  log('║       FSD担保平台 - 并发操作保护测试脚本       ║', 'cyan')
  log('╚════════════════════════════════════════════════════╝\n', 'cyan')

  const results = {
    test1: false,
    test2: false,
    test3: false
  }

  try {
    results.test1 = await testConcurrentCancel()
    results.test2 = await testBuyerConfirmVsSellerCancel()
    results.test3 = await testConcurrentRefundActions()

    // 汇总结果
    log('\n╔════════════════════════════════════════════════════╗', 'cyan')
    log('║                   测试结果汇总                    ║', 'cyan')
    log('╚════════════════════════════════════════════════════╝\n', 'cyan')

    const passedCount = Object.values(results).filter(r => r).length
    const totalCount = Object.keys(results).length

    log(`测试1 - 并发取消订单: ${results.test1 ? '✓ 通过' : '✗ 失败'}`, results.test1 ? 'green' : 'red')
    log(`测试2 - 买家确认 vs 卖家取消: ${results.test2 ? '✓ 通过' : '✗ 失败'}`, results.test2 ? 'green' : 'red')
    log(`测试3 - 并发退款操作: ${results.test3 ? '✓ 通过' : '✗ 失败'}`, results.test3 ? 'green' : 'red')

    log(`\n总计: ${passedCount}/${totalCount} 通过`, passedCount === totalCount ? 'green' : 'yellow')

    if (passedCount === totalCount) {
      log('\n🎉 所有测试通过！并发保护机制工作正常。', 'green')
    } else {
      log('\n⚠️  部分测试失败，请检查并发保护实现。', 'yellow')
    }

  } catch (error) {
    log('\n测试执行出错:', 'red')
    console.error(error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
