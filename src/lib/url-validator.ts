/**
 * URL安全验证工具
 * 防止XSS和开放重定向攻击
 */

/**
 * 允许的图片URL域名白名单
 * 生产环境应该从配置文件读取
 */
const ALLOWED_IMAGE_DOMAINS = [
  // AWS S3
  '.amazonaws.com',
  's3.amazonaws.com',
  // 阿里云OSS
  '.aliyuncs.com',
  // 腾讯云COS
  '.myqcloud.com',
  // 七牛云
  '.qiniucdn.com',
  '.qiniudn.com',
  // 又拍云
  '.upaiyun.com',
  // 本地开发
  'localhost',
  '127.0.0.1'
]

/**
 * 允许的图片文件扩展名
 */
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp']

/**
 * 验证URL是否安全
 * @param url - 待验证的URL
 * @returns 是否是安全的URL
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false
  }

  try {
    const parsed = new URL(url)

    // 只允许https协议（生产环境）或http（开发环境）
    const isDevMode = process.env.NODE_ENV === 'development'
    const allowedProtocols = isDevMode ? ['http:', 'https:'] : ['https:']

    if (!allowedProtocols.includes(parsed.protocol)) {
      return false
    }

    // 检查域名白名单
    const hostname = parsed.hostname.toLowerCase()
    const isAllowedDomain = ALLOWED_IMAGE_DOMAINS.some(domain => {
      if (domain.startsWith('.')) {
        return hostname.endsWith(domain) || hostname === domain.slice(1)
      }
      return hostname === domain
    })

    if (!isAllowedDomain) {
      return false
    }

    // 检查文件扩展名
    const pathname = parsed.pathname.toLowerCase()
    const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext =>
      pathname.endsWith(ext)
    )

    if (!hasValidExtension) {
      return false
    }

    return true
  } catch (error) {
    // URL解析失败
    return false
  }
}

/**
 * 验证并返回安全的URL，如果不安全则返回null
 * @param url - 待验证的URL
 * @returns 安全的URL或null
 */
export function getSafeUrl(url: string): string | null {
  return isSafeUrl(url) ? url : null
}

/**
 * 获取URL验证错误消息
 * @param url - 待验证的URL
 * @returns 错误消息或null
 */
export function getUrlValidationError(url: string): string | null {
  if (!url) {
    return '请输入URL'
  }

  try {
    const parsed = new URL(url)

    const isDevMode = process.env.NODE_ENV === 'development'
    const allowedProtocols = isDevMode ? ['http:', 'https:'] : ['https:']

    if (!allowedProtocols.includes(parsed.protocol)) {
      return isDevMode
        ? '只允许HTTP或HTTPS协议'
        : '只允许HTTPS协议'
    }

    const hostname = parsed.hostname.toLowerCase()
    const isAllowedDomain = ALLOWED_IMAGE_DOMAINS.some(domain => {
      if (domain.startsWith('.')) {
        return hostname.endsWith(domain) || hostname === domain.slice(1)
      }
      return hostname === domain
    })

    if (!isAllowedDomain) {
      return '不支持该域名，请使用允许的云存储服务'
    }

    const pathname = parsed.pathname.toLowerCase()
    const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext =>
      pathname.endsWith(ext)
    )

    if (!hasValidExtension) {
      return '只支持图片文件：JPG, PNG, GIF, WebP'
    }

    return null
  } catch (error) {
    return '无效的URL格式'
  }
}
