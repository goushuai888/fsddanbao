/**
 * 业务规则配置 - 集中管理所有业务常量
 *
 * 原则:
 * 1. 所有硬编码的数字都应该在这里定义
 * 2. 使用有意义的名称和注释
 * 3. 使用 const assertions 确保类型安全
 * 4. 分类组织便于查找
 */

/**
 * 订单相关规则
 */
export const ORDER_RULES = {
  /** 订单价格限制 */
  PRICE: {
    /** 最小订单金额（元） */
    MIN: 0.01,
    /** 最大订单金额（元） - 防止恶意订单 */
    MAX: 999_999.99,
    /** 价格小数位数 */
    DECIMAL_PLACES: 2,
  },

  /** 平台费率 */
  FEES: {
    /** 平台手续费率（3%） */
    PLATFORM_FEE_RATE: 0.03,
  },
} as const

/**
 * 车辆信息验证规则
 */
export const VEHICLE_RULES = {
  /** VIN码规则 */
  VIN: {
    /** VIN码标准长度 */
    LENGTH: 17,
    /** VIN码验证正则（排除I/O/Q字母） */
    PATTERN: /^[A-HJ-NPR-Z0-9]{17}$/i,
  },

  /** 年份限制 */
  YEAR: {
    /** 支持的最早年份（Tesla FSD最早支持年份） */
    MIN: 2016,
    /** 支持的最晚年份（当前年份+1，允许预订） */
    MAX: () => new Date().getFullYear() + 1,
  },
} as const

/**
 * 文本内容长度限制
 */
export const TEXT_LIMITS = {
  /** 转移凭证说明 */
  TRANSFER_NOTE: {
    MIN: 1,
    MAX: 200,
  },

  /** 退款相关 */
  REFUND: {
    /** 退款原因 */
    REASON_MIN: 5,
    REASON_MAX: 500,
    /** 拒绝理由 */
    REJECT_REASON_MIN: 5,
    REJECT_REASON_MAX: 500,
    /** 延期理由 */
    EXTENSION_REASON_MIN: 5,
    EXTENSION_REASON_MAX: 500,
  },

  /** 申诉相关 */
  DISPUTE: {
    /** 申诉原因 */
    REASON_MIN: 5,
    REASON_MAX: 200,
    /** 申诉详情 */
    DESCRIPTION_MIN: 10,
    DESCRIPTION_MAX: 1000,
  },
} as const

/**
 * 确认收货期限配置（小时）
 */
export const CONFIRM_DEADLINE_RULES = {
  /** 认证卖家：3天（72小时） - 信誉高，给买家足够时间验证 */
  VERIFIED_SELLER_HOURS: 72,

  /** 普通卖家：7天（168小时） - 给买家更多验证时间 */
  NORMAL_SELLER_HOURS: 168,

  /** 节假日延期：24小时 - 避免假期无人处理 */
  HOLIDAY_EXTENSION_HOURS: 24,

  /** 人类可读的期限说明 */
  DESCRIPTIONS: {
    VERIFIED_SELLER: '3天',
    NORMAL_SELLER: '7天',
    HOLIDAY_EXTENSION: '24小时',
  },
} as const

/**
 * 退款响应期限配置（小时）
 */
export const REFUND_RESPONSE_RULES = {
  /** 认证卖家：1天（24小时） - 响应更快 */
  VERIFIED_SELLER_HOURS: 24,

  /** 普通卖家：2天（48小时） */
  NORMAL_SELLER_HOURS: 48,

  /** 延期时长：24小时（仅可申请一次） */
  EXTENSION_HOURS: 24,

  /** 人类可读的期限说明 */
  DESCRIPTIONS: {
    VERIFIED_SELLER: '24小时',
    NORMAL_SELLER: '48小时',
    EXTENSION: '24小时',
  },
} as const

/**
 * 时间相关常量
 */
export const TIME_CONSTANTS = {
  /** 毫秒数 */
  MILLISECONDS: {
    SECOND: 1000,
    MINUTE: 60 * 1000,
    HOUR: 60 * 60 * 1000,
    DAY: 24 * 60 * 60 * 1000,
  },

  /** 秒数 */
  SECONDS: {
    MINUTE: 60,
    HOUR: 60 * 60,
    DAY: 24 * 60 * 60,
  },
} as const

/**
 * 中国法定节假日配置
 *
 * 注意：实际生产环境应该：
 * 1. 从数据库读取（支持动态配置）
 * 2. 每年更新（国务院发布后及时调整）
 * 3. 支持多地区（如果业务扩展到其他国家）
 */
export const CHINA_HOLIDAYS_2025 = [
  { name: '元旦', start: '2025-01-01', end: '2025-01-01' },
  { name: '春节', start: '2025-01-28', end: '2025-02-04' },
  { name: '清明节', start: '2025-04-04', end: '2025-04-06' },
  { name: '劳动节', start: '2025-05-01', end: '2025-05-05' },
  { name: '端午节', start: '2025-05-31', end: '2025-06-02' },
  { name: '中秋节', start: '2025-10-06', end: '2025-10-08' },
  { name: '国庆节', start: '2025-10-01', end: '2025-10-08' },
] as const

/**
 * HTTP 状态码
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const

/**
 * 错误代码
 */
export const ERROR_CODES = {
  // 认证相关
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  FORBIDDEN: 'FORBIDDEN',

  // 订单相关
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATE: 'INVALID_ORDER_STATE',
  ORDER_ALREADY_PURCHASED: 'ORDER_ALREADY_PURCHASED',
  OPTIMISTIC_LOCK_FAILED: 'OPTIMISTIC_LOCK_FAILED',

  // 退款相关
  REFUND_NOT_ALLOWED: 'REFUND_NOT_ALLOWED',
  REFUND_ALREADY_REQUESTED: 'REFUND_ALREADY_REQUESTED',
  REFUND_TIMEOUT: 'REFUND_TIMEOUT',

  // 通用
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

/**
 * 辅助函数：计算确认截止时间
 */
export function calculateConfirmDeadlineHours(isVerifiedSeller: boolean): number {
  return isVerifiedSeller
    ? CONFIRM_DEADLINE_RULES.VERIFIED_SELLER_HOURS
    : CONFIRM_DEADLINE_RULES.NORMAL_SELLER_HOURS
}

/**
 * 辅助函数：计算退款响应截止时间
 */
export function calculateRefundResponseHours(isVerifiedSeller: boolean): number {
  return isVerifiedSeller
    ? REFUND_RESPONSE_RULES.VERIFIED_SELLER_HOURS
    : REFUND_RESPONSE_RULES.NORMAL_SELLER_HOURS
}

/**
 * 辅助函数：获取中国节假日（支持未来年份扩展）
 *
 * 注意：当前采用硬编码配置，每年更新一次即可。
 * 如需动态修改节假日配置，可实现数据库配置表：
 * - 创建 Holiday 表（year, date, name, type）
 * - 添加管理员页面管理节假日
 * - 修改此函数从数据库读取
 */
export function getChinaHolidays(year: number) {
  if (year === 2025) {
    return CHINA_HOLIDAYS_2025
  }

  // 默认返回2025年的节假日（避免空数组）
  console.warn(`未配置 ${year} 年的节假日数据，使用2025年数据`)
  return CHINA_HOLIDAYS_2025
}

/**
 * 辅助函数：计算平台手续费
 *
 * @param price 订单价格
 * @returns 手续费金额（保留2位小数）
 */
export function calculatePlatformFee(price: number): number {
  return Math.round(price * ORDER_RULES.FEES.PLATFORM_FEE_RATE * 100) / 100
}

/**
 * 类型导出
 */
export type OrderRules = typeof ORDER_RULES
export type VehicleRules = typeof VEHICLE_RULES
export type TextLimits = typeof TEXT_LIMITS
export type ConfirmDeadlineRules = typeof CONFIRM_DEADLINE_RULES
export type RefundResponseRules = typeof REFUND_RESPONSE_RULES
export type HttpStatus = typeof HTTP_STATUS
export type ErrorCodes = typeof ERROR_CODES
