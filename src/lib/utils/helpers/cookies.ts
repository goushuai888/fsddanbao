/**
 * Cookie工具函数
 *
 * 安全修复: CVSS 9.1
 * 支持Next.js中间件通过cookie读取JWT token
 */

/**
 * 设置Cookie
 *
 * @param name Cookie名称
 * @param value Cookie值
 * @param days 有效天数（默认7天，与JWT过期时间一致）
 */
export function setCookie(name: string, value: string, days: number = 7): void {
  const date = new Date()
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000)
  const expires = `expires=${date.toUTCString()}`

  // 设置安全属性
  const secure = window.location.protocol === 'https:' ? 'Secure;' : ''
  const sameSite = 'SameSite=Lax;' // 防止CSRF攻击

  document.cookie = `${name}=${value};${expires};path=/;${secure}${sameSite}`
}

/**
 * 获取Cookie
 *
 * @param name Cookie名称
 * @returns Cookie值或null
 */
export function getCookie(name: string): string | null {
  const nameEQ = `${name}=`
  const cookies = document.cookie.split(';')

  for (let i = 0; i < cookies.length; i++) {
    let cookie = cookies[i]
    while (cookie.charAt(0) === ' ') {
      cookie = cookie.substring(1, cookie.length)
    }
    if (cookie.indexOf(nameEQ) === 0) {
      return cookie.substring(nameEQ.length, cookie.length)
    }
  }

  return null
}

/**
 * 删除Cookie
 *
 * @param name Cookie名称
 */
export function deleteCookie(name: string): void {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`
}

/**
 * 保存认证Token（同时保存到localStorage和Cookie）
 *
 * @param token JWT token
 */
export function setAuthToken(token: string): void {
  // 保存到localStorage（客户端JavaScript使用）
  localStorage.setItem('token', token)

  // 保存到Cookie（Next.js中间件使用）
  setCookie('token', token, 7) // 7天有效期
}

/**
 * 清除认证Token（同时从localStorage和Cookie删除）
 */
export function clearAuthToken(): void {
  // 从localStorage删除
  localStorage.removeItem('token')
  localStorage.removeItem('user')

  // 从Cookie删除
  deleteCookie('token')
}
