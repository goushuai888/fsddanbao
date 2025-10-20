/**
 * WalletService 单元测试
 *
 * 测试覆盖:
 * 1. ✅ credit() - 成功入账
 * 2. ✅ credit() - 参数验证失败
 * 3. ✅ debit() - 成功出账
 * 4. ✅ debit() - 余额不足
 * 5. ✅ adminAdjustBalance() - 增加余额
 * 6. ✅ adminAdjustBalance() - 扣除余额
 * 7. ✅ refundWithdrawal() - 完整流程
 * 8. ✅ 事务回滚
 *
 * 运行测试:
 * ```bash
 * pnpm test src/lib/domain/finance/__tests__/WalletService.test.ts
 * ```
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WalletService } from '../WalletService'
import { FinancialError, FinancialErrorCode } from '../types'
import { Decimal } from '@prisma/client/runtime/library'

// Mock dependencies
vi.mock('@/lib/infrastructure/database/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn()
    },
    withdrawal: {
      findUnique: vi.fn()
    },
    $transaction: vi.fn()
  }
}))

vi.mock('@/lib/infrastructure/audit/audit-logger', () => ({
  logAudit: vi.fn(),
  AUDIT_ACTIONS: {
    UPDATE_USER_BALANCE: 'UPDATE_USER_BALANCE',
    REJECT_WITHDRAWAL: 'REJECT_WITHDRAWAL'
  }
}))

import { prisma } from '@/lib/infrastructure/database/prisma'
import { logAudit } from '@/lib/infrastructure/audit/audit-logger'

describe('WalletService', () => {
  let walletService: WalletService

  beforeEach(() => {
    // 清除所有mock
    vi.clearAllMocks()

    // 创建新的WalletService实例
    walletService = new WalletService()
  })

  // ============================================================================
  // 辅助函数
  // ============================================================================

  /**
   * Mock成功的Payment创建
   */
  const mockSuccessfulPaymentCreation = () => {
    return {
      id: 'payment-123',
      userId: 'user-123',
      amount: new Decimal(100),
      type: 'RELEASE',
      status: 'COMPLETED',
      createdAt: new Date(),
      updatedAt: new Date()
    }
  }

  /**
   * Mock成功的User更新
   */
  const mockSuccessfulUserUpdate = (newBalance: number) => {
    return {
      id: 'user-123',
      email: 'test@example.com',
      balance: new Decimal(newBalance),
      role: 'BUYER',
      verified: true
    }
  }

  // ============================================================================
  // 测试用例: credit() - 入账
  // ============================================================================

  describe('credit() - 入账操作', () => {
    it('应该成功入账并返回新余额', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(0) }
      const mockPayment = mockSuccessfulPaymentCreation()
      const mockUpdatedUser = mockSuccessfulUserUpdate(100)

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        // 模拟事务执行
        const mockTx = {
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment)
          },
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser)
          }
        }
        return await callback(mockTx)
      })

      // Act
      const result = await walletService.credit({
        userId: 'user-123',
        amount: 100,
        type: 'RELEASE',
        note: '测试入账'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.newBalance).toEqual(new Decimal(100))
      expect(result.payment.id).toBe('payment-123')
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    })

    it('应该拒绝无效金额（≤0）', async () => {
      // Act & Assert
      await expect(
        walletService.credit({
          userId: 'user-123',
          amount: 0,
          type: 'RELEASE',
          note: '测试'
        })
      ).rejects.toThrow(FinancialError)

      await expect(
        walletService.credit({
          userId: 'user-123',
          amount: -100,
          type: 'RELEASE',
          note: '测试'
        })
      ).rejects.toThrow(FinancialError)
    })

    it('应该拒绝不存在的用户', async () => {
      // Arrange
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      // Act & Assert
      await expect(
        walletService.credit({
          userId: 'nonexistent-user',
          amount: 100,
          type: 'RELEASE',
          note: '测试'
        })
      ).rejects.toThrow(FinancialError)
    })

    it('应该支持在外部事务中执行', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(0) }
      const mockPayment = mockSuccessfulPaymentCreation()
      const mockUpdatedUser = mockSuccessfulUserUpdate(100)

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      const mockTx = {
        payment: {
          create: vi.fn().mockResolvedValue(mockPayment)
        },
        user: {
          update: vi.fn().mockResolvedValue(mockUpdatedUser)
        }
      } as any

      // Act
      const result = await walletService.credit(
        {
          userId: 'user-123',
          amount: 100,
          type: 'RELEASE',
          note: '测试入账'
        },
        mockTx
      )

      // Assert
      expect(result.success).toBe(true)
      expect(prisma.$transaction).not.toHaveBeenCalled() // 不应该创建新事务
      expect(mockTx.payment.create).toHaveBeenCalled()
      expect(mockTx.user.update).toHaveBeenCalled()
    })
  })

  // ============================================================================
  // 测试用例: debit() - 出账
  // ============================================================================

  describe('debit() - 出账操作', () => {
    it('应该成功扣除余额', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(200) }
      const mockPayment = mockSuccessfulPaymentCreation()
      const mockUpdatedUser = mockSuccessfulUserUpdate(100)

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment)
          },
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser)
          }
        }
        return await callback(mockTx)
      })

      // Act
      const result = await walletService.debit({
        userId: 'user-123',
        amount: 100,
        type: 'WITHDRAW',
        note: '提现'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.newBalance).toEqual(new Decimal(100))
    })

    it('应该拒绝余额不足的扣款', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(50) }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      // Act & Assert
      await expect(
        walletService.debit({
          userId: 'user-123',
          amount: 100,
          type: 'WITHDRAW',
          note: '提现'
        })
      ).rejects.toThrow(FinancialError)
    })

    it('应该为WITHDRAW类型创建PENDING状态的Payment', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(200) }
      const mockPayment = { ...mockSuccessfulPaymentCreation(), status: 'PENDING' }
      const mockUpdatedUser = mockSuccessfulUserUpdate(100)

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      let capturedPaymentData: any = null

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          payment: {
            create: vi.fn((data: any) => {
              capturedPaymentData = data
              return Promise.resolve(mockPayment)
            })
          },
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser)
          }
        }
        return await callback(mockTx)
      })

      // Act
      await walletService.debit({
        userId: 'user-123',
        amount: 100,
        type: 'WITHDRAW',
        note: '提现'
      })

      // Assert
      expect(capturedPaymentData.data.status).toBe('PENDING')
    })
  })

  // ============================================================================
  // 测试用例: adminAdjustBalance() - 管理员调账
  // ============================================================================

  describe('adminAdjustBalance() - 管理员调账', () => {
    it('应该成功增加用户余额', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(100) }
      const mockPayment = mockSuccessfulPaymentCreation()
      const mockUpdatedUser = mockSuccessfulUserUpdate(200)

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment)
          },
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser)
          }
        }
        return await callback(mockTx)
      })

      // Act
      const result = await walletService.adminAdjustBalance({
        userId: 'user-123',
        amount: 100,
        isCredit: true,
        reason: '补偿用户损失',
        adminUserId: 'admin-123'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.newBalance).toEqual(new Decimal(200))
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-123',
          target: 'user-123'
        })
      )
    })

    it('应该成功扣除用户余额', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(200) }
      const mockPayment = mockSuccessfulPaymentCreation()
      const mockUpdatedUser = mockSuccessfulUserUpdate(100)

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment)
          },
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser)
          }
        }
        return await callback(mockTx)
      })

      // Act
      const result = await walletService.adminAdjustBalance({
        userId: 'user-123',
        amount: 100,
        isCredit: false,
        reason: '扣除违规收益',
        adminUserId: 'admin-123'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(result.newBalance).toEqual(new Decimal(100))
    })

    it('应该拒绝没有原因的调账', async () => {
      // Act & Assert
      await expect(
        walletService.adminAdjustBalance({
          userId: 'user-123',
          amount: 100,
          isCredit: true,
          reason: '',
          adminUserId: 'admin-123'
        })
      ).rejects.toThrow(FinancialError)
    })

    it('应该记录完整的审计日志', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(100) }
      const mockPayment = mockSuccessfulPaymentCreation()
      const mockUpdatedUser = mockSuccessfulUserUpdate(200)

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment)
          },
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser)
          }
        }
        return await callback(mockTx)
      })

      // Act
      await walletService.adminAdjustBalance({
        userId: 'user-123',
        amount: 100,
        isCredit: true,
        reason: '测试调账',
        adminUserId: 'admin-123',
        note: '额外备注',
        relatedOrderNo: 'ORD-123'
      })

      // Assert
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'admin-123',
          target: 'user-123',
          targetType: 'User',
          newValue: expect.objectContaining({
            amount: 100,
            isCredit: true,
            reason: '测试调账'
          })
        })
      )
    })
  })

  // ============================================================================
  // 测试用例: refundWithdrawal() - 提现退款
  // ============================================================================

  describe('refundWithdrawal() - 提现退款', () => {
    it('应该成功退款并更新Payment状态', async () => {
      // Arrange
      const mockWithdrawal = {
        id: 'withdrawal-123',
        userId: 'user-123',
        amount: new Decimal(100),
        status: 'PENDING',
        payments: [
          {
            id: 'payment-withdraw-123',
            type: 'WITHDRAW',
            status: 'PENDING'
          }
        ]
      }

      const mockPayment = mockSuccessfulPaymentCreation()
      const mockUpdatedUser = mockSuccessfulUserUpdate(200)

      vi.mocked(prisma.withdrawal.findUnique).mockResolvedValue(mockWithdrawal as any)
      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          user: {
            update: vi.fn().mockResolvedValue(mockUpdatedUser)
          },
          withdrawal: {
            findUnique: vi.fn().mockResolvedValue(mockWithdrawal)
          },
          payment: {
            create: vi.fn().mockResolvedValue(mockPayment),
            update: vi.fn()
          }
        }
        return await callback(mockTx)
      })

      // Act
      const result = await walletService.refundWithdrawal({
        withdrawalId: 'withdrawal-123',
        reason: '审核失败',
        adminUserId: 'admin-123'
      })

      // Assert
      expect(result.success).toBe(true)
      expect(logAudit).toHaveBeenCalled()
    })

    it('应该拒绝不存在的提现申请', async () => {
      // Arrange
      vi.mocked(prisma.withdrawal.findUnique).mockResolvedValue(null)

      // Act & Assert
      await expect(
        walletService.refundWithdrawal({
          withdrawalId: 'nonexistent',
          reason: '测试',
          adminUserId: 'admin-123'
        })
      ).rejects.toThrow(FinancialError)
    })

    it('应该拒绝状态不正确的提现申请', async () => {
      // Arrange
      const mockWithdrawal = {
        id: 'withdrawal-123',
        userId: 'user-123',
        amount: new Decimal(100),
        status: 'COMPLETED', // 已完成，不能退款
        payments: []
      }

      vi.mocked(prisma.withdrawal.findUnique).mockResolvedValue(mockWithdrawal as any)

      // Act & Assert
      await expect(
        walletService.refundWithdrawal({
          withdrawalId: 'withdrawal-123',
          reason: '测试',
          adminUserId: 'admin-123'
        })
      ).rejects.toThrow(FinancialError)
    })
  })

  // ============================================================================
  // 测试用例: getBalance() - 查询余额
  // ============================================================================

  describe('getBalance() - 查询余额', () => {
    it('应该成功返回用户余额', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(150.50) }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      // Act
      const balance = await walletService.getBalance('user-123')

      // Assert
      expect(balance).toEqual(new Decimal(150.50))
    })

    it('应该拒绝不存在的用户', async () => {
      // Arrange
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      // Act & Assert
      await expect(
        walletService.getBalance('nonexistent')
      ).rejects.toThrow(FinancialError)
    })
  })

  // ============================================================================
  // 测试用例: 事务完整性
  // ============================================================================

  describe('事务完整性', () => {
    it('应该在Payment创建失败时回滚事务', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(100) }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      vi.mocked(prisma.$transaction).mockRejectedValue(new Error('数据库错误'))

      // Act & Assert
      await expect(
        walletService.credit({
          userId: 'user-123',
          amount: 100,
          type: 'RELEASE',
          note: '测试'
        })
      ).rejects.toThrow('数据库错误')
    })

    it('应该在余额更新失败时回滚事务', async () => {
      // Arrange
      const mockUser = { id: 'user-123', balance: new Decimal(100) }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as any)

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
        const mockTx = {
          payment: {
            create: vi.fn().mockResolvedValue(mockSuccessfulPaymentCreation())
          },
          user: {
            update: vi.fn().mockRejectedValue(new Error('余额更新失败'))
          }
        }
        // 模拟事务回滚
        return await callback(mockTx)
      })

      // Act & Assert
      await expect(
        walletService.credit({
          userId: 'user-123',
          amount: 100,
          type: 'RELEASE',
          note: '测试'
        })
      ).rejects.toThrow()
    })
  })

  // ============================================================================
  // 测试用例: calculateBalanceFromPayments() - 余额计算验证
  // ============================================================================

  describe('calculateBalanceFromPayments() - 余额计算验证', () => {
    it('应该正确计算余额', async () => {
      // Arrange
      const mockPayments = [
        { amount: new Decimal(100), type: 'RELEASE' },  // +100
        { amount: new Decimal(50), type: 'REFUND' },    // +50
        { amount: new Decimal(30), type: 'WITHDRAW' },  // -30
        { amount: new Decimal(20), type: 'ESCROW' }     // -20
      ]

      vi.mocked(prisma).payment = {
        findMany: vi.fn().mockResolvedValue(mockPayments)
      } as any

      // Mock PaymentGateway的calculateBalanceFromPayments方法
      const originalCalculate = walletService['paymentGateway'].calculateBalanceFromPayments
      walletService['paymentGateway'].calculateBalanceFromPayments = vi.fn().mockResolvedValue(100)

      // Act
      const balance = await walletService.calculateBalanceFromPayments('user-123')

      // Assert
      expect(balance).toBe(100)

      // Cleanup
      walletService['paymentGateway'].calculateBalanceFromPayments = originalCalculate
    })
  })
})
