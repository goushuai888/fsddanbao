/**
 * 管理员用户管理API（使用统一认证中间件）
 */

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { adminOnly } from '@/lib/infrastructure/middleware/auth'
import { logAudit, AUDIT_ACTIONS } from '@/lib/infrastructure/audit/audit-logger'
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
 * 可更新字段: name, phone, role, verified, balance
 */
export const PATCH = adminOnly(async (request, { params }, auth) => {
  try {
    const body = await request.json()
    const { name, phone, role, verified, balance } = body

    // 获取更新前的用户信息（用于审计日志）
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

    // 构建更新数据
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (role !== undefined) updateData.role = role
    if (verified !== undefined) updateData.verified = verified
    if (balance !== undefined) updateData.balance = balance

    const user = await prisma.user.update({
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

    // 记录审计日志
    await logAudit({
      userId: auth.userId,
      action: balance !== undefined ? AUDIT_ACTIONS.UPDATE_USER_BALANCE : AUDIT_ACTIONS.UPDATE_USER_ROLE,
      target: params.id,
      targetType: 'User',
      oldValue: oldUser,
      newValue: {
        name: user.name,
        phone: user.phone,
        role: user.role,
        verified: user.verified,
        balance: user.balance
      },
      description: '管理员更新用户信息',
      req: request
    })

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
