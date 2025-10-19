import { NextRequest } from 'next/server'
import { prisma } from '../database/prisma'

/**
 * ✅ 安全增强: 审计日志记录工具
 * 用于记录管理员的所有敏感操作，确保可追溯性
 */

export interface AuditLogParams {
  userId: string
  action: string
  target?: string
  targetType?: 'User' | 'Order' | 'Withdrawal' | 'Dispute' | string
  oldValue?: any
  newValue?: any
  description?: string
  req?: NextRequest
}

/**
 * 记录审计日志
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  const {
    userId,
    action,
    target,
    targetType,
    oldValue,
    newValue,
    description,
    req
  } = params

  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        target,
        targetType,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        description,
        ip: req ? extractIP(req) : null,
        userAgent: req?.headers.get('user-agent') || null
      }
    })

    // 在开发环境打印审计日志
    if (process.env.NODE_ENV === 'development') {
      console.log('[AUDIT]', {
        userId,
        action,
        target,
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    // 审计日志失败不应影响主业务流程,但需要记录错误
    console.error('Failed to create audit log:', error)
  }
}

/**
 * 提取客户端真实IP
 */
function extractIP(req: NextRequest): string | null {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIP = req.headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  // Vercel/Cloudflare等平台的IP头
  const cfIP = req.headers.get('cf-connecting-ip')
  if (cfIP) {
    return cfIP
  }

  return null
}

/**
 * 审计操作常量
 */
export const AUDIT_ACTIONS = {
  // 用户相关
  UPDATE_USER_BALANCE: 'UPDATE_USER_BALANCE',
  UPDATE_USER_ROLE: 'UPDATE_USER_ROLE',
  DELETE_USER: 'DELETE_USER',
  BAN_USER: 'BAN_USER',
  UNBAN_USER: 'UNBAN_USER',

  // 提现相关
  APPROVE_WITHDRAWAL: 'APPROVE_WITHDRAWAL',
  REJECT_WITHDRAWAL: 'REJECT_WITHDRAWAL',
  COMPLETE_WITHDRAWAL: 'COMPLETE_WITHDRAWAL',
  FAIL_WITHDRAWAL: 'FAIL_WITHDRAWAL',

  // 订单相关
  CANCEL_ORDER: 'CANCEL_ORDER',
  FORCE_COMPLETE_ORDER: 'FORCE_COMPLETE_ORDER',

  // 退款相关
  APPROVE_REFUND: 'APPROVE_REFUND',
  REJECT_REFUND: 'REJECT_REFUND',

  // 申诉相关
  RESOLVE_DISPUTE: 'RESOLVE_DISPUTE',
  CLOSE_DISPUTE: 'CLOSE_DISPUTE'
} as const
