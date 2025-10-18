/**
 * 订单确认配置
 *
 * 设计原则：
 * 1. 认证卖家：更短的确认期限（3天）- 信誉高
 * 2. 普通卖家：更长的确认期限（7天）- 给买家更多验证时间
 * 3. 节假日自动延期 - 避免假期无人处理
 */

// 确认期限配置（小时）
export const CONFIRM_DEADLINE_CONFIG = {
  VERIFIED_SELLER: 72,      // 认证卖家：3天（72小时）
  NORMAL_SELLER: 168,       // 普通卖家：7天（168小时）
  HOLIDAY_EXTENSION: 24     // 节假日延期：24小时
} as const

/**
 * 计算确认截止时间
 * @param transferTime 转移凭证提交时间
 * @param isVerifiedSeller 是否是认证卖家
 * @returns 确认截止时间
 */
export function calculateConfirmDeadline(
  transferTime: Date,
  isVerifiedSeller: boolean
): Date {
  const baseHours = isVerifiedSeller
    ? CONFIRM_DEADLINE_CONFIG.VERIFIED_SELLER
    : CONFIRM_DEADLINE_CONFIG.NORMAL_SELLER

  const deadline = new Date(transferTime)
  deadline.setHours(deadline.getHours() + baseHours)

  // 检查是否跨越节假日，如果是则延期
  const extensionHours = getHolidayExtension(transferTime, deadline)
  if (extensionHours > 0) {
    deadline.setHours(deadline.getHours() + extensionHours)
  }

  return deadline
}

/**
 * 检查时间范围内是否包含节假日
 * @param startTime 开始时间
 * @param endTime 结束时间
 * @returns 需要延期的小时数
 */
function getHolidayExtension(startTime: Date, endTime: Date): number {
  const holidays = getHolidays(startTime.getFullYear())
  let extensionHours = 0

  for (const holiday of holidays) {
    const holidayStart = new Date(holiday.start)
    const holidayEnd = new Date(holiday.end)

    // 检查期限是否与节假日重叠
    if (
      (startTime <= holidayEnd && endTime >= holidayStart) ||
      (holidayStart <= endTime && holidayEnd >= startTime)
    ) {
      extensionHours += CONFIRM_DEADLINE_CONFIG.HOLIDAY_EXTENSION
    }
  }

  return extensionHours
}

/**
 * 获取指定年份的节假日列表
 * @param year 年份
 * @returns 节假日数组
 */
function getHolidays(year: number): Array<{ name: string; start: string; end: string }> {
  // 2025年中国法定节假日
  // 实际项目中应该从数据库或配置文件读取
  const holidays2025 = [
    { name: '元旦', start: '2025-01-01', end: '2025-01-01' },
    { name: '春节', start: '2025-01-28', end: '2025-02-04' },
    { name: '清明节', start: '2025-04-04', end: '2025-04-06' },
    { name: '劳动节', start: '2025-05-01', end: '2025-05-05' },
    { name: '端午节', start: '2025-05-31', end: '2025-06-02' },
    { name: '中秋节', start: '2025-10-06', end: '2025-10-08' },
    { name: '国庆节', start: '2025-10-01', end: '2025-10-08' }
  ]

  // 如果需要支持其他年份，可以扩展这里
  if (year === 2025) {
    return holidays2025
  }

  // 默认返回2025年的节假日
  return holidays2025
}

/**
 * 检查订单是否超时未确认
 * @param confirmDeadline 确认截止时间
 * @returns 是否超时
 */
export function isConfirmOverdue(confirmDeadline: Date | string | null): boolean {
  if (!confirmDeadline) return false

  const deadline = typeof confirmDeadline === 'string' ? new Date(confirmDeadline) : confirmDeadline
  const now = new Date()

  return now > deadline
}

/**
 * 获取确认剩余时间（秒）
 * @param confirmDeadline 确认截止时间
 * @returns 剩余秒数（负数表示已超时）
 */
export function getConfirmRemainingSeconds(confirmDeadline: Date | string | null): number {
  if (!confirmDeadline) return 0

  const deadline = typeof confirmDeadline === 'string' ? new Date(confirmDeadline) : confirmDeadline
  const now = new Date()

  return Math.floor((deadline.getTime() - now.getTime()) / 1000)
}

/**
 * 格式化确认剩余时间
 * @param seconds 剩余秒数
 * @returns 格式化的时间字符串
 */
export function formatConfirmRemaining(seconds: number): string {
  if (seconds <= 0) {
    return '已超时'
  }

  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (days > 0) {
    return `${days}天${hours}小时${minutes}分钟`
  }
  if (hours > 0) {
    return `${hours}小时${minutes}分钟${secs}秒`
  }
  if (minutes > 0) {
    return `${minutes}分钟${secs}秒`
  }
  return `${secs}秒`
}
