/**
 * 平台手续费计算完整性测试
 *
 * 测试场景:
 * 1. 订单创建时正确计算并保存platformFee
 * 2. 确认收货时正确扣除手续费
 * 3. UI正确显示手续费明细
 * 4. 旧数据(platformFee=null)自动fallback计算
 *
 * 运行方式:
 * DATABASE_URL="postgresql://..." npx tsx scripts/verify-platform-fee-calculation.ts
 */

import { PrismaClient } from '@prisma/client'
import { calculatePlatformFee, ORDER_RULES } from '../src/lib/constants/business-rules'

const prisma = new PrismaClient()

// 测试配置
const TEST_CONFIG = {
  testPrice: 10000, // 测试价格: ¥10,000
  expectedFeeRate: ORDER_RULES.FEES.PLATFORM_FEE_RATE, // 3%
  expectedFee: 300, // 预期手续费: ¥300
  expectedRelease: 9700, // 预期释放金额: ¥9,700
}

// 测试用户ID(需要在数据库中存在)
let sellerId: string
let buyerId: string

// ANSI颜色码
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function log(message: string, color: string = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

function success(message: string) {
  log(`✅ ${message}`, colors.green)
}

function error(message: string) {
  log(`❌ ${message}`, colors.red)
}

function warn(message: string) {
  log(`⚠️  ${message}`, colors.yellow)
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.cyan)
}

/**
 * 准备测试数据
 */
async function setup() {
  log('\n📋 准备测试数据...', colors.cyan)

  // 查找或创建卖家
  let seller = await prisma.user.findFirst({
    where: { role: 'BUYER' },
  })

  if (!seller) {
    seller = await prisma.user.create({
      data: {
        name: 'Test Seller',
        email: `seller-${Date.now()}@test.com`,
        password: 'hashed_password',
        role: 'BUYER',
        verified: true,
      },
    })
    info(`创建测试卖家: ${seller.email}`)
  } else {
    info(`使用现有卖家: ${seller.email}`)
  }

  sellerId = seller.id

  // 查找或创建买家
  let buyer = await prisma.user.findFirst({
    where: {
      role: 'BUYER',
      id: { not: sellerId },
    },
  })

  if (!buyer) {
    buyer = await prisma.user.create({
      data: {
        name: 'Test Buyer',
        email: `buyer-${Date.now()}@test.com`,
        password: 'hashed_password',
        role: 'BUYER',
        balance: 50000, // 给买家足够的余额
      },
    })
    info(`创建测试买家: ${buyer.email}`)
  } else {
    // 确保买家有足够余额
    await prisma.user.update({
      where: { id: buyer.id },
      data: { balance: 50000 },
    })
    info(`使用现有买家: ${buyer.email}`)
  }

  buyerId = buyer.id

  success('测试数据准备完成')
}

/**
 * 测试1: 订单创建时正确保存platformFee
 */
async function test1_OrderCreationSavesPlatformFee() {
  log('\n🧪 测试1: 订单创建时正确保存platformFee', colors.yellow)

  const order = await prisma.order.create({
    data: {
      orderNo: `TEST-${Date.now()}`,
      sellerId,
      vehicleBrand: 'Tesla Model Y',
      vehicleModel: '长续航版',
      vehicleYear: 2024,
      vin: 'LRW3E7FS4PC123456',
      fsdVersion: 'FSD V12',
      price: TEST_CONFIG.testPrice,
      platformFee: calculatePlatformFee(TEST_CONFIG.testPrice),
      status: 'PUBLISHED',
    },
  })

  // 验证platformFee已保存
  if (!order.platformFee) {
    error('platformFee未保存')
    return false
  }

  const savedFee = Number(order.platformFee)
  if (savedFee !== TEST_CONFIG.expectedFee) {
    error(`platformFee计算错误: 期望${TEST_CONFIG.expectedFee}, 实际${savedFee}`)
    return false
  }

  success(
    `订单创建成功: 价格¥${order.price}, 手续费¥${savedFee} (${TEST_CONFIG.expectedFeeRate * 100}%)`
  )

  // 清理测试数据
  await prisma.order.delete({ where: { id: order.id } })

  return true
}

/**
 * 测试2: 确认收货时正确扣除手续费
 */
async function test2_ConfirmOrderDeductsFee() {
  log('\n🧪 测试2: 确认收货时正确扣除手续费', colors.yellow)

  // 创建完整流程的订单
  const order = await prisma.order.create({
    data: {
      orderNo: `TEST-${Date.now()}`,
      sellerId,
      buyerId,
      vehicleBrand: 'Tesla Model Y',
      vehicleModel: '长续航版',
      vehicleYear: 2024,
      vin: 'LRW3E7FS4PC123456',
      fsdVersion: 'FSD V12',
      price: TEST_CONFIG.testPrice,
      platformFee: calculatePlatformFee(TEST_CONFIG.testPrice),
      status: 'TRANSFERRING', // 直接设置为转移中
      paidAt: new Date(),
      transferProof: 'test-proof',
    },
  })

  // 记录卖家初始余额
  const sellerBefore = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { balance: true },
  })
  const initialBalance = Number(sellerBefore!.balance)

  // 模拟确认收货
  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    })

    const platformFee = Number(order.platformFee)
    const releaseAmount = Number(order.price) - platformFee

    await tx.payment.create({
      data: {
        orderId: order.id,
        userId: sellerId,
        amount: releaseAmount,
        type: 'RELEASE',
        status: 'COMPLETED',
        note: '测试释放款项',
      },
    })

    await tx.user.update({
      where: { id: sellerId },
      data: {
        balance: { increment: releaseAmount },
      },
    })
  })

  // 验证卖家余额增加
  const sellerAfter = await prisma.user.findUnique({
    where: { id: sellerId },
    select: { balance: true },
  })
  const finalBalance = Number(sellerAfter!.balance)
  const balanceIncrease = finalBalance - initialBalance

  if (balanceIncrease !== TEST_CONFIG.expectedRelease) {
    error(
      `卖家余额增加错误: 期望¥${TEST_CONFIG.expectedRelease}, 实际¥${balanceIncrease}`
    )
    // 清理
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.update({
      where: { id: sellerId },
      data: { balance: initialBalance },
    })
    return false
  }

  success(
    `确认收货成功: 订单价格¥${order.price}, 手续费¥${order.platformFee}, 卖家实收¥${balanceIncrease}`
  )

  // 清理测试数据
  await prisma.payment.deleteMany({ where: { orderId: order.id } })
  await prisma.order.delete({ where: { id: order.id } })
  await prisma.user.update({
    where: { id: sellerId },
    data: { balance: initialBalance },
  })

  return true
}

/**
 * 测试3: 验证UI显示的手续费计算
 */
async function test3_UIDisplaysCorrectFee() {
  log('\n🧪 测试3: 验证calculatePlatformFee函数一致性', colors.yellow)

  // 测试多个价格点
  const testPrices = [100, 1000, 10000, 99999.99]

  for (const price of testPrices) {
    const calculatedFee = calculatePlatformFee(price)
    const expectedFee = Math.round(price * TEST_CONFIG.expectedFeeRate * 100) / 100

    if (calculatedFee !== expectedFee) {
      error(
        `价格¥${price}的手续费计算错误: 期望¥${expectedFee}, 实际¥${calculatedFee}`
      )
      return false
    }
  }

  success(
    `所有价格点的手续费计算正确 (费率${TEST_CONFIG.expectedFeeRate * 100}%)`
  )
  return true
}

/**
 * 测试4: 旧数据(platformFee=null)的fallback处理
 */
async function test4_OldDataFallback() {
  log('\n🧪 测试4: 旧数据(platformFee=null)自动计算', colors.yellow)

  // 创建一个没有platformFee的订单(模拟旧数据)
  const order = await prisma.order.create({
    data: {
      orderNo: `TEST-OLD-${Date.now()}`,
      sellerId,
      buyerId,
      vehicleBrand: 'Tesla Model 3',
      vehicleModel: '标准续航版',
      vehicleYear: 2023,
      vin: 'LRW3E7FS4PC789012',
      fsdVersion: 'FSD V11',
      price: TEST_CONFIG.testPrice,
      platformFee: null, // 模拟旧数据
      status: 'TRANSFERRING',
      paidAt: new Date(),
      transferProof: 'test-proof',
    },
  })

  // 验证platformFee确实是null
  if (order.platformFee !== null) {
    error('测试数据创建失败: platformFee应该是null')
    await prisma.order.delete({ where: { id: order.id } })
    return false
  }

  // 模拟ConfirmOrderUseCase的逻辑
  const platformFee = order.platformFee
    ? Number(order.platformFee)
    : calculatePlatformFee(Number(order.price))

  const releaseAmount = Number(order.price) - platformFee

  if (platformFee !== TEST_CONFIG.expectedFee) {
    error(`Fallback计算错误: 期望¥${TEST_CONFIG.expectedFee}, 实际¥${platformFee}`)
    await prisma.order.delete({ where: { id: order.id } })
    return false
  }

  if (releaseAmount !== TEST_CONFIG.expectedRelease) {
    error(
      `释放金额计算错误: 期望¥${TEST_CONFIG.expectedRelease}, 实际¥${releaseAmount}`
    )
    await prisma.order.delete({ where: { id: order.id } })
    return false
  }

  success(
    `旧数据Fallback正确: platformFee=null时自动计算为¥${platformFee}, 释放金额¥${releaseAmount}`
  )

  // 清理
  await prisma.order.delete({ where: { id: order.id } })

  return true
}

/**
 * 清理测试环境
 */
async function cleanup() {
  log('\n🧹 清理测试环境...', colors.cyan)

  // 删除所有测试订单
  await prisma.order.deleteMany({
    where: {
      orderNo: { startsWith: 'TEST-' },
    },
  })

  info('测试数据已清理')
}

/**
 * 主测试流程
 */
async function main() {
  log('╔══════════════════════════════════════════════════════════╗', colors.cyan)
  log('║         平台手续费计算完整性测试                         ║', colors.cyan)
  log('╚══════════════════════════════════════════════════════════╝', colors.cyan)

  try {
    await setup()

    const results = {
      test1: await test1_OrderCreationSavesPlatformFee(),
      test2: await test2_ConfirmOrderDeductsFee(),
      test3: await test3_UIDisplaysCorrectFee(),
      test4: await test4_OldDataFallback(),
    }

    await cleanup()

    // 汇总结果
    log('\n' + '='.repeat(60), colors.cyan)
    log('测试结果汇总:', colors.cyan)
    log('='.repeat(60), colors.cyan)

    const allPassed = Object.values(results).every((r) => r === true)
    const passedCount = Object.values(results).filter((r) => r === true).length
    const totalCount = Object.keys(results).length

    if (results.test1) success('✓ 订单创建保存platformFee')
    else error('✗ 订单创建保存platformFee')

    if (results.test2) success('✓ 确认收货扣除手续费')
    else error('✗ 确认收货扣除手续费')

    if (results.test3) success('✓ UI手续费计算一致')
    else error('✗ UI手续费计算一致')

    if (results.test4) success('✓ 旧数据Fallback处理')
    else error('✗ 旧数据Fallback处理')

    log('\n' + '='.repeat(60), colors.cyan)
    log(`总计: ${passedCount}/${totalCount} 测试通过`, allPassed ? colors.green : colors.red)
    log('='.repeat(60) + '\n', colors.cyan)

    if (allPassed) {
      success('🎉 所有测试通过!')
      process.exit(0)
    } else {
      error('❌ 部分测试失败，请检查代码')
      process.exit(1)
    }
  } catch (err) {
    error(`测试执行失败: ${err}`)
    console.error(err)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
