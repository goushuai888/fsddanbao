/**
 * 管理员用户管理API（使用统一认证中间件）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { adminOnly } from '@/lib/infrastructure/middleware/auth'
import { logAudit, AUDIT_ACTIONS } from '@/lib/infrastructure/audit/audit-logger'
import { walletService } from '@/lib/domain/finance/WalletService'
import { FinancialError } from '@/lib/domain/finance/types'
import { ApiResponse } from '@/types'

/**
 * GET /api/admin/users/[id] - 获取用户详情
 *
 * 认证要求: 管理员权限
 */
export const GET = adminOnly(async (request, { params }, auth) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        updatedAt: true,
        sellOrders: {
          where: {
            status: 'COMPLETED'
          },
          select: {
            id: true,
            orderNo: true,
            status: true,
            price: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        buyOrders: {
          where: {
            status: 'COMPLETED'
          },
          select: {
            id: true,
            orderNo: true,
            status: true,
            price: true,
            createdAt: true
          },
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        },
        _count: {
          select: {
            sellOrders: {
              where: {
                status: 'COMPLETED'
              }
            },
            buyOrders: {
              where: {
                status: 'COMPLETED'
              }
            },
            payments: true
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user
    })
  } catch (error) {
    console.error('获取用户详情错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
})

/**
 * PATCH /api/admin/users/[id] - 更新用户信息
 *
 * 认证要求: 管理员权限
 * 可更新字段: name, phone, role, verified
 *
 * 余额调整: 需要使用专门的balance参数和reason参数
 * - balance: 目标余额（绝对值）
 * - reason: 调账原因（必填）
 * - note: 额外备注（可选）
 */
export const PATCH = adminOnly(async (request, { params }, auth) => {
  try {
    const body = await request.json()
    const { name, phone, role, verified, balance, reason, note } = body

    // 获取更新前的用户信息（用于审计日志和余额计算）
    const oldUser = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        name: true,
        phone: true,
        role: true,
        verified: true,
        balance: true
      }
    })

    if (!oldUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // ==============================
    // 处理余额调整（使用WalletService）
    // ==============================
    if (balance !== undefined) {
      // 余额调整必须提供原因
      if (!reason || reason.trim() === '') {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '余额调整必须提供原因(reason字段)'
        }, { status: 400 })
      }

      const targetBalance = Number(balance)
      const currentBalance = Number(oldUser.balance)

      if (isNaN(targetBalance) || targetBalance < 0) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '无效的余额值'
        }, { status: 400 })
      }

      // 计算调整金额和方向
      const diff = targetBalance - currentBalance
      const isCredit = diff > 0
      const adjustAmount = Math.abs(diff)

      // 如果有差异,执行余额调整
      if (adjustAmount > 0) {
        try {
          await walletService.adminAdjustBalance({
            userId: params.id,
            amount: adjustAmount,
            isCredit,
            reason,
            adminUserId: auth.userId,
            note
          })
        } catch (error) {
          if (error instanceof FinancialError) {
            return NextResponse.json<ApiResponse>({
              success: false,
              error: `余额调整失败: ${error.message}`
            }, { status: 400 })
          }
          throw error
        }
      }
    }

    // ==============================
    // 更新其他用户信息
    // ==============================
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (role !== undefined) updateData.role = role
    if (verified !== undefined) updateData.verified = verified

    // 只在有其他字段需要更新时才执行update
    let user
    if (Object.keys(updateData).length > 0) {
      user = await prisma.user.update({
        where: { id: params.id },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          verified: true,
          balance: true,
          createdAt: true,
          updatedAt: true
        }
      })
    } else {
      // 如果只修改了余额,重新查询用户信息
      user = await prisma.user.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          verified: true,
          balance: true,
          createdAt: true,
          updatedAt: true
        }
      })
    }

    // 记录审计日志（仅针对非余额字段的更新）
    if (Object.keys(updateData).length > 0) {
      await logAudit({
        userId: auth.userId,
        action: role !== undefined ? AUDIT_ACTIONS.UPDATE_USER_ROLE : AUDIT_ACTIONS.UPDATE_USER_BALANCE,
        target: params.id,
        targetType: 'User',
        oldValue: oldUser,
        newValue: {
          name: user!.name,
          phone: user!.phone,
          role: user!.role,
          verified: user!.verified
        },
        description: '管理员更新用户信息',
        req: request
      })
    }
    // 注意: 余额调整的审计日志由walletService.adminAdjustBalance()自动记录

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user,
      message: '用户信息更新成功'
    })
  } catch (error) {
    console.error('更新用户信息错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
})

/**
 * DELETE /api/admin/users/[id] - 删除用户
 *
 * 认证要求: 管理员权限
 */
export const DELETE = adminOnly(async (request, { params }, auth) => {
  try {
    // 获取被删除用户的完整信息（用于审计日志）
    const userToDelete = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true
      }
    })

    if (!userToDelete) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '用户不存在'
      }, { status: 404 })
    }

    // 检查用户是否有进行中的订单
    const activeOrders = await prisma.order.count({
      where: {
        OR: [
          { sellerId: params.id },
          { buyerId: params.id }
        ],
        status: {
          in: ['PUBLISHED', 'PAID', 'TRANSFERRING', 'CONFIRMING']
        }
      }
    })

    if (activeOrders > 0) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该用户有进行中的订单，无法删除'
      }, { status: 400 })
    }

    await prisma.user.delete({
      where: { id: params.id }
    })

    // 记录审计日志
    await logAudit({
      userId: auth.userId,
      action: AUDIT_ACTIONS.DELETE_USER,
      target: params.id,
      targetType: 'User',
      oldValue: userToDelete,
      description: `删除用户 ${userToDelete.email}`,
      req: request
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      message: '用户删除成功'
    })
  } catch (error) {
    console.error('删除用户错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
})
