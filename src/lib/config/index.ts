/**
 * 统一配置索引
 *
 * 这个文件作为所有配置的中央导出点，方便统一导入。
 *
 * 使用方式：
 * ```typescript
 * // 推荐：统一导入
 * import { ORDER_RULES, CONFIRM_DEADLINE_CONFIG } from '@/lib/config'
 *
 * // 也支持：从具体文件导入（向后兼容）
 * import { ORDER_RULES } from '@/lib/domain/policies/business-rules'
 * ```
 */

// ==================== 业务规则配置 ====================
export {
  // 订单规则
  ORDER_RULES,
  // 车辆验证规则
  VEHICLE_RULES,
  // 文本长度限制
  TEXT_LIMITS,
  // 确认收货期限规则
  CONFIRM_DEADLINE_RULES,
  // 退款响应期限规则
  REFUND_RESPONSE_RULES,
  // 时间常量
  TIME_CONSTANTS,
  // 2025年中国法定节假日
  CHINA_HOLIDAYS_2025,
  // HTTP状态码
  HTTP_STATUS,
  // 错误代码
  ERROR_CODES,
  // 辅助函数
  calculateConfirmDeadlineHours,
  calculateRefundResponseHours,
  getChinaHolidays,
  calculatePlatformFee,
  // 类型导出
  type OrderRules,
  type VehicleRules,
  type TextLimits,
  type ConfirmDeadlineRules,
  type RefundResponseRules,
  type HttpStatus,
  type ErrorCodes
} from '../domain/policies/business-rules'

// ==================== 确认收货配置 ====================
export {
  CONFIRM_DEADLINE_CONFIG,
  calculateConfirmDeadline,
  isConfirmOverdue,
  getConfirmRemainingSeconds,
  formatConfirmRemaining
} from '../domain/policies/confirm-config'

// ==================== 退款配置 ====================
export {
  REFUND_CONFIG,
  CHINESE_HOLIDAYS_2025,
  isHoliday,
  calculateRefundDeadline,
  isRefundTimeout,
  getRemainingTime,
  formatRemainingTime,
  getRemindTimepoints
} from '../domain/policies/refund-config'

// ==================== 订单视图配置 ====================
export {
  ORDER_VIEW_CONFIGS,
  type OrderViewConfig,
  getViewConfig
} from '../domain/policies/order-views'

// ==================== 快捷访问分组 ====================

/**
 * 所有费率配置
 */
export const FEES = {
  PLATFORM_FEE_RATE: 0.03 as const,
} as const

/**
 * 所有期限配置
 */
export const DEADLINES = {
  // 确认收货期限（小时）
  CONFIRM: {
    VERIFIED_SELLER: 72,
    NORMAL_SELLER: 168,
    HOLIDAY_EXTENSION: 24,
  },
  // 退款响应期限（小时）
  REFUND: {
    VERIFIED_SELLER: 24,
    NORMAL_SELLER: 48,
    EXTENSION: 24,
  },
} as const
