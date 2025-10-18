import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

/**
 * Next.js Middleware - 路由保护和JWT验证
 *
 * 安全修复: CVSS 8.1 - 真正的JWT验证而非仅检查Cookie存在性
 *
 * 使用 jose 库进行 Edge Runtime 兼容的 JWT 验证
 */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 只保护 /admin 路由（排除 /api/admin，因为API有自己的认证）
  if (pathname.startsWith('/admin') && !pathname.startsWith('/api/admin')) {
    // 检查是否存在token cookie
    const tokenFromCookie = request.cookies.get('token')?.value

    // 如果没有token，重定向到登录页
    if (!tokenFromCookie) {
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      loginUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(loginUrl)
    }

    // ✅ 安全修复: 验证JWT签名和有效期
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET)

      // 验证JWT token
      const { payload } = await jwtVerify(tokenFromCookie, secret)

      // 检查是否为管理员
      if (payload.role !== 'ADMIN') {
        const loginUrl = new URL('/login', request.url)
        loginUrl.searchParams.set('error', 'forbidden')
        loginUrl.searchParams.set('message', 'Access denied: Admin only')
        return NextResponse.redirect(loginUrl)
      }

      // Token有效且是管理员，继续执行
      return NextResponse.next()
    } catch (error) {
      // Token无效（签名错误、过期等），重定向到登录页
      const loginUrl = new URL('/login', request.url)
      loginUrl.searchParams.set('redirect', pathname)
      loginUrl.searchParams.set('error', 'invalid_token')
      loginUrl.searchParams.set('message', 'Session expired, please login again')
      return NextResponse.redirect(loginUrl)
    }
  }

  // 其他路由正常通过
  return NextResponse.next()
}

/**
 * Matcher配置 - 指定中间件应用的路径
 */
export const config = {
  matcher: [
    /*
     * 匹配所有路径除了:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

