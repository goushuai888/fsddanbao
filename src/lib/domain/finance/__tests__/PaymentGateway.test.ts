/**
 * PaymentGateway 单元测试
 *
 * 测试覆盖:
 * 1. ✅ createPayment() - 创建Payment记录
 * 2. ✅ updatePaymentStatus() - 更新Payment状态
 * 3. ✅ updatePaymentStatusBatch() - 批量更新
 * 4. ✅ getPaymentsByUser() - 查询用户Payment历史
 * 5. ✅ getPaymentsByWithdrawal() - 查询提现关联Payment
 * 6. ✅ getPaymentsByOrder() - 查询订单关联Payment
 * 7. ✅ getPaymentById() - 查询单个Payment
 * 8. ✅ calculateBalanceFromPayments() - 余额计算
 *
 * 运行测试:
 * ```bash
 * pnpm test src/lib/domain/finance/__tests__/PaymentGateway.test.ts
 * ```
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentGateway } from '../PaymentGateway'
import { Decimal } from '@prisma/client/runtime/library'

// Mock Prisma
vi.mock('@/lib/infrastructure/database/prisma', () => ({
  prisma: {
    payment: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn()
    }
  }
}))

import { prisma } from '@/lib/infrastructure/database/prisma'

describe('PaymentGateway', () => {
  let gateway: PaymentGateway

  beforeEach(() => {
    vi.clearAllMocks()
    gateway = new PaymentGateway()
  })

  // ============================================================================
  // 辅助函数
  // ============================================================================

  const mockPayment = (overrides = {}) => ({
    id: 'payment-123',
    userId: 'user-123',
    amount: new Decimal(100),
    type: 'RELEASE',
    status: 'COMPLETED',
    orderId: null,
    withdrawalId: null,
    performedBy: null,
    paymentMethod: null,
    transactionId: null,
    note: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })

  // ============================================================================
  // 测试用例: createPayment()
  // ============================================================================

  describe('createPayment()', () => {
    it('应该成功创建Payment记录', async () => {
      // Arrange
      const mockCreatedPayment = mockPayment()
      vi.mocked(prisma.payment.create).mockResolvedValue(mockCreatedPayment as any)

      // Act
      const result = await gateway.createPayment({
        userId: 'user-123',
        amount: 100,
        type: 'RELEASE',
        note: '测试支付'
      })

      // Assert
      expect(result).toEqual(mockCreatedPayment)
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          amount: 100,
          type: 'RELEASE',
          status: 'PENDING', // 默认状态
          note: '测试支付'
        })
      })
    })

    it('应该允许指定Payment状态', async () => {
      // Arrange
      const mockCreatedPayment = mockPayment({ status: 'COMPLETED' })
      vi.mocked(prisma.payment.create).mockResolvedValue(mockCreatedPayment as any)

      // Act
      await gateway.createPayment({
        userId: 'user-123',
        amount: 100,
        type: 'RELEASE',
        status: 'COMPLETED',
        note: '已完成支付'
      })

      // Assert
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'COMPLETED'
        })
      })
    })

    it('应该支持在外部事务中执行', async () => {
      // Arrange
      const mockCreatedPayment = mockPayment()
      const mockTx = {
        payment: {
          create: vi.fn().mockResolvedValue(mockCreatedPayment)
        }
      } as any

      // Act
      const result = await gateway.createPayment(
        {
          userId: 'user-123',
          amount: 100,
          type: 'RELEASE',
          note: '事务中创建'
        },
        mockTx
      )

      // Assert
      expect(result).toEqual(mockCreatedPayment)
      expect(mockTx.payment.create).toHaveBeenCalled()
      expect(prisma.payment.create).not.toHaveBeenCalled() // 不应该使用全局prisma
    })

    it('应该支持创建关联订单的Payment', async () => {
      // Arrange
      const mockCreatedPayment = mockPayment({ orderId: 'order-123' })
      vi.mocked(prisma.payment.create).mockResolvedValue(mockCreatedPayment as any)

      // Act
      await gateway.createPayment({
        userId: 'user-123',
        amount: 100,
        type: 'ESCROW',
        orderId: 'order-123',
        note: '托管支付'
      })

      // Assert
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: 'order-123',
          type: 'ESCROW'
        })
      })
    })

    it('应该支持创建关联提现的Payment', async () => {
      // Arrange
      const mockCreatedPayment = mockPayment({
        withdrawalId: 'withdrawal-123',
        type: 'WITHDRAW'
      })
      vi.mocked(prisma.payment.create).mockResolvedValue(mockCreatedPayment as any)

      // Act
      await gateway.createPayment({
        userId: 'user-123',
        amount: 100,
        type: 'WITHDRAW',
        withdrawalId: 'withdrawal-123',
        note: '提现申请'
      })

      // Assert
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          withdrawalId: 'withdrawal-123',
          type: 'WITHDRAW'
        })
      })
    })

    it('应该支持记录操作人', async () => {
      // Arrange
      const mockCreatedPayment = mockPayment({ performedBy: 'admin-123' })
      vi.mocked(prisma.payment.create).mockResolvedValue(mockCreatedPayment as any)

      // Act
      await gateway.createPayment({
        userId: 'user-123',
        amount: 100,
        type: 'ADMIN_ADJUSTMENT',
        performedBy: 'admin-123',
        note: '管理员调账'
      })

      // Assert
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          performedBy: 'admin-123'
        })
      })
    })
  })

  // ============================================================================
  // 测试用例: updatePaymentStatus()
  // ============================================================================

  describe('updatePaymentStatus()', () => {
    it('应该成功更新Payment状态', async () => {
      // Arrange
      const mockUpdatedPayment = mockPayment({ status: 'COMPLETED' })
      vi.mocked(prisma.payment.update).mockResolvedValue(mockUpdatedPayment as any)

      // Act
      const result = await gateway.updatePaymentStatus('payment-123', 'COMPLETED')

      // Assert
      expect(result.status).toBe('COMPLETED')
      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        data: { status: 'COMPLETED' }
      })
    })

    it('应该支持在外部事务中更新', async () => {
      // Arrange
      const mockUpdatedPayment = mockPayment({ status: 'CANCELLED' })
      const mockTx = {
        payment: {
          update: vi.fn().mockResolvedValue(mockUpdatedPayment)
        }
      } as any

      // Act
      await gateway.updatePaymentStatus('payment-123', 'CANCELLED', mockTx)

      // Assert
      expect(mockTx.payment.update).toHaveBeenCalled()
      expect(prisma.payment.update).not.toHaveBeenCalled()
    })
  })

  // ============================================================================
  // 测试用例: updatePaymentStatusBatch()
  // ============================================================================

  describe('updatePaymentStatusBatch()', () => {
    it('应该批量更新多个Payment状态', async () => {
      // Arrange
      const paymentIds = ['payment-1', 'payment-2', 'payment-3']
      vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 3 })

      // Act
      const count = await gateway.updatePaymentStatusBatch(paymentIds, 'COMPLETED')

      // Assert
      expect(count).toBe(3)
      expect(prisma.payment.updateMany).toHaveBeenCalledWith({
        where: { id: { in: paymentIds } },
        data: { status: 'COMPLETED' }
      })
    })

    it('应该返回实际更新数量', async () => {
      // Arrange
      vi.mocked(prisma.payment.updateMany).mockResolvedValue({ count: 2 })

      // Act
      const count = await gateway.updatePaymentStatusBatch(
        ['payment-1', 'payment-2', 'nonexistent'],
        'FAILED'
      )

      // Assert
      expect(count).toBe(2) // 只更新了2个存在的Payment
    })
  })

  // ============================================================================
  // 测试用例: getPaymentsByUser()
  // ============================================================================

  describe('getPaymentsByUser()', () => {
    it('应该查询用户的Payment历史', async () => {
      // Arrange
      const mockPayments = [
        mockPayment({ id: 'payment-1' }),
        mockPayment({ id: 'payment-2' })
      ]
      vi.mocked(prisma.payment.findMany).mockResolvedValue(mockPayments as any)
      vi.mocked(prisma.payment.count).mockResolvedValue(2)

      // Act
      const result = await gateway.getPaymentsByUser('user-123')

      // Assert
      expect(result.data).toEqual(mockPayments)
      expect(result.total).toBe(2)
      expect(result.limit).toBe(20)
      expect(result.offset).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    it('应该支持按类型筛选', async () => {
      // Arrange
      vi.mocked(prisma.payment.findMany).mockResolvedValue([])
      vi.mocked(prisma.payment.count).mockResolvedValue(0)

      // Act
      await gateway.getPaymentsByUser('user-123', { type: 'WITHDRAW' })

      // Assert
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-123',
            type: 'WITHDRAW'
          })
        })
      )
    })

    it('应该支持按多个类型筛选', async () => {
      // Arrange
      vi.mocked(prisma.payment.findMany).mockResolvedValue([])
      vi.mocked(prisma.payment.count).mockResolvedValue(0)

      // Act
      await gateway.getPaymentsByUser('user-123', {
        type: ['RELEASE', 'REFUND']
      })

      // Assert
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            type: { in: ['RELEASE', 'REFUND'] }
          })
        })
      )
    })

    it('应该支持按状态筛选', async () => {
      // Arrange
      vi.mocked(prisma.payment.findMany).mockResolvedValue([])
      vi.mocked(prisma.payment.count).mockResolvedValue(0)

      // Act
      await gateway.getPaymentsByUser('user-123', {
        status: ['COMPLETED', 'PENDING']
      })

      // Assert
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['COMPLETED', 'PENDING'] }
          })
        })
      )
    })

    it('应该支持日期范围筛选', async () => {
      // Arrange
      const dateFrom = new Date('2024-01-01')
      const dateTo = new Date('2024-12-31')

      vi.mocked(prisma.payment.findMany).mockResolvedValue([])
      vi.mocked(prisma.payment.count).mockResolvedValue(0)

      // Act
      await gateway.getPaymentsByUser('user-123', {
        dateFrom,
        dateTo
      })

      // Assert
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: dateFrom,
              lte: dateTo
            }
          })
        })
      )
    })

    it('应该支持分页', async () => {
      // Arrange
      vi.mocked(prisma.payment.findMany).mockResolvedValue([])
      vi.mocked(prisma.payment.count).mockResolvedValue(100)

      // Act
      const result = await gateway.getPaymentsByUser(
        'user-123',
        undefined,
        { limit: 10, offset: 20 }
      )

      // Assert
      expect(result.limit).toBe(10)
      expect(result.offset).toBe(20)
      expect(result.hasMore).toBe(true) // 20 + 10 < 100
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20
        })
      )
    })

    it('应该包含关联的订单和提现信息', async () => {
      // Arrange
      const mockPaymentWithRelations = {
        ...mockPayment(),
        order: { orderNo: 'ORD-123', status: 'COMPLETED' },
        withdrawal: { status: 'COMPLETED', withdrawMethod: 'bank' },
        performedByUser: { name: 'Admin', email: 'admin@example.com' }
      }
      vi.mocked(prisma.payment.findMany).mockResolvedValue([mockPaymentWithRelations] as any)
      vi.mocked(prisma.payment.count).mockResolvedValue(1)

      // Act
      const result = await gateway.getPaymentsByUser('user-123')

      // Assert
      expect(result.data[0]).toHaveProperty('order')
      expect(result.data[0]).toHaveProperty('withdrawal')
      expect(result.data[0]).toHaveProperty('performedByUser')
    })
  })

  // ============================================================================
  // 测试用例: getPaymentsByWithdrawal()
  // ============================================================================

  describe('getPaymentsByWithdrawal()', () => {
    it('应该查询提现关联的所有Payment', async () => {
      // Arrange
      const mockPayments = [
        mockPayment({ id: 'payment-withdraw', type: 'WITHDRAW' }),
        mockPayment({ id: 'payment-refund', type: 'REFUND' })
      ]
      vi.mocked(prisma.payment.findMany).mockResolvedValue(mockPayments as any)

      // Act
      const result = await gateway.getPaymentsByWithdrawal('withdrawal-123')

      // Assert
      expect(result).toEqual(mockPayments)
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { withdrawalId: 'withdrawal-123' }
        })
      )
    })
  })

  // ============================================================================
  // 测试用例: getPaymentsByOrder()
  // ============================================================================

  describe('getPaymentsByOrder()', () => {
    it('应该查询订单关联的所有Payment', async () => {
      // Arrange
      const mockPayments = [
        mockPayment({ id: 'payment-escrow', type: 'ESCROW' }),
        mockPayment({ id: 'payment-release', type: 'RELEASE' })
      ]
      vi.mocked(prisma.payment.findMany).mockResolvedValue(mockPayments as any)

      // Act
      const result = await gateway.getPaymentsByOrder('order-123')

      // Assert
      expect(result).toEqual(mockPayments)
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-123' }
        })
      )
    })
  })

  // ============================================================================
  // 测试用例: getPaymentById()
  // ============================================================================

  describe('getPaymentById()', () => {
    it('应该查询单个Payment记录', async () => {
      // Arrange
      const mockPaymentWithRelations = {
        ...mockPayment(),
        order: { orderNo: 'ORD-123', status: 'COMPLETED' },
        withdrawal: { status: 'COMPLETED', withdrawMethod: 'bank' },
        performedByUser: { name: 'Admin', email: 'admin@example.com', role: 'ADMIN' }
      }
      vi.mocked(prisma.payment.findUnique).mockResolvedValue(mockPaymentWithRelations as any)

      // Act
      const result = await gateway.getPaymentById('payment-123')

      // Assert
      expect(result).toEqual(mockPaymentWithRelations)
      expect(prisma.payment.findUnique).toHaveBeenCalledWith({
        where: { id: 'payment-123' },
        include: expect.objectContaining({
          order: expect.any(Object),
          withdrawal: expect.any(Object),
          performedByUser: expect.any(Object)
        })
      })
    })

    it('应该返回null如果Payment不存在', async () => {
      // Arrange
      vi.mocked(prisma.payment.findUnique).mockResolvedValue(null)

      // Act
      const result = await gateway.getPaymentById('nonexistent')

      // Assert
      expect(result).toBeNull()
    })
  })

  // ============================================================================
  // 测试用例: calculateBalanceFromPayments()
  // ============================================================================

  describe('calculateBalanceFromPayments()', () => {
    it('应该正确计算用户余额', async () => {
      // Arrange
      const mockPayments = [
        { amount: new Decimal(100), type: 'RELEASE' },    // +100
        { amount: new Decimal(50), type: 'REFUND' },      // +50
        { amount: new Decimal(30), type: 'WITHDRAW' },    // -30
        { amount: new Decimal(20), type: 'ESCROW' }       // -20
      ]
      vi.mocked(prisma.payment.findMany).mockResolvedValue(mockPayments as any)

      // Act
      const balance = await gateway.calculateBalanceFromPayments('user-123')

      // Assert
      expect(balance).toBe(100) // 100 + 50 - 30 - 20 = 100
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          status: 'COMPLETED'
        },
        select: {
          amount: true,
          type: true
        }
      })
    })

    it('应该只计算COMPLETED状态的Payment', async () => {
      // Arrange
      vi.mocked(prisma.payment.findMany).mockResolvedValue([])

      // Act
      await gateway.calculateBalanceFromPayments('user-123')

      // Assert
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED'
          })
        })
      )
    })

    it('应该处理空Payment列表', async () => {
      // Arrange
      vi.mocked(prisma.payment.findMany).mockResolvedValue([])

      // Act
      const balance = await gateway.calculateBalanceFromPayments('user-123')

      // Assert
      expect(balance).toBe(0)
    })

    it('应该正确处理ADMIN_ADJUSTMENT类型', async () => {
      // Arrange
      const mockPayments = [
        { amount: new Decimal(100), type: 'ADMIN_ADJUSTMENT' }, // +100
        { amount: new Decimal(50), type: 'ADMIN_ADJUSTMENT' }   // +50
      ]
      vi.mocked(prisma.payment.findMany).mockResolvedValue(mockPayments as any)

      // Act
      const balance = await gateway.calculateBalanceFromPayments('user-123')

      // Assert
      expect(balance).toBe(150) // ADMIN_ADJUSTMENT默认为加法
    })

    it('应该正确处理各种PaymentType组合', async () => {
      // Arrange
      const mockPayments = [
        { amount: new Decimal(1000), type: 'RELEASE' },          // +1000
        { amount: new Decimal(200), type: 'REFUND' },            // +200
        { amount: new Decimal(500), type: 'WITHDRAW' },          // -500
        { amount: new Decimal(300), type: 'ESCROW' },            // -300
        { amount: new Decimal(100), type: 'ADMIN_ADJUSTMENT' }   // +100
      ]
      vi.mocked(prisma.payment.findMany).mockResolvedValue(mockPayments as any)

      // Act
      const balance = await gateway.calculateBalanceFromPayments('user-123')

      // Assert
      expect(balance).toBe(500) // 1000 + 200 + 100 - 500 - 300 = 500
    })
  })
})
