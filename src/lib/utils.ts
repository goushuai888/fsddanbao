import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化金额
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: 'CNY'
  }).format(price)
}

// 格式化日期
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(d)
}

// 生成订单号
export function generateOrderNo(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const random = Math.random().toString(36).substring(2, 10).toUpperCase()
  return `FSD${year}${month}${day}${random}`
}

// 隐藏敏感信息
export function maskString(str: string, start: number = 3, end: number = 4): string {
  if (str.length <= start + end) return str
  return str.substring(0, start) + '*'.repeat(str.length - start - end) + str.substring(str.length - end)
}

// 计算平台手续费
export function calculatePlatformFee(amount: number, rate: number = 0.03): number {
  return Math.round(amount * rate * 100) / 100
}
