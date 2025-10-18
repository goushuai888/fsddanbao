import { z } from 'zod'

/**
 * 认证相关输入验证Schema
 *
 * 安全修复: CVSS 6.8
 * 统一输入验证，防止SQL注入、XSS和无效数据
 */

/**
 * 登录验证Schema
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: '请输入邮箱' })
    .email('邮箱格式不正确')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: '请输入密码' })
    .min(6, '密码至少6位')
    .max(100, '密码最多100位')
})

export type LoginInput = z.infer<typeof loginSchema>

/**
 * 注册验证Schema
 */
export const registerSchema = z.object({
  email: z
    .string({ required_error: '请输入邮箱' })
    .email('邮箱格式不正确')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: '请输入密码' })
    .min(8, '密码至少8位')
    .max(100, '密码最多100位')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      '密码必须包含大小写字母和数字'
    ),
  name: z
    .string()
    .min(1, '请输入姓名')
    .max(50, '姓名最多50个字符')
    .trim()
    .optional(),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '请输入有效的手机号')
    .optional()
    .or(z.literal('')),
  role: z.enum(['BUYER', 'SELLER'], {
    errorMap: () => ({ message: '请选择用户角色' })
  }).default('BUYER')
})

export type RegisterInput = z.infer<typeof registerSchema>

/**
 * 密码强度检查（可选增强功能）
 */
export const checkPasswordStrength = (password: string): {
  score: number // 0-4分
  feedback: string[]
} => {
  let score = 0
  const feedback: string[] = []

  // 长度检查
  if (password.length >= 12) {
    score++
  } else {
    feedback.push('建议密码长度至少12位')
  }

  // 大写字母
  if (/[A-Z]/.test(password)) score++
  else feedback.push('建议包含大写字母')

  // 小写字母
  if (/[a-z]/.test(password)) score++
  else feedback.push('建议包含小写字母')

  // 数字
  if (/\d/.test(password)) score++
  else feedback.push('建议包含数字')

  // 特殊字符
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    score++
    feedback.push('很好，包含特殊字符')
  } else {
    feedback.push('建议包含特殊字符')
  }

  return { score: Math.min(score, 4), feedback }
}
