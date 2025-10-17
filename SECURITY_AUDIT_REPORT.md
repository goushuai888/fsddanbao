# FSD担保交易平台安全审计报告

**审计时间**: 2025-10-17
**项目版本**: v1.2.0
**审计范围**: 认证系统、API安全、业务逻辑、数据安全、依赖安全

---

## 🔴 高危漏洞 (Critical)

### 1. JWT密钥硬编码回退 - 严重安全隐患
**文件**: `/src/lib/auth.ts:4`
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'
```

**漏洞描述**:
- JWT密钥使用了弱默认值作为回退
- 如果环境变量未设置,将使用可预测的默认密钥
- 攻击者可以伪造任意JWT token,完全绕过身份验证
- 可以提权为ADMIN角色,接管整个系统

**影响范围**:
- 所有API端点的认证机制失效
- 攻击者可以访问任何用户账户
- 可以进行未授权的资金操作

**修复方案**:
```typescript
// src/lib/auth.ts
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET 环境变量未设置,无法启动应用!')
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',  // 明确指定算法
    issuer: 'fsd-escrow',  // 添加发行者
    audience: 'fsd-users'  // 添加受众
  })
}

export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],  // 防止算法混淆攻击
      issuer: 'fsd-escrow',
      audience: 'fsd-users'
    }) as TokenPayload
  } catch (error) {
    console.error('Token验证失败:', error instanceof Error ? error.message : '未知错误')
    return null
  }
}
```

**额外建议**:
- 使用至少32字节的随机密钥
- 考虑使用RS256非对称加密算法
- 实施密钥轮换机制

---

### 2. 订单状态竞态条件 - 双重支付风险
**文件**: `/src/app/api/orders/[id]/route.ts:161-179`

**漏洞描述**:
- 支付操作(action='pay')缺乏并发控制
- 多个买家可以同时支付同一个PUBLISHED订单
- 没有使用数据库事务和乐观锁
- 可能导致多个买家同时成为订单的买家

**攻击场景**:
```
时间线:
T1: 买家A调用支付API,订单状态=PUBLISHED
T2: 买家B调用支付API,订单状态仍然=PUBLISHED (查询在A更新前)
T3: A的更新执行,buyerId=A,status=PAID
T4: B的更新执行,buyerId=B,status=PAID (覆盖A的支付!)
结果: 两个买家都认为自己支付成功,但只有最后的记录被保存
```

**修复方案**:
```typescript
// src/app/api/orders/[id]/route.ts
case 'pay':
  // 使用事务+乐观锁
  try {
    updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. 重新查询并锁定订单行
      const currentOrder = await tx.order.findUnique({
        where: { id: params.id }
      })

      if (!currentOrder) {
        throw new Error('订单不存在')
      }

      // 2. 检查状态(防止TOCTOU)
      if (currentOrder.status !== 'PUBLISHED') {
        throw new Error('订单状态已变更,不允许支付')
      }

      // 3. 检查是否已有买家
      if (currentOrder.buyerId) {
        throw new Error('订单已被其他买家购买')
      }

      // 4. 原子更新
      return await tx.order.update({
        where: {
          id: params.id,
          status: 'PUBLISHED',  // 确保状态未变
          buyerId: null  // 确保没有买家
        },
        data: {
          buyerId: payload.userId,
          status: 'PAID',
          paidAt: new Date(),
          escrowAmount: currentOrder.price
        }
      })
    })
  } catch (error: any) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error.message || '支付失败'
    }, { status: 400 })
  }
  break
```

**补充防护**:
- 添加数据库唯一约束: `@@unique([id, status])` 在关键状态转换时
- 实现幂等性检查
- 添加支付日志审计

---

### 3. 管理员权限缺乏二次验证 - 权限提升风险
**文件**: 多个管理员API路由

**漏洞描述**:
- 管理员操作仅依赖JWT中的role字段
- 没有二次验证机制
- 一旦JWT泄露,攻击者可以进行任意管理员操作
- 缺少操作日志和审计跟踪

**受影响的端点**:
- `/api/admin/users/[id]` - 修改/删除用户,包括修改余额
- `/api/admin/disputes/[id]` - 处理申诉,控制资金流向
- `/api/admin/withdrawals/[id]` - 批准提现,直接涉及资金
- `/api/admin/refunds/[id]` - 处理退款,控制资金

**修复方案**:

1. **添加操作审计日志**:
```typescript
// src/lib/audit.ts
import { prisma } from './prisma'

export async function logAdminAction(params: {
  adminId: string
  action: string
  resourceType: string
  resourceId: string
  details?: any
  ipAddress?: string
}) {
  await prisma.adminLog.create({
    data: {
      adminId: params.adminId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: JSON.stringify(params.details),
      ipAddress: params.ipAddress,
      timestamp: new Date()
    }
  })
}

// 添加到schema.prisma
model AdminLog {
  id           String   @id @default(cuid())
  adminId      String
  admin        User     @relation(fields: [adminId], references: [id])
  action       String   // 'UPDATE_USER', 'APPROVE_WITHDRAWAL', etc.
  resourceType String   // 'User', 'Order', 'Withdrawal'
  resourceId   String
  details      String?  // JSON
  ipAddress    String?
  timestamp    DateTime @default(now())
}
```

2. **敏感操作需要重新验证**:
```typescript
// src/lib/admin-verify.ts
export async function requireAdminReauth(
  request: NextRequest,
  adminId: string
): Promise<boolean> {
  // 检查最近是否重新验证过(例如15分钟内)
  const reauthToken = request.headers.get('x-admin-reauth')

  if (!reauthToken) {
    return false
  }

  // 验证重认证token(可以是短期token,只用于敏感操作)
  // 实现略
  return true
}

// 在敏感API中使用
export async function PATCH(request: NextRequest, { params }: any) {
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'ADMIN') {
    return NextResponse.json({ success: false, error: '无权访问' }, { status: 403 })
  }

  // 敏感操作需要二次验证
  if (!(await requireAdminReauth(request, payload.userId))) {
    return NextResponse.json({
      success: false,
      error: '此操作需要重新验证身份',
      requireReauth: true
    }, { status: 403 })
  }

  // 记录审计日志
  await logAdminAction({
    adminId: payload.userId,
    action: 'UPDATE_USER_BALANCE',
    resourceType: 'User',
    resourceId: params.id,
    details: body,
    ipAddress: request.headers.get('x-forwarded-for') || 'unknown'
  })

  // 执行操作...
}
```

---

### 4. 余额操作缺乏事务一致性 - 资金安全风险
**文件**: `/src/app/api/admin/withdrawals/[id]/route.ts`, `/src/app/api/orders/[id]/route.ts`

**漏洞描述**:
- 余额扣减/增加操作在部分场景下缺乏事务保护
- 可能出现余额不一致
- 缺少余额变更审计

**问题示例 - 订单完成释放款项**:
```typescript
// /src/app/api/orders/[id]/route.ts:232-241
// 现有代码
updatedOrder = await prisma.order.update({
  where: { id: params.id },
  data: { status: 'COMPLETED', completedAt: new Date() }
})

// 如果这里发生异常,订单已更新但款项未释放!
await prisma.payment.create({
  data: { /* 创建支付记录 */ }
})
```

**修复方案**:
```typescript
case 'confirm':
  // 买家确认收货 - 必须使用事务
  if (order.status !== 'TRANSFERRING') {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '订单状态不正确'
    }, { status: 400 })
  }

  if (order.buyerId !== payload.userId) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '无权操作'
    }, { status: 403 })
  }

  // 使用事务确保原子性
  const result = await prisma.$transaction(async (tx) => {
    // 1. 更新订单状态
    const updatedOrder = await tx.order.update({
      where: { id: params.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date()
      }
    })

    // 2. 计算卖家应得金额
    const sellerAmount = order.price - (order.platformFee || 0)

    // 3. 增加卖家余额
    await tx.user.update({
      where: { id: order.sellerId },
      data: {
        balance: { increment: sellerAmount }
      }
    })

    // 4. 创建支付记录
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        userId: order.sellerId,
        amount: sellerAmount,
        type: 'RELEASE',
        status: 'COMPLETED',
        note: '订单完成,款项释放给卖家'
      }
    })

    // 5. 记录平台收入
    const platformRevenue = order.platformFee || 0
    if (platformRevenue > 0) {
      await tx.platformRevenue.create({
        data: {
          orderId: order.id,
          amount: platformRevenue,
          source: 'TRANSACTION_FEE',
          createdAt: new Date()
        }
      })
    }

    return { updatedOrder, payment }
  }, {
    isolationLevel: 'Serializable',  // 最高隔离级别
    timeout: 10000  // 10秒超时
  })

  updatedOrder = result.updatedOrder
  break
```

**补充建议**:
- 实现余额变更日志表记录所有变更
- 定期对账,确保 `sum(payments) = user.balance`
- 添加余额不足检查(防止负数)

---

## 🟠 中危漏洞 (High/Medium)

### 5. CSRF防护缺失
**影响范围**: 所有状态修改API

**漏洞描述**:
- Next.js API路由默认不包含CSRF保护
- 攻击者可以诱导已登录用户执行非预期操作
- 涉及资金的操作尤其危险

**攻击场景**:
```html
<!-- 攻击者网站 evil.com -->
<script>
  // 受害者已登录fsd平台
  fetch('https://fsd-platform.com/api/orders/xxx', {
    method: 'PATCH',
    headers: {
      'Authorization': 'Bearer ' + localStorage.getItem('token'), // 浏览器自动带上
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ action: 'cancel' })
  })
</script>
```

**修复方案**:

1. **实现CSRF Token**:
```typescript
// src/lib/csrf.ts
import crypto from 'crypto'

// 生成CSRF token
export function generateCsrfToken(userId: string, secret: string): string {
  const timestamp = Date.now()
  const data = `${userId}:${timestamp}`
  const hash = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('hex')

  return Buffer.from(`${data}:${hash}`).toString('base64')
}

// 验证CSRF token
export function verifyCsrfToken(
  token: string,
  userId: string,
  secret: string,
  maxAge: number = 3600000 // 1小时
): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8')
    const [uid, timestamp, hash] = decoded.split(':')

    // 验证用户ID
    if (uid !== userId) return false

    // 验证时效
    if (Date.now() - parseInt(timestamp) > maxAge) return false

    // 验证签名
    const expectedHash = crypto
      .createHmac('sha256', secret)
      .update(`${uid}:${timestamp}`)
      .digest('hex')

    return hash === expectedHash
  } catch {
    return false
  }
}
```

2. **在API中使用**:
```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyCsrfToken, verifyToken } from '@/lib/auth'

const CSRF_SECRET = process.env.CSRF_SECRET || ''

export function middleware(request: NextRequest) {
  // 仅对状态修改方法检查CSRF
  if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token')
    const authToken = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!csrfToken || !authToken) {
      return NextResponse.json(
        { success: false, error: 'CSRF token missing' },
        { status: 403 }
      )
    }

    const payload = verifyToken(authToken)
    if (!payload) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 401 }
      )
    }

    if (!verifyCsrfToken(csrfToken, payload.userId, CSRF_SECRET)) {
      return NextResponse.json(
        { success: false, error: 'Invalid CSRF token' },
        { status: 403 }
      )
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*'
}
```

3. **前端获取和使用CSRF Token**:
```typescript
// 登录后获取CSRF token
const csrfToken = response.data.csrfToken
localStorage.setItem('csrfToken', csrfToken)

// 所有请求带上CSRF token
axios.defaults.headers.common['X-CSRF-Token'] = csrfToken
```

---

### 6. 敏感信息日志泄露
**文件**: 多处使用 `console.error`

**漏洞描述**:
- 错误日志可能包含敏感信息(密码、token、完整错误堆栈)
- 生产环境日志可能被未授权访问
- 缺少日志脱敏机制

**问题代码示例**:
```typescript
// src/app/api/auth/login/route.ts:63
console.error('登录错误:', error)  // 可能包含数据库连接串等敏感信息
```

**修复方案**:

1. **实现安全日志记录器**:
```typescript
// src/lib/logger.ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogContext {
  userId?: string
  requestId?: string
  endpoint?: string
  [key: string]: any
}

class Logger {
  private shouldLog(level: LogLevel): boolean {
    const currentLevel = process.env.LOG_LEVEL || 'info'
    const levels = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(currentLevel)
  }

  private sanitize(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data
    }

    const sensitiveKeys = [
      'password', 'token', 'secret', 'authorization',
      'cookie', 'credit_card', 'ssn', 'api_key'
    ]

    const sanitized = Array.isArray(data) ? [...data] : { ...data }

    for (const key in sanitized) {
      const lowerKey = key.toLowerCase()

      // 脱敏敏感字段
      if (sensitiveKeys.some(sk => lowerKey.includes(sk))) {
        sanitized[key] = '***REDACTED***'
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitize(sanitized[key])
      }
    }

    return sanitized
  }

  private formatError(error: unknown): string {
    if (error instanceof Error) {
      // 生产环境不输出堆栈
      if (process.env.NODE_ENV === 'production') {
        return `${error.name}: ${error.message}`
      }
      return error.stack || error.message
    }
    return String(error)
  }

  error(message: string, error?: unknown, context?: LogContext) {
    if (!this.shouldLog('error')) return

    const logData = {
      level: 'error',
      message,
      error: error ? this.formatError(error) : undefined,
      context: this.sanitize(context),
      timestamp: new Date().toISOString()
    }

    // 生产环境发送到日志服务
    if (process.env.NODE_ENV === 'production') {
      // 发送到Sentry、DataDog等
      this.sendToLogService(logData)
    } else {
      console.error(JSON.stringify(logData, null, 2))
    }
  }

  info(message: string, context?: LogContext) {
    if (!this.shouldLog('info')) return
    console.log(JSON.stringify({
      level: 'info',
      message,
      context: this.sanitize(context),
      timestamp: new Date().toISOString()
    }))
  }

  private sendToLogService(data: any) {
    // TODO: 实现发送到远程日志服务
  }
}

export const logger = new Logger()
```

2. **替换所有console.error**:
```typescript
// Before
console.error('登录错误:', error)

// After
import { logger } from '@/lib/logger'

logger.error('用户登录失败', error, {
  endpoint: '/api/auth/login',
  email: email  // 会自动脱敏
})
```

---

### 7. 输入验证不足
**文件**: 多个API端点

**漏洞描述**:
- 缺少严格的输入验证和清理
- 可能导致XSS、SQL注入(虽然Prisma有保护)、业务逻辑绕过

**问题示例**:
```typescript
// src/app/api/auth/register/route.ts:8
const { email, password, name, phone, role } = await request.json()
// 没有验证email格式、密码强度、role值是否合法
```

**修复方案**:

1. **使用Zod进行输入验证**:
```typescript
// src/lib/validators.ts
import { z } from 'zod'

export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确').min(1, '邮箱不能为空'),
  password: z.string()
    .min(8, '密码至少8位')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[a-z]/, '密码必须包含小写字母')
    .regex(/[0-9]/, '密码必须包含数字')
    .regex(/[^A-Za-z0-9]/, '密码必须包含特殊字符'),
  name: z.string().max(50, '姓名过长').optional(),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),
  role: z.enum(['BUYER', 'SELLER'], {
    errorMap: () => ({ message: '角色参数无效' })
  }).default('BUYER')
})

export const createOrderSchema = z.object({
  vehicleBrand: z.string().min(1, '车辆品牌不能为空').max(50),
  vehicleModel: z.string().min(1, '车辆型号不能为空').max(50),
  vehicleYear: z.number()
    .int('年份必须是整数')
    .min(2012, '年份不能早于2012年')
    .max(new Date().getFullYear() + 1, '年份不能超过明年'),
  vin: z.string()
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/, '车架号格式不正确')
    .optional(),
  fsdVersion: z.string().min(1, 'FSD版本不能为空').max(20),
  price: z.number()
    .positive('价格必须大于0')
    .max(1000000, '价格不能超过100万')
    .refine(val => Number.isFinite(val), '价格必须是有效数字')
})

export const withdrawalSchema = z.object({
  amount: z.number().positive('提现金额必须大于0').max(1000000),
  withdrawMethod: z.enum(['bank', 'alipay', 'wechat']),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  accountName: z.string().optional(),
  alipayAccount: z.string().email().optional(),
  wechatAccount: z.string().optional()
}).refine(
  (data) => {
    if (data.withdrawMethod === 'bank') {
      return !!(data.bankName && data.bankAccount && data.accountName)
    }
    if (data.withdrawMethod === 'alipay') {
      return !!data.alipayAccount
    }
    if (data.withdrawMethod === 'wechat') {
      return !!data.wechatAccount
    }
    return false
  },
  { message: '请完整填写收款信息' }
)
```

2. **在API中使用**:
```typescript
// src/app/api/auth/register/route.ts
import { registerSchema } from '@/lib/validators'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // 验证输入
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: validation.error.errors[0].message,
        errors: validation.error.errors  // 返回所有错误
      }, { status: 400 })
    }

    const { email, password, name, phone, role } = validation.data

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    })

    if (existingUser) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '该邮箱已被注册'
      }, { status: 400 })
    }

    // ... 其余逻辑
  } catch (error) {
    logger.error('用户注册失败', error, {
      endpoint: '/api/auth/register'
    })
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
```

---

### 8. 限流和DDoS防护缺失
**影响范围**: 所有API端点

**漏洞描述**:
- 没有实施限流措施
- 容易遭受暴力破解(登录、支付)
- 可能被DDoS攻击耗尽资源

**修复方案**:

1. **实现基于Redis的限流中间件**:
```typescript
// src/lib/rate-limit.ts
import { NextRequest, NextResponse } from 'next/server'

// 简单内存限流(生产环境应使用Redis)
const requestCounts = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitConfig {
  windowMs: number  // 时间窗口(毫秒)
  maxRequests: number  // 最大请求数
  message?: string
  keyGenerator?: (request: NextRequest) => string
}

export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest) => {
    const key = config.keyGenerator
      ? config.keyGenerator(request)
      : request.headers.get('x-forwarded-for') || 'unknown'

    const now = Date.now()
    const record = requestCounts.get(key)

    if (!record || now > record.resetAt) {
      // 新窗口
      requestCounts.set(key, {
        count: 1,
        resetAt: now + config.windowMs
      })
      return null  // 允许请求
    }

    if (record.count >= config.maxRequests) {
      // 超出限制
      return NextResponse.json({
        success: false,
        error: config.message || '请求过于频繁,请稍后再试',
        retryAfter: Math.ceil((record.resetAt - now) / 1000)
      }, {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((record.resetAt - now) / 1000))
        }
      })
    }

    // 增加计数
    record.count++
    return null  // 允许请求
  }
}

// 预定义的限流配置
export const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15分钟
  maxRequests: 5,  // 最多5次登录尝试
  message: '登录尝试次数过多,请15分钟后再试',
  keyGenerator: (req) => {
    // 根据IP+邮箱限流
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    return `login:${ip}`
  }
})

export const paymentRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1分钟
  maxRequests: 3,  // 最多3次支付操作
  message: '操作过于频繁',
  keyGenerator: (req) => {
    const token = req.headers.get('authorization')
    // 从token提取userId
    return `payment:${token}`
  }
})

export const generalApiRateLimit = rateLimit({
  windowMs: 60 * 1000,  // 1分钟
  maxRequests: 100,  // 最多100个请求
  keyGenerator: (req) => {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    return `api:${ip}`
  }
})
```

2. **在API中使用**:
```typescript
// src/app/api/auth/login/route.ts
import { loginRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  // 检查限流
  const limitResult = await loginRateLimit(request)
  if (limitResult) {
    return limitResult  // 返回429错误
  }

  // 正常处理登录逻辑
  // ...
}
```

---

### 9. 会话管理问题 - Token无法撤销
**文件**: `/src/lib/auth.ts`

**漏洞描述**:
- JWT是无状态的,一旦签发无法主动撤销
- 用户密码修改后,旧token仍然有效
- 没有实现token黑名单或刷新token机制
- 7天的超长有效期增加了风险

**修复方案**:

1. **实现Token黑名单(使用Redis)**:
```typescript
// src/lib/token-blacklist.ts
import { Redis } from 'ioredis'

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

export async function blacklistToken(token: string, expiresIn: number) {
  // 存储到Redis,过期时间与token过期时间一致
  await redis.setex(`blacklist:${token}`, expiresIn, '1')
}

export async function isTokenBlacklisted(token: string): Promise<boolean> {
  const result = await redis.get(`blacklist:${token}`)
  return result === '1'
}

// 修改verifyToken函数
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  if (!token) return null

  // 检查黑名单
  if (await isTokenBlacklisted(token)) {
    return null
  }

  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    }) as TokenPayload
  } catch (error) {
    return null
  }
}
```

2. **实现Refresh Token机制**:
```typescript
// src/lib/auth.ts
export function generateTokenPair(payload: TokenPayload) {
  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '15m',  // 短期access token
    algorithm: 'HS256'
  })

  const refreshToken = jwt.sign(
    { userId: payload.userId, type: 'refresh' },
    JWT_SECRET,
    { expiresIn: '7d', algorithm: 'HS256' }
  )

  return { accessToken, refreshToken }
}

// 添加刷新token的API
// src/app/api/auth/refresh/route.ts
export async function POST(request: NextRequest) {
  const { refreshToken } = await request.json()

  try {
    const payload = jwt.verify(refreshToken, JWT_SECRET) as any

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type')
    }

    // 检查黑名单
    if (await isTokenBlacklisted(refreshToken)) {
      throw new Error('Token revoked')
    }

    // 获取最新用户信息
    const user = await prisma.user.findUnique({
      where: { id: payload.userId }
    })

    if (!user) {
      throw new Error('User not found')
    }

    // 生成新的token对
    const newTokens = generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role
    })

    return NextResponse.json({
      success: true,
      data: newTokens
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Invalid refresh token'
    }, { status: 401 })
  }
}
```

3. **添加登出功能**:
```typescript
// src/app/api/auth/logout/route.ts
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')

  if (token) {
    const payload = verifyToken(token)
    if (payload) {
      // 计算token剩余有效期
      const decoded = jwt.decode(token, { complete: true })
      const expiresIn = decoded.payload.exp - Math.floor(Date.now() / 1000)

      if (expiresIn > 0) {
        await blacklistToken(token, expiresIn)
      }
    }
  }

  return NextResponse.json({
    success: true,
    message: '登出成功'
  })
}
```

---

## 🟡 中低危漏洞 (Medium-Low)

### 10. 密码加密强度不足
**文件**: `/src/lib/auth.ts:29`

**漏洞描述**:
- bcrypt轮数为10,现代标准建议12-14
- 没有实施密码策略(复杂度要求)

**修复方案**:
```typescript
// src/lib/auth.ts
export async function hashPassword(password: string): Promise<string> {
  // 使用12轮,更安全(但会稍慢)
  return bcrypt.hash(password, 12)
}

// 添加密码强度检查
export function validatePasswordStrength(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (password.length < 8) {
    errors.push('密码至少8位')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('密码必须包含大写字母')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('密码必须包含小写字母')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('密码必须包含数字')
  }
  if (!/[^A-Za-z0-9]/.test(password)) {
    errors.push('密码必须包含特殊字符')
  }

  // 检查常见弱密码
  const commonPasswords = ['password123', '12345678', 'admin123']
  if (commonPasswords.includes(password.toLowerCase())) {
    errors.push('密码过于常见,请使用更强的密码')
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

---

### 11. 敏感数据明文存储和传输
**文件**: `prisma/schema.prisma`, 多个API响应

**漏洞描述**:
- 手机号、车架号等敏感信息明文存储
- API响应包含完整的敏感信息
- 缺少字段级加密

**修复方案**:

1. **敏感字段加密**:
```typescript
// src/lib/crypto.ts
import crypto from 'crypto'

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || ''  // 32字节密钥
const ALGORITHM = 'aes-256-gcm'

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)')
}

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  )

  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // 格式: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':')

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  )

  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'))

  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
```

2. **数据脱敏输出**:
```typescript
// src/lib/sanitize.ts
export function sanitizeUser(user: any, viewerRole: string) {
  const sanitized = { ...user }

  // 移除密码(永远不返回)
  delete sanitized.password

  // 非管理员只能看到部分手机号
  if (viewerRole !== 'ADMIN' && sanitized.phone) {
    sanitized.phone = maskString(sanitized.phone, 3, 4)
  }

  return sanitized
}

export function sanitizeOrder(order: any, viewerId: string, viewerRole: string) {
  const sanitized = { ...order }

  // 只有订单参与方和管理员能看到完整VIN
  const isParticipant = order.sellerId === viewerId || order.buyerId === viewerId
  if (!isParticipant && viewerRole !== 'ADMIN' && sanitized.vin) {
    sanitized.vin = maskString(sanitized.vin, 4, 4)
  }

  // 只有参与方能看到联系方式
  if (!isParticipant && viewerRole !== 'ADMIN') {
    if (sanitized.seller?.phone) {
      sanitized.seller.phone = '***'
    }
    if (sanitized.buyer?.phone) {
      sanitized.buyer.phone = '***'
    }
  }

  return sanitized
}
```

---

### 12. 错误信息泄露
**文件**: 多个API路由

**漏洞描述**:
- 数据库错误直接返回给前端
- 可能泄露数据库结构、表名等信息

**修复方案**:
```typescript
// 通用错误处理器
function handleApiError(error: unknown, context: string): NextResponse {
  logger.error(`API错误: ${context}`, error)

  // 开发环境返回详细错误
  if (process.env.NODE_ENV === 'development') {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }

  // 生产环境返回通用错误
  return NextResponse.json({
    success: false,
    error: '服务器错误,请稍后重试',
    errorId: crypto.randomUUID()  // 错误ID用于追踪日志
  }, { status: 500 })
}

// 使用示例
export async function POST(request: NextRequest) {
  try {
    // ... 业务逻辑
  } catch (error) {
    return handleApiError(error, 'POST /api/orders')
  }
}
```

---

### 13. XSS防护不足
**影响范围**: 前端渲染用户输入的地方

**漏洞描述**:
- 订单备注、申诉描述等用户输入可能包含恶意脚本
- React默认转义,但使用dangerouslySetInnerHTML或不当操作可能引入XSS

**修复方案**:

1. **内容安全策略(CSP)**:
```typescript
// src/middleware.ts (或 next.config.js)
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // 生产环境应移除unsafe
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https://api.yourdomain.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; ')
  )

  // 其他安全头
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  return response
}
```

2. **输入清理**:
```typescript
// src/lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href']
  })
}

// 在存储前清理
const sanitizedDescription = sanitizeHtml(body.description)
```

---

## 🟢 低危问题 (Low)

### 14. 缺少安全响应头
**修复方案**: 见上面CSP配置

### 15. 环境变量管理
**问题**: `.env.example`包含弱默认值

**修复方案**:
```bash
# .env.example - 移除所有默认值
DATABASE_URL=
JWT_SECRET=
ENCRYPTION_KEY=
CSRF_SECRET=
REDIS_URL=

# 添加环境变量验证
# src/lib/env.ts
export function validateEnv() {
  const required = [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'CSRF_SECRET'
  ]

  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`缺少必需的环境变量: ${missing.join(', ')}`)
  }

  // 验证密钥长度
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET必须至少32字符')
  }
}

// 在应用启动时调用
validateEnv()
```

### 16. 依赖安全
**当前状态**: pnpm audit显示无漏洞

**建议**:
- 定期运行 `pnpm audit`
- 使用Dependabot或Renovate自动更新依赖
- 锁定关键依赖版本

---

## 业务逻辑审计

### 17. 订单状态流转完整性
**潜在问题**:
- 退款后余额增加,但没有检查余额操作是否成功
- 申诉处理后资金流向,缺少原子性保证

**建议**: 已在高危漏洞#4中提出修复方案

### 18. 平台手续费计算
**文件**: `/src/lib/utils.ts:46`

```typescript
export function calculatePlatformFee(amount: number, rate: number = 0.03): number {
  return Math.round(amount * rate * 100) / 100
}
```

**潜在问题**:
- 浮点数精度问题
- 没有使用货币专用库

**修复方案**:
```typescript
// 使用整数存储金额(以分为单位)
export function calculatePlatformFee(amountInCents: number, rate: number = 0.03): number {
  return Math.round(amountInCents * rate)
}

// 或使用decimal.js库
import Decimal from 'decimal.js'

export function calculatePlatformFee(amount: number, rate: number = 0.03): number {
  return new Decimal(amount).times(rate).toDecimalPlaces(2).toNumber()
}
```

---

## 数据库安全

### 19. 缺少行级安全策略
**建议**:
- 使用PostgreSQL Row Level Security (RLS)
- 在Prisma查询中始终过滤 `userId`

### 20. 缺少数据库审计
**建议**:
```sql
-- 启用PostgreSQL审计
CREATE EXTENSION IF NOT EXISTS pgaudit;

-- 审计所有写操作
ALTER SYSTEM SET pgaudit.log = 'write';

-- 审计特定表
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
```

---

## 优先级修复建议

### 立即修复 (Critical - 24小时内)
1. ✅ JWT密钥硬编码问题 (#1)
2. ✅ 订单支付竞态条件 (#2)
3. ✅ 余额操作事务一致性 (#4)

### 高优先级 (1周内)
4. ✅ 管理员操作审计 (#3)
5. ✅ CSRF防护 (#5)
6. ✅ 输入验证 (#7)
7. ✅ 限流防护 (#8)

### 中优先级 (2周内)
8. ✅ Token黑名单机制 (#9)
9. ✅ 日志脱敏 (#6)
10. ✅ 密码策略增强 (#10)
11. ✅ 敏感数据脱敏 (#11)

### 低优先级 (1个月内)
12. ✅ 安全响应头 (#13-15)
13. ✅ 依赖定期审计 (#16)

---

## 合规性建议

### GDPR / 个人信息保护
- ✅ 实现数据删除功能("被遗忘权")
- ✅ 添加隐私政策和用户同意机制
- ✅ 数据导出功能
- ✅ 数据最小化原则

### PCI DSS (如果处理支付卡)
- ✅ 使用第三方支付网关,不存储卡号
- ✅ 记录所有支付相关操作
- ✅ 加密传输(HTTPS)

---

## 测试建议

### 安全测试清单
- [ ] 渗透测试 (OWASP Top 10)
- [ ] SQL注入测试 (虽然Prisma有保护)
- [ ] XSS测试
- [ ] CSRF测试
- [ ] 权限绕过测试
- [ ] 业务逻辑漏洞测试
- [ ] 竞态条件测试
- [ ] 限流测试

### 推荐工具
- OWASP ZAP - 自动化安全扫描
- Burp Suite - 手动渗透测试
- SonarQube - 静态代码分析
- npm audit / pnpm audit - 依赖漏洞扫描

---

## 附录:安全检查清单

```markdown
## 部署前安全检查清单

### 环境配置
- [ ] 所有敏感环境变量已设置(无默认值)
- [ ] JWT_SECRET长度>=32字符
- [ ] 数据库连接使用强密码
- [ ] Redis已启用认证
- [ ] HTTPS已启用(生产环境)

### 代码安全
- [ ] 所有API端点有认证检查
- [ ] 敏感操作有权限验证
- [ ] 输入验证已实施
- [ ] 输出脱敏已实施
- [ ] CSRF防护已启用
- [ ] 限流已配置

### 数据安全
- [ ] 密码使用bcrypt加密(轮数>=12)
- [ ] 敏感字段已加密(手机号、VIN)
- [ ] 数据库备份已配置
- [ ] 日志不包含敏感信息

### 监控和响应
- [ ] 错误监控已配置(Sentry/DataDog)
- [ ] 审计日志已启用
- [ ] 异常登录检测
- [ ] 事件响应流程已建立

### 合规性
- [ ] 隐私政策已发布
- [ ] 用户同意机制已实施
- [ ] 数据保留政策已定义
```

---

**审计人**: Claude (AI安全审计专家)
**审计完成时间**: 2025-10-17
**下次审计建议**: 3个月后或重大功能上线前

