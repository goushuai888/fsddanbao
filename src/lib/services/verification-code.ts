/**
 * 验证码服务
 *
 * 提供验证码生成、发送、验证等功能
 */

import { prisma } from '@/lib/infrastructure/database/prisma'
import { sendVerificationCode } from '@/lib/infrastructure/email/nodemailer'

export type VerificationType =
  | 'WITHDRAWAL'
  | 'CHANGE_EMAIL'
  | 'LARGE_PAYMENT'
  | 'CHANGE_PASSWORD'
  | 'REGISTER'
  | 'LOGIN'

/**
 * 生成6位随机数字验证码
 */
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * 发送验证码
 *
 * @param email 接收邮箱
 * @param type 验证类型
 * @param userId 用户ID（可选）
 * @returns 成功返回true，失败返回错误信息
 */
export async function sendCode(
  email: string,
  type: VerificationType,
  userId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 检查是否有未过期的验证码（防止频繁发送）
    const existingCode = await prisma.verificationCode.findFirst({
      where: {
        email,
        type,
        verified: false,
        expiresAt: {
          gt: new Date()
        },
        createdAt: {
          gt: new Date(Date.now() - 60 * 1000) // 1分钟内
        }
      }
    })

    if (existingCode) {
      return {
        success: false,
        error: '验证码发送过于频繁，请1分钟后再试'
      }
    }

    // 2. 生成验证码
    const code = generateCode()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10分钟后过期

    // 3. 保存到数据库
    await prisma.verificationCode.create({
      data: {
        email,
        code,
        type,
        userId,
        expiresAt
      }
    })

    // 4. 发送邮件
    const emailSent = await sendVerificationCode(email, code, type)

    if (!emailSent) {
      return {
        success: false,
        error: '邮件发送失败，请稍后重试'
      }
    }

    return { success: true }
  } catch (error) {
    console.error('发送验证码错误:', error)
    return {
      success: false,
      error: '系统错误，请稍后重试'
    }
  }
}

/**
 * 验证验证码
 *
 * @param email 接收邮箱
 * @param code 验证码
 * @param type 验证类型
 * @returns 成功返回true，失败返回错误信息
 */
export async function verifyCode(
  email: string,
  code: string,
  type: VerificationType
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. 查找验证码记录
    const record = await prisma.verificationCode.findFirst({
      where: {
        email,
        type,
        verified: false
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    if (!record) {
      return {
        success: false,
        error: '验证码不存在或已使用'
      }
    }

    // 2. 检查是否过期
    if (record.expiresAt < new Date()) {
      return {
        success: false,
        error: '验证码已过期，请重新获取'
      }
    }

    // 3. 检查尝试次数（防止暴力破解）
    if (record.attempts >= 5) {
      return {
        success: false,
        error: '验证失败次数过多，请重新获取验证码'
      }
    }

    // 4. 验证码是否正确
    if (record.code !== code) {
      // 记录失败尝试
      await prisma.verificationCode.update({
        where: { id: record.id },
        data: {
          attempts: {
            increment: 1
          }
        }
      })

      return {
        success: false,
        error: `验证码错误，还剩 ${4 - record.attempts} 次机会`
      }
    }

    // 5. 验证成功，标记为已验证
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: {
        verified: true,
        verifiedAt: new Date()
      }
    })

    return { success: true }
  } catch (error) {
    console.error('验证验证码错误:', error)
    return {
      success: false,
      error: '系统错误，请稍后重试'
    }
  }
}

/**
 * 清理过期验证码（定时任务调用）
 */
export async function cleanupExpiredCodes(): Promise<number> {
  try {
    const result = await prisma.verificationCode.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 删除24小时前过期的
        }
      }
    })

    console.log(`清理了 ${result.count} 条过期验证码`)
    return result.count
  } catch (error) {
    console.error('清理过期验证码错误:', error)
    return 0
  }
}
