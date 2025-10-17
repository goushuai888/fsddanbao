# 关键漏洞快速修复指南

**⚠️ 警告**: 这些是生产环境必须立即修复的严重安全漏洞!

---

## 🔴 修复 #1: JWT密钥问题 (立即修复!)

### 第1步: 修改 src/lib/auth.ts

```typescript
// src/lib/auth.ts
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// ❌ 删除这行
// const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

// ✅ 替换为
const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET) {
  throw new Error('❌ CRITICAL: JWT_SECRET环境变量未设置! 应用无法启动.')
}

if (JWT_SECRET.length < 32) {
  throw new Error('❌ CRITICAL: JWT_SECRET必须至少32字符!')
}

export interface TokenPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

// 生成JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d',
    algorithm: 'HS256',
    issuer: 'fsd-escrow',
    audience: 'fsd-users'
  })
}

// 验证JWT token
export function verifyToken(token: string | undefined | null): TokenPayload | null {
  if (!token) return null

  try {
    return jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: 'fsd-escrow',
      audience: 'fsd-users'
    }) as TokenPayload
  } catch (error) {
    console.error('Token验证失败:', error instanceof Error ? error.message : '未知错误')
    return null
  }
}

// 加密密码 - 提升轮数到12
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)  // ✅ 从10改为12
}

// 验证密码
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
```

### 第2步: 生成强密钥

在终端执行:
```bash
# 生成32字节(256位)随机密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 第3步: 更新 .env.local

```bash
# 使用上面生成的密钥
JWT_SECRET=<你生成的64字符十六进制字符串>
```

### 第4步: 验证修复

```bash
# 重启应用,应该正常启动
pnpm dev

# 如果JWT_SECRET未设置,应该看到错误并拒绝启动
```

---

## 🔴 修复 #2: 订单支付竞态条件

### 修改 src/app/api/orders/[id]/route.ts

找到 `case 'pay':` 部分(大约第161行),替换为:

```typescript
case 'pay':
  // 买家支付 - 使用事务防止竞态条件
  if (order.status !== 'PUBLISHED') {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '订单状态不允许支付'
    }, { status: 400 })
  }

  try {
    updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. 重新查询订单(在事务内)
      const currentOrder = await tx.order.findUnique({
        where: { id: params.id }
      })

      if (!currentOrder) {
        throw new Error('订单不存在')
      }

      // 2. 再次检查状态(防止TOCTOU)
      if (currentOrder.status !== 'PUBLISHED') {
        throw new Error('订单状态已变更,支付失败')
      }

      // 3. 检查是否已有买家
      if (currentOrder.buyerId) {
        throw new Error('订单已被其他买家购买')
      }

      // 4. 原子更新 - 同时检查状态和buyerId
      return await tx.order.update({
        where: {
          id: params.id,
          status: 'PUBLISHED',
          buyerId: null
        },
        data: {
          buyerId: payload.userId,
          status: 'PAID',
          paidAt: new Date(),
          escrowAmount: currentOrder.price
        }
      })
    }, {
      isolationLevel: 'Serializable',  // 最高隔离级别
      timeout: 10000  // 10秒超时
    })
  } catch (error: any) {
    return NextResponse.json<ApiResponse>({
      success: false,
      error: error.message || '支付失败,请重试'
    }, { status: 400 })
  }
  break
```

---

## 🔴 修复 #3: 订单完成时的余额操作

### 修改 src/app/api/orders/[id]/route.ts

找到 `case 'confirm':` 部分(大约第208行),替换为:

```typescript
case 'confirm':
  // 买家确认收货 - 必须使用事务保证原子性
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

  try {
    // 使用事务确保所有操作原子执行
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新订单状态
      const updatedOrder = await tx.order.update({
        where: { id: params.id },
        data: {
          status: 'COMPLETED',
          completedAt: new Date()
        }
      })

      // 2. 计算卖家应得金额(扣除平台手续费)
      const sellerAmount = order.price - (order.platformFee || 0)

      // 3. 增加卖家余额
      await tx.user.update({
        where: { id: order.sellerId },
        data: {
          balance: { increment: sellerAmount }
        }
      })

      // 4. 创建支付记录
      await tx.payment.create({
        data: {
          orderId: order.id,
          userId: order.sellerId,
          amount: sellerAmount,
          type: 'RELEASE',
          status: 'COMPLETED',
          note: '订单完成,款项释放给卖家'
        }
      })

      return updatedOrder
    }, {
      isolationLevel: 'Serializable',
      timeout: 10000
    })

    updatedOrder = result
  } catch (error: any) {
    console.error('确认收货失败:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '操作失败,请重试或联系客服'
    }, { status: 500 })
  }
  break
```

---

## 🔴 修复 #4: 管理员操作审计日志

### 第1步: 添加审计日志表

在 `prisma/schema.prisma` 末尾添加:

```prisma
// 管理员操作审计日志
model AdminLog {
  id           String   @id @default(cuid())
  adminId      String
  admin        User     @relation("AdminLogs", fields: [adminId], references: [id])
  action       String   // 操作类型: UPDATE_USER, APPROVE_WITHDRAWAL等
  resourceType String   // 资源类型: User, Order, Withdrawal
  resourceId   String   // 资源ID
  details      String?  // JSON格式的详细信息
  ipAddress    String?
  createdAt    DateTime @default(now())

  @@index([adminId])
  @@index([resourceType, resourceId])
  @@index([createdAt])
}
```

同时在User模型中添加关联:
```prisma
model User {
  // ... 现有字段
  adminLogs     AdminLog[] @relation("AdminLogs")
}
```

### 第2步: 执行数据库迁移

```bash
# 生成并应用迁移
pnpm prisma migrate dev --name add-admin-audit-log

# 或者在开发环境快速同步
pnpm db:push
```

### 第3步: 创建审计工具 src/lib/audit.ts

```typescript
import { prisma } from './prisma'

interface AdminActionParams {
  adminId: string
  action: string
  resourceType: 'User' | 'Order' | 'Withdrawal' | 'Dispute' | 'Refund'
  resourceId: string
  details?: any
  ipAddress?: string
}

export async function logAdminAction(params: AdminActionParams) {
  try {
    await prisma.adminLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        details: params.details ? JSON.stringify(params.details) : null,
        ipAddress: params.ipAddress
      }
    })
  } catch (error) {
    console.error('记录审计日志失败:', error)
    // 不阻塞主流程
  }
}
```

### 第4步: 在关键API中添加审计

示例 - 修改 `src/app/api/admin/users/[id]/route.ts`:

```typescript
import { logAdminAction } from '@/lib/audit'

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    // ... 验证逻辑

    const body = await request.json()
    const { name, phone, role, verified, balance } = body

    // 构建更新数据
    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (phone !== undefined) updateData.phone = phone
    if (role !== undefined) updateData.role = role
    if (verified !== undefined) updateData.verified = verified
    if (balance !== undefined) updateData.balance = balance

    const user = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        verified: true,
        balance: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // ✅ 记录审计日志
    await logAdminAction({
      adminId: payload.userId,
      action: 'UPDATE_USER',
      resourceType: 'User',
      resourceId: params.id,
      details: {
        changes: updateData,
        before: {
          // 可选: 记录修改前的值
        }
      },
      ipAddress: request.headers.get('x-forwarded-for') ||
                 request.headers.get('x-real-ip') ||
                 'unknown'
    })

    return NextResponse.json<ApiResponse>({
      success: true,
      data: user,
      message: '用户信息更新成功'
    })
  } catch (error) {
    // ...
  }
}
```

类似地,在以下API中添加审计:
- `/api/admin/withdrawals/[id]/route.ts` - 提现审核
- `/api/admin/disputes/[id]/route.ts` - 申诉处理
- `/api/admin/refunds/[id]/route.ts` - 退款处理

---

## 🟠 修复 #5: 输入验证

### 第1步: 创建验证器 src/lib/validators.ts

```typescript
import { z } from 'zod'

// 用户注册验证
export const registerSchema = z.object({
  email: z.string().email('邮箱格式不正确').min(1, '邮箱不能为空'),
  password: z.string()
    .min(8, '密码至少8位')
    .regex(/[A-Z]/, '密码必须包含大写字母')
    .regex(/[a-z]/, '密码必须包含小写字母')
    .regex(/[0-9]/, '密码必须包含数字'),
  name: z.string().max(50, '姓名过长').optional(),
  phone: z.string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),
  role: z.enum(['BUYER', 'SELLER'], {
    errorMap: () => ({ message: '角色参数无效' })
  }).default('BUYER')
})

// 登录验证
export const loginSchema = z.object({
  email: z.string().email('邮箱格式不正确'),
  password: z.string().min(1, '密码不能为空')
})

// 创建订单验证
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
})

// 提现验证
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

### 第2步: 在API中使用

修改 `src/app/api/auth/register/route.ts`:

```typescript
import { registerSchema } from '@/lib/validators'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // ✅ 验证输入
    const validation = registerSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: validation.error.errors[0].message
      }, { status: 400 })
    }

    const { email, password, name, phone, role } = validation.data

    // ... 其余逻辑不变
  } catch (error) {
    // ...
  }
}
```

类似地修改:
- `src/app/api/auth/login/route.ts` - 使用 `loginSchema`
- `src/app/api/orders/route.ts` - 使用 `createOrderSchema`
- `src/app/api/withdrawals/route.ts` - 使用 `withdrawalSchema`

---

## 验证修复

### 测试清单

```bash
# 1. 测试JWT密钥验证
# 删除或注释 .env.local 中的 JWT_SECRET
pnpm dev
# 应该看到错误: "JWT_SECRET环境变量未设置"

# 2. 恢复JWT_SECRET后正常启动
# 设置正确的JWT_SECRET
pnpm dev
# 应该正常启动

# 3. 测试支付竞态条件
# 使用工具(如Apache Bench)并发发送相同订单的支付请求
# 应该只有一个成功,其他返回"订单状态已变更"

# 4. 测试输入验证
# 发送无效数据到注册接口
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"invalid","password":"123"}'
# 应该返回验证错误信息
```

---

## 部署步骤

### 1. 备份数据库
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. 更新代码
```bash
git add .
git commit -m "fix: 修复关键安全漏洞 - JWT/竞态条件/事务/审计"
git push origin main
```

### 3. 更新环境变量(生产环境)
```bash
# 在生产服务器或平台(Vercel/Railway等)设置:
JWT_SECRET=<生成的强密钥>

# 验证其他环境变量也已正确设置
DATABASE_URL=<生产数据库URL>
```

### 4. 数据库迁移(生产环境)
```bash
# 如果使用 Prisma Migrate
pnpm prisma migrate deploy

# 如果使用 db:push (不推荐生产环境)
pnpm db:push
```

### 5. 重启应用
```bash
# 根据部署平台重启
# Vercel: 自动部署
# PM2: pm2 restart all
# Docker: docker-compose restart
```

### 6. 验证修复
- 检查应用日志,确保没有JWT_SECRET相关错误
- 测试用户注册/登录功能
- 测试订单创建和支付功能
- 检查管理员操作是否有审计日志

---

## 紧急回滚计划

如果出现问题,按以下步骤回滚:

```bash
# 1. 回滚代码
git revert HEAD
git push origin main

# 2. 回滚数据库(如果执行了迁移)
pnpm prisma migrate resolve --rolled-back <migration_name>

# 3. 重启应用
```

---

## 下一步行动

修复完上述关键问题后,按优先级继续修复:

1. **本周内**:
   - CSRF防护
   - 限流机制
   - Token黑名单

2. **下周内**:
   - 日志脱敏
   - 敏感数据加密
   - 安全响应头

3. **本月内**:
   - 完整的安全测试
   - 第三方安全审计
   - 渗透测试

---

**重要**: 修复后请通知所有用户修改密码(因为bcrypt轮数改变),并建议启用二次验证(如果已实现)。
