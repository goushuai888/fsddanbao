/**
 * 退款时间配置
 *
 * 实现进阶优化方案：
 * 1. 分级处理：普通卖家48h，认证卖家24h
 * 2. 智能延期：允许延期1次，+24小时
 * 3. 节假日考虑：法定节假日自动延长24小时
 */

// 基础时间配置（毫秒）
export const REFUND_CONFIG = {
  // 普通卖家响应时间：48小时
  NORMAL_SELLER_TIMEOUT: 48 * 60 * 60 * 1000,

  // 认证卖家响应时间：24小时（奖励信誉好的卖家）
  VERIFIED_SELLER_TIMEOUT: 24 * 60 * 60 * 1000,

  // 延期时长：24小时
  EXTENSION_DURATION: 24 * 60 * 60 * 1000,

  // 节假日额外时间：24小时
  HOLIDAY_EXTRA_TIME: 24 * 60 * 60 * 1000,

  // 最大延期次数
  MAX_EXTENSIONS: 1,
} as const

// 中国法定节假日（2025年）
// 格式：YYYY-MM-DD
export const CHINESE_HOLIDAYS_2025 = [
  // 元旦: 1月1日
  '2025-01-01',

  // 春节: 1月28日-2月3日
  '2025-01-28', '2025-01-29', '2025-01-30', '2025-01-31',
  '2025-02-01', '2025-02-02', '2025-02-03',

  // 清明节: 4月4日-6日
  '2025-04-04', '2025-04-05', '2025-04-06',

  // 劳动节: 5月1日-5日
  '2025-05-01', '2025-05-02', '2025-05-03', '2025-05-04', '2025-05-05',

  // 端午节: 5月31日-6月2日
  '2025-05-31', '2025-06-01', '2025-06-02',

  // 中秋节: 10月6日
  '2025-10-06',

  // 国庆节: 10月1日-7日
  '2025-10-01', '2025-10-02', '2025-10-03', '2025-10-04',
  '2025-10-05', '2025-10-07',
]

/**
 * 检查日期是否为法定节假日
 */
export function isHoliday(date: Date): boolean {
  const dateStr = date.toISOString().split('T')[0]
  return CHINESE_HOLIDAYS_2025.includes(dateStr)
}

/**
 * 计算退款响应截止时间
 *
 * @param requestedAt 退款申请时间
 * @param isVerifiedSeller 是否为认证卖家
 * @param hasExtension 是否已申请延期
 * @returns 截止时间
 */
export function calculateRefundDeadline(
  requestedAt: Date,
  isVerifiedSeller: boolean = false,
  hasExtension: boolean = false
): Date {
  // 基础超时时间
  const baseTimeout = isVerifiedSeller
    ? REFUND_CONFIG.VERIFIED_SELLER_TIMEOUT
    : REFUND_CONFIG.NORMAL_SELLER_TIMEOUT

  // 计算初始截止时间
  let deadline = new Date(requestedAt.getTime() + baseTimeout)

  // 如果已申请延期，增加24小时
  if (hasExtension) {
    deadline = new Date(deadline.getTime() + REFUND_CONFIG.EXTENSION_DURATION)
  }

  // 检查期间是否包含节假日，每个节假日额外延长24小时
  let current = new Date(requestedAt)
  let holidayCount = 0

  while (current < deadline) {
    if (isHoliday(current)) {
      holidayCount++
    }
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000) // 下一天
  }

  // 节假日额外时间
  if (holidayCount > 0) {
    deadline = new Date(deadline.getTime() + holidayCount * REFUND_CONFIG.HOLIDAY_EXTRA_TIME)
  }

  return deadline
}

/**
 * 检查是否已超时
 */
export function isRefundTimeout(deadline: Date): boolean {
  return new Date() > deadline
}

/**
 * 获取剩余时间（毫秒）
 */
export function getRemainingTime(deadline: Date): number {
  const remaining = deadline.getTime() - Date.now()
  return Math.max(0, remaining)
}

/**
 * 格式化剩余时间为可读字符串
 * 例如："剩余 23小时45分钟"
 */
export function formatRemainingTime(deadline: Date): string {
  const remaining = getRemainingTime(deadline)

  if (remaining === 0) {
    return '已超时'
  }

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
  const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
  const seconds = Math.floor((remaining % (60 * 1000)) / 1000)

  // 如果有天数，显示：X天X小时X分钟X秒
  if (days > 0) {
    return `剩余 ${days}天${hours}小时${minutes}分钟${seconds}秒`
  }
  // 如果有小时，显示：X小时X分钟X秒
  else if (hours > 0) {
    return `剩余 ${hours}小时${minutes}分钟${seconds}秒`
  }
  // 如果有分钟，显示：X分钟X秒
  else if (minutes > 0) {
    return `剩余 ${minutes}分钟${seconds}秒`
  }
  // 只剩秒数，显示：X秒
  else {
    return `剩余 ${seconds}秒`
  }
}

/**
 * 获取应该发送提醒的时间点
 * 返回：剩余24h, 6h, 1h的时间戳
 */
export function getRemindTimepoints(deadline: Date): number[] {
  return [
    deadline.getTime() - 24 * 60 * 60 * 1000, // 剩余24小时
    deadline.getTime() - 6 * 60 * 60 * 1000,  // 剩余6小时
    deadline.getTime() - 1 * 60 * 60 * 1000,  // 剩余1小时
  ]
}
