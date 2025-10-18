import { z } from 'zod'

/**
 * ✅ 安全增强: 管理员操作输入验证
 *
 * 使用Zod进行表单验证,确保数据格式和长度正确
 * 防止超长输入、必填字段缺失等问题
 */

/**
 * 退款操作验证schema
 */
export const RefundActionSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    required_error: '请选择操作类型',
    invalid_type_error: '操作类型无效'
  }),
  note: z.string()
    .max(500, '备注不能超过500字符')
    .optional()
})

export type RefundActionInput = z.infer<typeof RefundActionSchema>

/**
 * 申诉处理验证schema
 */
export const DisputeActionSchema = z.object({
  action: z.enum(['approve', 'reject'], {
    required_error: '请选择操作类型',
    invalid_type_error: '操作类型无效'
  }),
  resolution: z.string()
    .min(1, '请填写处理意见')
    .max(1000, '处理意见不能超过1000字符')
})

export type DisputeActionInput = z.infer<typeof DisputeActionSchema>

/**
 * 用户信息更新验证schema
 */
export const UserUpdateSchema = z.object({
  name: z.string()
    .max(50, '姓名不能超过50字符')
    .optional(),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional()
    .or(z.literal('')), // 允许空字符串
  role: z.enum(['USER', 'SELLER', 'ADMIN'], {
    invalid_type_error: '角色类型无效'
  }).optional(),
  verified: z.boolean().optional(),
  balance: z.number()
    .min(0, '余额不能为负数')
    .optional()
})

export type UserUpdateInput = z.infer<typeof UserUpdateSchema>

/**
 * 提现审核验证schema
 */
export const WithdrawalActionSchema = z.object({
  action: z.enum(['approve', 'reject', 'processing', 'complete', 'fail'], {
    required_error: '请选择操作类型',
    invalid_type_error: '操作类型无效'
  }),
  reviewNote: z.string()
    .max(500, '审核备注不能超过500字符')
    .optional(),
  rejectReason: z.string()
    .min(1, '请填写拒绝原因')
    .max(200, '拒绝原因不能超过200字符')
    .optional(),
  transactionId: z.string()
    .min(1, '请填写交易ID')
    .max(100, '交易ID不能超过100字符')
    .optional()
}).refine(
  (data) => {
    // 拒绝操作必须填写拒绝原因
    if (data.action === 'reject' && !data.rejectReason) {
      return false
    }
    // 完成操作必须填写交易ID
    if (data.action === 'complete' && !data.transactionId) {
      return false
    }
    return true
  },
  {
    message: '请填写必填字段',
    path: [] // 通用错误,不指向特定字段
  }
)

export type WithdrawalActionInput = z.infer<typeof WithdrawalActionSchema>
