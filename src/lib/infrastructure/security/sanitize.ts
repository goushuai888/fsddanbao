import DOMPurify from 'isomorphic-dompurify'

/**
 * XSS防护工具函数
 *
 * 安全修复: CVSS 7.3
 * 清理用户输入，防止XSS攻击
 *
 * ✅ 使用isomorphic-dompurify支持服务端渲染（SSR）和客户端渲染（CSR）
 */

/**
 * 清理HTML字符串，移除潜在的XSS攻击向量
 *
 * ✅ 支持服务端和客户端渲染
 *
 * @param dirty 未经清理的HTML字符串
 * @returns 清理后的安全HTML字符串
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'title'],
    ALLOW_DATA_ATTR: false
  })
}

/**
 * 清理纯文本 - 使用DOMPurify完全移除HTML标签
 *
 * 用于显示用户输入的纯文本（如用户名、邮箱等）
 *
 * @param text 未经清理的文本
 * @returns 清理后的纯文本（所有HTML标签被移除）
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return ''

  // 使用DOMPurify移除所有HTML标签和属性
  return DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [], // 不允许任何HTML标签
    ALLOWED_ATTR: []  // 不允许任何属性
  })
}

/**
 * React组件辅助函数 - 安全渲染用户输入的HTML
 *
 * 使用方法:
 * <div dangerouslySetInnerHTML={createSafeMarkup(userInput)} />
 *
 * @param html 用户输入的HTML
 * @returns 可用于dangerouslySetInnerHTML的对象
 */
export function createSafeMarkup(html: string): { __html: string } {
  return { __html: sanitizeHtml(html) }
}

/**
 * 清理URL，防止javascript:协议等危险URL
 *
 * @param url 用户输入的URL
 * @returns 安全的URL或空字符串
 */
/* eslint-disable no-script-url */
export function sanitizeUrl(url: string): string {
  if (!url) return ''

  const trimmedUrl = url.trim().toLowerCase()

  // 禁止危险协议
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:'
  ]

  for (const protocol of dangerousProtocols) {
    if (trimmedUrl.startsWith(protocol)) {
      return ''
    }
  }

  // 允许http, https, mailto协议
  if (
    trimmedUrl.startsWith('http://') ||
    trimmedUrl.startsWith('https://') ||
    trimmedUrl.startsWith('mailto:') ||
    trimmedUrl.startsWith('/') ||
    trimmedUrl.startsWith('#')
  )  {
    return url.trim()
  }

  // 相对路径默认添加https协议
  return `https://${url.trim()}`
}
/* eslint-enable no-script-url */

/**
 * 批量清理对象中的所有字符串字段
 *
 * @param obj 需要清理的对象
 * @param options 清理选项 (text模式移除所有HTML, html模式保留安全HTML)
 * @returns 清理后的对象
 *
 * @example
 * const cleanUser = sanitizeObject(user, { mode: 'text' })
 * const cleanArticle = sanitizeObject(article, { mode: 'html' })
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T,
  options: { mode: 'text' | 'html' } = { mode: 'text' }
): T {
  const sanitize = options.mode === 'text' ? sanitizeText : sanitizeHtml

  const result: any = {}

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      result[key] = sanitize(value)
    } else if (Array.isArray(value)) {
      result[key] = value.map(item =>
        typeof item === 'object' && item !== null ? sanitizeObject(item, options) : item
      )
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value, options)
    } else {
      result[key] = value
    }
  }

  return result as T
}

/**
 * 批量清理数组中的所有对象
 *
 * @param array 待清理的对象数组
 * @param options 清理选项
 * @returns 清理后的数组
 */
export function sanitizeArray<T extends Record<string, any>>(
  array: T[],
  options: { mode: 'text' | 'html' } = { mode: 'text' }
): T[] {
  return array.map(item => sanitizeObject(item, options))
}
