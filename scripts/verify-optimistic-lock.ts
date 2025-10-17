/**
 * 验证乐观锁机制脚本
 *
 * 测试内容：
 * 1. 模拟并发购买场景，验证乐观锁防止重复购买
 * 2. 验证version字段正确递增
 * 3. 验证并发冲突时的错误处理
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface TestResult {
  test: string
  passed: boolean
  details: string
}

const results: TestResult[] = []

// 辅助函数：添加测试结果
function addResult(test: string, passed: boolean, details: string) {
  results.push({ test, passed, details })
  const icon = passed ? '✅' : '❌'
  console.log(`${icon} ${test}: ${details}`)
}

// 模拟并发支付操作
async function simulatePayment(
  orderId: string,
  buyerId: string,
  buyerName: string,
  orderVersion: number
): Promise<{success: boolean, error?: string}> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId }
    })

    if (!order) {
      return { success: false, error: '订单不存在' }
    }

    // 模拟真实的支付流程（使用乐观锁）
    const result = await prisma.$transaction(async (tx) => {
      // 使用updateMany和version实现乐观锁
      const updateResult = await tx.order.updateMany({
        where: {
          id: orderId,
          status: 'PUBLISHED',
          version: orderVersion
        },
        data: {
          buyerId: buyerId,
          status: 'PAID',
          paidAt: new Date(),
          escrowAmount: order.price,
          version: {
            increment: 1
          }
        }
      })

      // 检查更新是否成功
      if (updateResult.count === 0) {
        throw new Error(`${buyerName}: 乐观锁冲突 - 订单已被其他买家购买或状态已变更`)
      }

      // 创建支付记录
      await tx.payment.create({
        data: {
          orderId: orderId,
          userId: buyerId,
          amount: order.price,
          type: 'ESCROW',
          status: 'COMPLETED',
          note: `${buyerName}的支付`
        }
      })

      // 重新查询订单
      return await tx.order.findUnique({
        where: { id: orderId }
      })
    })

    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '未知错误'
    }
  }
}

// 测试1: 验证单个购买成功
async function testSinglePurchase() {
  console.log('\n📝 测试1: 单个买家购买（正常流程）\n')

  try {
    // 创建测试卖家
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试卖家',
        role: 'SELLER'
      }
    })

    // 创建测试订单
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-${Date.now()}`,
        sellerId: seller.id,
        status: 'PUBLISHED',
        vehicleBrand: 'Tesla',
        vehicleModel: 'Model 3',
        vehicleYear: 2023,
        fsdVersion: 'FSD 12.0',
        price: 5000,
        version: 0
      }
    })

    // 创建买家
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@test.com`,
        password: 'test123',
        name: '买家A',
        role: 'BUYER'
      }
    })

    // 执行购买
    const result = await simulatePayment(order.id, buyer.id, '买家A', 0)

    // 验证结果
    if (result.success) {
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      })

      if (updatedOrder?.status === 'PAID' && updatedOrder.version === 1 && updatedOrder.buyerId === buyer.id) {
        addResult(
          '单个购买成功',
          true,
          '订单状态正确更新，version从0递增到1'
        )
      } else {
        addResult(
          '单个购买成功',
          false,
          `订单状态或version不正确 - 状态:${updatedOrder?.status}, version:${updatedOrder?.version}`
        )
      }
    } else {
      addResult(
        '单个购买成功',
        false,
        `购买失败: ${result.error}`
      )
    }

    // 清理测试数据
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.delete({ where: { id: seller.id } })
    await prisma.user.delete({ where: { id: buyer.id } })

  } catch (error) {
    addResult(
      '单个购买成功',
      false,
      `测试准备失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }
}

// 测试2: 验证并发购买时乐观锁防止重复
async function testConcurrentPurchase() {
  console.log('\n📝 测试2: 多个买家并发购买（乐观锁保护）\n')

  try {
    // 创建测试卖家
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试卖家',
        role: 'SELLER'
      }
    })

    // 创建测试订单
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-${Date.now()}`,
        sellerId: seller.id,
        status: 'PUBLISHED',
        vehicleBrand: 'Tesla',
        vehicleModel: 'Model 3',
        vehicleYear: 2023,
        fsdVersion: 'FSD 12.0',
        price: 5000,
        version: 0
      }
    })

    // 创建3个买家
    const buyer1 = await prisma.user.create({
      data: {
        email: `buyer1-${Date.now()}@test.com`,
        password: 'test123',
        name: '买家A',
        role: 'BUYER'
      }
    })

    const buyer2 = await prisma.user.create({
      data: {
        email: `buyer2-${Date.now()}@test.com`,
        password: 'test123',
        name: '买家B',
        role: 'BUYER'
      }
    })

    const buyer3 = await prisma.user.create({
      data: {
        email: `buyer3-${Date.now()}@test.com`,
        password: 'test123',
        name: '买家C',
        role: 'BUYER'
      }
    })

    console.log('🔄 模拟3个买家同时购买同一订单...\n')

    // 并发执行3个购买操作（都使用version=0）
    const results = await Promise.allSettled([
      simulatePayment(order.id, buyer1.id, '买家A', 0),
      simulatePayment(order.id, buyer2.id, '买家B', 0),
      simulatePayment(order.id, buyer3.id, '买家C', 0)
    ])

    // 统计结果
    const successCount = results.filter(
      r => r.status === 'fulfilled' && r.value.success
    ).length
    const failureCount = results.filter(
      r => r.status === 'fulfilled' && !r.value.success
    ).length

    console.log(`   成功: ${successCount} 个`)
    console.log(`   失败: ${failureCount} 个\n`)

    // 显示失败原因
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && !result.value.success) {
        console.log(`   买家${String.fromCharCode(65 + index)}: ${result.value.error}`)
      }
    })
    console.log()

    // 验证最终状态
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id }
    })

    const paymentCount = await prisma.payment.count({
      where: { orderId: order.id }
    })

    // 验证：只有一个买家成功，version正确递增，只有一条支付记录
    if (
      successCount === 1 &&
      failureCount === 2 &&
      finalOrder?.status === 'PAID' &&
      finalOrder.version === 1 &&
      paymentCount === 1
    ) {
      addResult(
        '并发购买乐观锁保护',
        true,
        `乐观锁有效阻止了重复购买：3个并发请求中只有1个成功，订单version从0递增到1，只创建了1条支付记录`
      )
    } else {
      addResult(
        '并发购买乐观锁保护',
        false,
        `乐观锁失效 - 成功:${successCount}, 失败:${failureCount}, version:${finalOrder?.version}, 支付记录:${paymentCount}`
      )
    }

    // 清理测试数据
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.delete({ where: { id: seller.id } })
    await prisma.user.delete({ where: { id: buyer1.id } })
    await prisma.user.delete({ where: { id: buyer2.id } })
    await prisma.user.delete({ where: { id: buyer3.id } })

  } catch (error) {
    addResult(
      '并发购买乐观锁保护',
      false,
      `测试准备失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }
}

// 测试3: 验证使用错误version导致失败
async function testInvalidVersion() {
  console.log('\n📝 测试3: 使用错误version购买（应该失败）\n')

  try {
    // 创建测试卖家
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试卖家',
        role: 'SELLER'
      }
    })

    // 创建测试订单
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-${Date.now()}`,
        sellerId: seller.id,
        status: 'PUBLISHED',
        vehicleBrand: 'Tesla',
        vehicleModel: 'Model 3',
        vehicleYear: 2023,
        fsdVersion: 'FSD 12.0',
        price: 5000,
        version: 0
      }
    })

    // 创建买家
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@test.com`,
        password: 'test123',
        name: '买家',
        role: 'BUYER'
      }
    })

    console.log('🔄 使用错误的version (999) 尝试购买...\n')

    // 使用错误的version尝试购买
    const result = await simulatePayment(order.id, buyer.id, '买家', 999)

    // 验证结果：应该失败
    if (!result.success) {
      console.log(`   失败原因: ${result.error}\n`)

      // 验证订单状态未改变
      const unchangedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      })

      if (unchangedOrder?.status === 'PUBLISHED' && unchangedOrder.version === 0) {
        addResult(
          '错误version拒绝',
          true,
          '使用错误version时正确拒绝购买，订单状态保持不变'
        )
      } else {
        addResult(
          '错误version拒绝',
          false,
          '订单状态被错误修改'
        )
      }
    } else {
      addResult(
        '错误version拒绝',
        false,
        '使用错误version时未能正确拒绝'
      )
    }

    // 清理测试数据
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.delete({ where: { id: seller.id } })
    await prisma.user.delete({ where: { id: buyer.id } })

  } catch (error) {
    addResult(
      '错误version拒绝',
      false,
      `测试准备失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }
}

// 主函数
async function main() {
  console.log('='.repeat(50))
  console.log('🔍 开始验证乐观锁机制')
  console.log('='.repeat(50))

  await testSinglePurchase()
  await testConcurrentPurchase()
  await testInvalidVersion()

  console.log('\n' + '='.repeat(50))
  console.log('📊 测试结果汇总')
  console.log('='.repeat(50))

  const passedTests = results.filter(r => r.passed).length
  const totalTests = results.length
  const passRate = ((passedTests / totalTests) * 100).toFixed(1)

  console.log(`\n总测试数: ${totalTests}`)
  console.log(`通过数: ${passedTests}`)
  console.log(`失败数: ${totalTests - passedTests}`)
  console.log(`通过率: ${passRate}%\n`)

  if (passedTests === totalTests) {
    console.log('✅ 所有乐观锁测试通过！')
  } else {
    console.log('❌ 存在乐观锁问题，请检查失败的测试。')
    process.exit(1)
  }

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('❌ 测试执行失败:', error)
    process.exit(1)
  })
