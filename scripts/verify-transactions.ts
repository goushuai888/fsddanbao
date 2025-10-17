/**
 * 验证数据库事务完整性脚本
 *
 * 测试内容：
 * 1. 支付操作的事务完整性和乐观锁
 * 2. 确认收货的事务完整性
 * 3. 取消订单的事务完整性
 * 4. 退款操作的事务完整性
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

// 测试1: 验证支付操作的事务完整性
async function testPaymentTransaction() {
  console.log('\n📝 测试1: 支付操作事务完整性\n')

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

    // 创建测试买家
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试买家',
        role: 'BUYER'
      }
    })

    // 模拟支付事务（使用乐观锁）
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 使用乐观锁更新订单
        const updateResult = await tx.order.updateMany({
          where: {
            id: order.id,
            status: 'PUBLISHED',
            version: order.version
          },
          data: {
            buyerId: buyer.id,
            status: 'PAID',
            paidAt: new Date(),
            escrowAmount: order.price,
            version: {
              increment: 1
            }
          }
        })

        if (updateResult.count === 0) {
          throw new Error('乐观锁冲突')
        }

        // 创建支付记录
        await tx.payment.create({
          data: {
            orderId: order.id,
            userId: buyer.id,
            amount: order.price,
            type: 'ESCROW',
            status: 'COMPLETED',
            note: '测试托管支付'
          }
        })

        // 重新查询订单
        return await tx.order.findUnique({
          where: { id: order.id }
        })
      })

      // 验证订单状态
      if (result?.status === 'PAID' && result.buyerId === buyer.id && result.version === 1) {
        // 验证支付记录是否创建
        const payment = await prisma.payment.findFirst({
          where: {
            orderId: order.id,
            type: 'ESCROW'
          }
        })

        if (payment) {
          addResult(
            '支付事务完整性',
            true,
            '事务成功：订单状态更新、支付记录创建、版本号递增'
          )
        } else {
          addResult(
            '支付事务完整性',
            false,
            '支付记录未创建'
          )
        }
      } else {
        addResult(
          '支付事务完整性',
          false,
          '订单状态或版本号不正确'
        )
      }
    } catch (error) {
      addResult(
        '支付事务完整性',
        false,
        `事务失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }

    // 清理测试数据
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.delete({ where: { id: seller.id } })
    await prisma.user.delete({ where: { id: buyer.id } })

  } catch (error) {
    addResult(
      '支付事务完整性',
      false,
      `测试准备失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }
}

// 测试2: 验证确认收货的事务完整性
async function testConfirmTransaction() {
  console.log('\n📝 测试2: 确认收货事务完整性\n')

  try {
    // 创建测试用户
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试卖家',
        role: 'SELLER',
        balance: 0
      }
    })

    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试买家',
        role: 'BUYER'
      }
    })

    // 创建TRANSFERRING状态的订单
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-${Date.now()}`,
        sellerId: seller.id,
        buyerId: buyer.id,
        status: 'TRANSFERRING',
        vehicleBrand: 'Tesla',
        vehicleModel: 'Model 3',
        vehicleYear: 2023,
        fsdVersion: 'FSD 12.0',
        price: 5000,
        platformFee: 150, // 3%手续费
        transferProof: 'https://example.com/proof.jpg',
        transferNote: '测试转移',
        paidAt: new Date(),
        transferredAt: new Date()
      }
    })

    // 模拟确认收货事务
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 更新订单状态为已完成
        const completed = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date()
          }
        })

        // 计算卖家应得金额
        const releaseAmount = order.price - (order.platformFee || 0)

        // 创建释放款项记录
        await tx.payment.create({
          data: {
            orderId: order.id,
            userId: order.sellerId,
            amount: releaseAmount,
            type: 'RELEASE',
            status: 'COMPLETED',
            note: '测试释放款项'
          }
        })

        // 更新卖家余额
        await tx.user.update({
          where: { id: order.sellerId },
          data: {
            balance: {
              increment: releaseAmount
            }
          }
        })

        return completed
      })

      // 验证结果
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      })
      const updatedSeller = await prisma.user.findUnique({
        where: { id: seller.id }
      })
      const payment = await prisma.payment.findFirst({
        where: {
          orderId: order.id,
          type: 'RELEASE'
        }
      })

      const expectedAmount = 5000 - 150 // 4850
      if (
        updatedOrder?.status === 'COMPLETED' &&
        updatedSeller?.balance === expectedAmount &&
        payment?.amount === expectedAmount
      ) {
        addResult(
          '确认收货事务完整性',
          true,
          `事务成功：订单完成、款项释放(${expectedAmount})、卖家余额更新`
        )
      } else {
        addResult(
          '确认收货事务完整性',
          false,
          `数据不一致 - 订单:${updatedOrder?.status}, 余额:${updatedSeller?.balance}, 支付:${payment?.amount}`
        )
      }
    } catch (error) {
      addResult(
        '确认收货事务完整性',
        false,
        `事务失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }

    // 清理测试数据
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.delete({ where: { id: seller.id } })
    await prisma.user.delete({ where: { id: buyer.id } })

  } catch (error) {
    addResult(
      '确认收货事务完整性',
      false,
      `测试准备失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }
}

// 测试3: 验证取消订单的事务完整性
async function testCancelTransaction() {
  console.log('\n📝 测试3: 取消订单事务完整性\n')

  try {
    // 创建测试用户
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试卖家',
        role: 'SELLER'
      }
    })

    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试买家',
        role: 'BUYER',
        balance: 0
      }
    })

    // 创建PAID状态的订单
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-${Date.now()}`,
        sellerId: seller.id,
        buyerId: buyer.id,
        status: 'PAID',
        vehicleBrand: 'Tesla',
        vehicleModel: 'Model 3',
        vehicleYear: 2023,
        fsdVersion: 'FSD 12.0',
        price: 5000,
        escrowAmount: 5000,
        paidAt: new Date()
      }
    })

    // 模拟取消订单事务
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 更新订单状态为已取消
        const cancelled = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date()
          }
        })

        // 创建退款记录
        const refundAmount = order.escrowAmount || order.price
        await tx.payment.create({
          data: {
            orderId: order.id,
            userId: buyer.id,
            amount: refundAmount,
            type: 'REFUND',
            status: 'COMPLETED',
            note: '测试退款'
          }
        })

        // 更新买家余额
        await tx.user.update({
          where: { id: buyer.id },
          data: {
            balance: {
              increment: refundAmount
            }
          }
        })

        return cancelled
      })

      // 验证结果
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      })
      const updatedBuyer = await prisma.user.findUnique({
        where: { id: buyer.id }
      })
      const payment = await prisma.payment.findFirst({
        where: {
          orderId: order.id,
          type: 'REFUND'
        }
      })

      if (
        updatedOrder?.status === 'CANCELLED' &&
        updatedBuyer?.balance === 5000 &&
        payment?.amount === 5000
      ) {
        addResult(
          '取消订单事务完整性',
          true,
          '事务成功：订单取消、退款记录创建、买家余额更新'
        )
      } else {
        addResult(
          '取消订单事务完整性',
          false,
          `数据不一致 - 订单:${updatedOrder?.status}, 余额:${updatedBuyer?.balance}, 退款:${payment?.amount}`
        )
      }
    } catch (error) {
      addResult(
        '取消订单事务完整性',
        false,
        `事务失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }

    // 清理测试数据
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.delete({ where: { id: seller.id } })
    await prisma.user.delete({ where: { id: buyer.id } })

  } catch (error) {
    addResult(
      '取消订单事务完整性',
      false,
      `测试准备失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }
}

// 测试4: 验证退款操作的事务完整性
async function testRefundTransaction() {
  console.log('\n📝 测试4: 退款操作事务完整性\n')

  try {
    // 创建测试用户
    const seller = await prisma.user.create({
      data: {
        email: `seller-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试卖家',
        role: 'SELLER'
      }
    })

    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${Date.now()}@test.com`,
        password: 'test123',
        name: '测试买家',
        role: 'BUYER',
        balance: 0
      }
    })

    // 创建有退款申请的订单
    const order = await prisma.order.create({
      data: {
        orderNo: `TEST-${Date.now()}`,
        sellerId: seller.id,
        buyerId: buyer.id,
        status: 'PAID',
        vehicleBrand: 'Tesla',
        vehicleModel: 'Model 3',
        vehicleYear: 2023,
        fsdVersion: 'FSD 12.0',
        price: 5000,
        escrowAmount: 5000,
        paidAt: new Date(),
        refundRequested: true,
        refundReason: '测试退款原因',
        refundRequestedAt: new Date(),
        refundStatus: 'PENDING'
      }
    })

    // 模拟同意退款事务
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 更新订单状态
        const refunded = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'CANCELLED',
            refundStatus: 'APPROVED',
            cancelledAt: new Date()
          }
        })

        // 创建退款记录
        const refundAmount = order.escrowAmount || order.price
        await tx.payment.create({
          data: {
            orderId: order.id,
            userId: buyer.id,
            amount: refundAmount,
            type: 'REFUND',
            status: 'COMPLETED',
            note: '卖家同意退款'
          }
        })

        // 更新买家余额
        await tx.user.update({
          where: { id: buyer.id },
          data: {
            balance: {
              increment: refundAmount
            }
          }
        })

        return refunded
      })

      // 验证结果
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id }
      })
      const updatedBuyer = await prisma.user.findUnique({
        where: { id: buyer.id }
      })
      const payment = await prisma.payment.findFirst({
        where: {
          orderId: order.id,
          type: 'REFUND'
        }
      })

      if (
        updatedOrder?.status === 'CANCELLED' &&
        updatedOrder?.refundStatus === 'APPROVED' &&
        updatedBuyer?.balance === 5000 &&
        payment?.amount === 5000
      ) {
        addResult(
          '退款操作事务完整性',
          true,
          '事务成功：退款审批、订单取消、退款记录创建、买家余额更新'
        )
      } else {
        addResult(
          '退款操作事务完整性',
          false,
          `数据不一致 - 状态:${updatedOrder?.status}, 退款状态:${updatedOrder?.refundStatus}, 余额:${updatedBuyer?.balance}`
        )
      }
    } catch (error) {
      addResult(
        '退款操作事务完整性',
        false,
        `事务失败: ${error instanceof Error ? error.message : '未知错误'}`
      )
    }

    // 清理测试数据
    await prisma.payment.deleteMany({ where: { orderId: order.id } })
    await prisma.order.delete({ where: { id: order.id } })
    await prisma.user.delete({ where: { id: seller.id } })
    await prisma.user.delete({ where: { id: buyer.id } })

  } catch (error) {
    addResult(
      '退款操作事务完整性',
      false,
      `测试准备失败: ${error instanceof Error ? error.message : '未知错误'}`
    )
  }
}

// 主函数
async function main() {
  console.log('='.repeat(50))
  console.log('🔍 开始验证数据库事务完整性')
  console.log('='.repeat(50))

  await testPaymentTransaction()
  await testConfirmTransaction()
  await testCancelTransaction()
  await testRefundTransaction()

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
    console.log('✅ 所有事务完整性测试通过！')
  } else {
    console.log('❌ 存在事务完整性问题，请检查失败的测试。')
    process.exit(1)
  }

  await prisma.$disconnect()
}

main()
  .catch((error) => {
    console.error('❌ 测试执行失败:', error)
    process.exit(1)
  })
