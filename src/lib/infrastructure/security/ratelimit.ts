import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * 请求限流配置
 *
 * 安全修复: CVSS 7.5
 * 防止暴力破解、DoS攻击和API滥用
 *
 * 使用Upstash Redis作为存储后端（推荐用于生产环境）
 * 如果未配置Upstash，将使用内存存储（仅适用于开发环境）
 */

// Redis客户端
let redis: Redis | null = null

// 尝试初始化Upstash Redis
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
  console.warn('✅ Rate limiting: Using Upstash Redis (recommended for production)')
} else {
  // ⚠️ 生产环境检查
  if (process.env.NODE_ENV === 'production') {
    console.error('⚠️ WARNING: Production environment detected but Upstash Redis is NOT configured!')
    console.error('⚠️ Rate limiting is using in-memory storage which will NOT work correctly in:')
    console.error('   - Multi-instance deployments (each instance has separate memory)')
    console.error('   - Serverless environments (memory resets on each cold start)')
    console.error('⚠️ This is a SECURITY RISK: Attackers can bypass rate limits!')
    console.error('⚠️ Please configure Upstash Redis environment variables:')
    console.error('   - UPSTASH_REDIS_REST_URL')
    console.error('   - UPSTASH_REDIS_REST_TOKEN')
    console.error('⚠️ Get free Redis at: https://upstash.com')
  } else {
    console.warn('ℹ️ Rate limiting: Using in-memory storage (development mode only)')
  }
}

// 内存存储（开发环境fallback）
const memoryStore = new Map<string, { count: number; reset: number }>()

/**
 * 简单的内存限流实现（仅用于开发环境）
 */
function memoryRatelimit(key: string, limit: number, window: number): { success: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const record = memoryStore.get(key)

  if (!record || now > record.reset) {
    // 新窗口
    memoryStore.set(key, { count: 1, reset: now + window })
    return { success: true, remaining: limit - 1, reset: now + window }
  }

  if (record.count >= limit) {
    // 超出限制
    return { success: false, remaining: 0, reset: record.reset }
  }

  // 增加计数
  record.count++
  memoryStore.set(key, record)
  return { success: true, remaining: limit - record.count, reset: record.reset }
}

/**
 * 认证端点限流（登录、注册）
 * - 每个IP: 5次/分钟
 * - 防止暴力破解
 */
export const authLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '1 m'),
      analytics: true,
      prefix: 'ratelimit:auth',
    })
  : {
      limit: async (key: string) => memoryRatelimit(key, 5, 60000)
    }

/**
 * API端点限流（订单操作、支付等）
 * - 每个IP: 30次/分钟
 * - 防止API滥用
 */
export const apiLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 m'),
      analytics: true,
      prefix: 'ratelimit:api',
    })
  : {
      limit: async (key: string) => memoryRatelimit(key, 30, 60000)
    }

/**
 * 管理员操作限流
 * - 每个用户: 60次/分钟
 * - 防止管理员账号被滥用
 */
export const adminLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 m'),
      analytics: true,
      prefix: 'ratelimit:admin',
    })
  : {
      limit: async (key: string) => memoryRatelimit(key, 60, 60000)
    }

/**
 * 敏感操作限流（退款、申诉、取消订单）
 * - 每个用户: 10次/小时
 * - 防止恶意操作
 */
export const sensitiveLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      analytics: true,
      prefix: 'ratelimit:sensitive',
    })
  : {
      limit: async (key: string) => memoryRatelimit(key, 10, 3600000)
    }

/**
 * 获取客户端IP地址
 */
export function getClientIp(request: Request): string {
  // 优先从X-Forwarded-For获取（代理/负载均衡场景）
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  // 其他常见的代理header
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }

  // Cloudflare
  const cfConnectingIp = request.headers.get('cf-connecting-ip')
  if (cfConnectingIp) {
    return cfConnectingIp
  }

  // 默认返回localhost（开发环境）
  return '127.0.0.1'
}

/**
 * 辅助函数：检查限流并返回标准错误响应
 */
export async function checkRateLimit(
  limiter: typeof authLimiter,
  identifier: string
): Promise<{ success: true } | { success: false; response: Response }> {
  const { success, remaining, reset } = await limiter.limit(identifier)

  if (!success) {
    const resetDate = new Date(reset)
    return {
      success: false,
      response: new Response(
        JSON.stringify({
          success: false,
          error: '请求过于频繁，请稍后再试',
          retryAfter: resetDate.toISOString(),
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': String(limiter === authLimiter ? 5 : 30),
            'X-RateLimit-Remaining': String(remaining),
            'X-RateLimit-Reset': resetDate.toISOString(),
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      ),
    }
  }

  return { success: true }
}
