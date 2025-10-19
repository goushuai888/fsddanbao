/**
 * 统一认证中间件 - 单元测试
 *
 * 测试覆盖:
 * 1. ✅ Token提取和验证
 * 2. ✅ 基础认证流程
 * 3. ✅ 管理员权限检查
 * 4. ✅ 实名认证检查
 * 5. ✅ 自定义权限检查
 * 6. ✅ 可选认证
 * 7. ✅ 错误处理
 *
 * 运行测试:
 * ```bash
 * pnpm test src/lib/middleware/__tests__/auth.test.ts
 * ```
 */

import { NextRequest, NextResponse } from 'next/server'
import { withAuth, adminOnly, verifiedOnly, optionalAuth, AuthContext } from '../auth'
import * as authLib from '@/lib/infrastructure/auth/jwt'
import { UnauthorizedError, ForbiddenError } from '@/lib/domain/DomainErrors'

// Mock dependencies
jest.mock('@/lib/auth')

describe('统一认证中间件 (withAuth)', () => {
  // 测试前重置所有mock
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ============================================================================
  // 辅助函数
  // ============================================================================

  /**
   * 创建测试用的NextRequest
   */
  function createRequest(token?: string): NextRequest {
    const headers = new Headers()
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }

    return new NextRequest('http://localhost:3000/api/test', {
      headers
    })
  }

  /**
   * 创建测试用的handler
   */
  function createTestHandler(response?: any) {
    return jest.fn(async (req, ctx, auth: AuthContext) => {
      return NextResponse.json(response || { success: true, userId: auth.userId })
    })
  }

  // ============================================================================
  // 测试用例：基础认证
  // ============================================================================

  describe('基础认证流程', () => {
    it('应该成功验证有效token', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'BUYER'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler)
      const request = createRequest('valid-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(authLib.verifyToken).toHaveBeenCalledWith('valid-token')
      expect(handler).toHaveBeenCalled()

      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.userId).toBe('user-123')
    })

    it('应该拒绝缺少token的请求', async () => {
      // Arrange
      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler)
      const request = createRequest() // 无token

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('缺少认证令牌')
    })

    it('应该拒绝无效token', async () => {
      // Arrange
      ;(authLib.verifyToken as jest.Mock).mockReturnValue(null) // 无效token

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler)
      const request = createRequest('invalid-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('无效或已过期')
    })
  })

  // ============================================================================
  // 测试用例：管理员权限
  // ============================================================================

  describe('管理员权限检查', () => {
    it('应该允许管理员访问', async () => {
      // Arrange
      const mockPayload = {
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler, { requireAdmin: true })
      const request = createRequest('admin-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })

    it('应该拒绝非管理员访问', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'BUYER' // 非管理员
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler, { requireAdmin: true })
      const request = createRequest('user-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data.error).toContain('管理员权限')
    })

    it('adminOnly快捷函数应该正常工作', async () => {
      // Arrange
      const mockPayload = {
        userId: 'admin-123',
        email: 'admin@example.com',
        role: 'ADMIN'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = adminOnly(handler) // 使用快捷函数
      const request = createRequest('admin-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })

  // ============================================================================
  // 测试用例：实名认证
  // ============================================================================

  describe('实名认证检查', () => {
    it('应该允许已认证用户访问', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'SELLER',
        verified: true // 已认证
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler, { requireVerified: true })
      const request = createRequest('verified-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })

    it('应该拒绝未认证用户访问', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'SELLER',
        verified: false // 未认证
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler, { requireVerified: true })
      const request = createRequest('unverified-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data.error).toContain('实名认证')
    })

    it('verifiedOnly快捷函数应该正常工作', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'SELLER',
        verified: true
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = verifiedOnly(handler)
      const request = createRequest('verified-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })

  // ============================================================================
  // 测试用例：自定义权限检查
  // ============================================================================

  describe('自定义权限检查', () => {
    it('应该通过自定义权限检查', async () => {
      // Arrange
      const mockPayload = {
        userId: 'vip-123',
        email: 'vip@example.com',
        role: 'VIP'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler, {
        customCheck: (auth) => auth.role === 'VIP' // 只允许VIP
      })
      const request = createRequest('vip-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })

    it('应该拒绝未通过自定义权限检查的请求', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'BUYER'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler, {
        customCheck: (auth) => auth.role === 'VIP' // 只允许VIP
      })
      const request = createRequest('user-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(403)
    })

    it('应该支持异步自定义权限检查', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'BUYER'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = createTestHandler()
      const wrappedHandler = withAuth(handler, {
        customCheck: async (auth) => {
          // 模拟异步权限检查（如查询数据库）
          await new Promise(resolve => setTimeout(resolve, 10))
          return auth.userId === 'user-123'
        }
      })
      const request = createRequest('user-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)
    })
  })

  // ============================================================================
  // 测试用例：可选认证
  // ============================================================================

  describe('可选认证', () => {
    it('应该允许无token访问（可选认证）', async () => {
      // Arrange
      const handler = jest.fn(async (req, ctx, auth) => {
        if (auth) {
          return NextResponse.json({ personalized: true, userId: auth.userId })
        } else {
          return NextResponse.json({ public: true })
        }
      })

      const wrappedHandler = optionalAuth(handler)
      const request = createRequest() // 无token

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.public).toBe(true)
      expect(data.personalized).toBeUndefined()
    })

    it('应该提供用户信息（可选认证+有token）', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'BUYER'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = jest.fn(async (req, ctx, auth) => {
        if (auth) {
          return NextResponse.json({ personalized: true, userId: auth.userId })
        } else {
          return NextResponse.json({ public: true })
        }
      })

      const wrappedHandler = optionalAuth(handler)
      const request = createRequest('user-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(handler).toHaveBeenCalled()
      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data.personalized).toBe(true)
      expect(data.userId).toBe('user-123')
    })
  })

  // ============================================================================
  // 测试用例：错误处理
  // ============================================================================

  describe('错误处理', () => {
    it('应该捕获handler中的错误', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'BUYER'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = jest.fn(async () => {
        throw new Error('Handler错误')
      })

      const wrappedHandler = withAuth(handler)
      const request = createRequest('valid-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toContain('服务器内部错误')
    })

    it('应该正确处理领域错误', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'user@example.com',
        role: 'BUYER'
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      const handler = jest.fn(async () => {
        throw new ForbiddenError('自定义权限错误')
      })

      const wrappedHandler = withAuth(handler)
      const request = createRequest('valid-token')

      // Act
      const response = await wrappedHandler(request, {})

      // Assert
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data.success).toBe(false)
      expect(data.error).toBe('自定义权限错误')
      expect(data.code).toBeDefined()
    })
  })

  // ============================================================================
  // 测试用例：AuthContext
  // ============================================================================

  describe('AuthContext', () => {
    it('应该正确传递AuthContext', async () => {
      // Arrange
      const mockPayload = {
        userId: 'user-123',
        email: 'test@example.com',
        role: 'SELLER',
        verified: true
      }

      ;(authLib.verifyToken as jest.Mock).mockReturnValue(mockPayload)

      let capturedAuth: AuthContext | null = null

      const handler = jest.fn(async (req, ctx, auth) => {
        capturedAuth = auth
        return NextResponse.json({ success: true })
      })

      const wrappedHandler = withAuth(handler)
      const request = createRequest('valid-token')

      // Act
      await wrappedHandler(request, {})

      // Assert
      expect(capturedAuth).not.toBeNull()
      expect(capturedAuth?.userId).toBe('user-123')
      expect(capturedAuth?.email).toBe('test@example.com')
      expect(capturedAuth?.role).toBe('SELLER')
      expect(capturedAuth?.verified).toBe(true)
    })
  })
})
