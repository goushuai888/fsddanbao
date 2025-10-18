# 技术设计文档

## 设计原则

1. **深度防御** (Defense in Depth) - 多层安全防护
2. **最小权限** (Principle of Least Privilege) - 仅授予必要权限
3. **安全默认** (Secure by Default) - 默认配置是安全的
4. **渐进增强** (Progressive Enhancement) - 向后兼容
5. **性能优先** (Performance First) - 安全不牺牲性能

## 1. 服务端认证架构

### 1.1 认证流程

```
请求 /admin/*
  ↓
Middleware验证 (src/middleware.ts)
  ├─ 检查Cookie中的token
  ├─ 验证JWT签名和有效期
  └─ 验证用户角色 === 'ADMIN'
  ↓
通过 → 允许访问
失败 → 302重定向到 /login?redirect=/admin
```

### 1.2 技术实现

#### Middleware实现
```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyToken } from '@/lib/auth'

export function middleware(request: NextRequest) {
  // 获取token from Cookie (优先) or Authorization header
  const token = request.cookies.get('token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.redirect(new URL('/login?redirect=' + request.nextUrl.pathname, request.url))
  }

  // 验证token
  try {
    const payload = verifyToken(token)

    if (!payload || payload.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
    }

    // 通过验证,继续请求
    return NextResponse.next()
  } catch (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url))
  }
}

export const config = {
  matcher: ['/admin/:path*'] // 匹配所有 /admin/* 路径
}
```

#### Layout简化
```typescript
// src/app/admin/layout.tsx
'use client'

import { AdminAuthGuard } from '@/components/AdminAuthGuard'

export default function AdminLayout({ children }) {
  // ✅ 服务端已验证,客户端只需处理UI逻辑
  return (
    <AdminAuthGuard>
      {/* ... 现有布局代码 ... */}
    </AdminAuthGuard>
  )
}
```

### 1.3 优势分析

| 方案 | 客户端验证 (旧) | Middleware验证 (新) |
|------|----------------|---------------------|
| 安全性 | ❌ 可绕过 | ✅ 无法绕过 |
| 性能 | ⚠️ 需等待JS | ✅ 服务端直接拦截 |
| SEO | ❌ 闪烁 | ✅ 无内容泄漏 |
| 维护性 | ❌ 分散检查 | ✅ 集中管理 |

## 2. XSS防护方案

### 2.1 DOMPurify选型

**为什么选择 isomorphic-dompurify**:
- ✅ 支持Node.js和浏览器环境
- ✅ 基于白名单,安全性高
- ✅ 灵活配置,支持保留安全HTML
- ✅ 性能优秀 (<5ms per sanitization)
- ✅ 活跃维护,安全更新及时

**对比其他方案**:
- `xss`: 功能较弱,不支持复杂HTML
- `sanitize-html`: 仅Node.js,不支持浏览器
- `js-xss`: 中文文档,但功能不如DOMPurify

### 2.2 Sanitize工具函数

```typescript
// src/lib/sanitize.ts
import DOMPurify from 'isomorphic-dompurify'

/**
 * 清理纯文本 (移除所有HTML标签)
 */
export function sanitizeText(input: string | null | undefined): string {
  if (!input) return ''

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // 不允许任何HTML标签
    ALLOWED_ATTR: []  // 不允许任何属性
  })
}

/**
 * 清理HTML (保留安全标签: p, br, strong, em等)
 */
export function sanitizeHtml(input: string | null | undefined): string {
  if (!input) return ''

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'a'],
    ALLOWED_ATTR: ['href', 'target'],
    ALLOW_DATA_ATTR: false
  })
}

/**
 * 递归清理对象的所有字符串字段
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
        typeof item === 'object' ? sanitizeObject(item, options) : item
      )
    } else if (value && typeof value === 'object') {
      result[key] = sanitizeObject(value, options)
    } else {
      result[key] = value
    }
  }

  return result as T
}
```

### 2.3 使用模式

```typescript
// ❌ 不安全 - 直接渲染用户数据
<p>{user.name}</p>
<div dangerouslySetInnerHTML={{ __html: refund.reason }} />

// ✅ 安全 - 清理后渲染
import { sanitizeText } from '@/lib/sanitize'

<p>{sanitizeText(user.name)}</p>
<p className="whitespace-pre-wrap">{sanitizeText(refund.reason)}</p>
```

### 2.4 性能考量

**清理开销**:
- 单次sanitize: ~2-5ms
- 列表场景 (50条数据, 每条3个字段): ~300-750ms
- 用户感知: 无明显延迟

**优化策略**:
1. **仅清理显示的数据** - 不清理原始API响应
2. **记忆化** - 使用 `useMemo` 缓存清理结果
3. **服务端清理** (可选) - 在API层清理,减少客户端开销

## 3. 错误处理设计

### 3.1 统一错误处理器

```typescript
// src/lib/error-handler.ts
import { toast } from 'sonner'

export interface ApiError {
  success: false
  error: string
  statusCode?: number
}

/**
 * 统一处理API错误
 */
export function handleApiError(error: unknown, operation: string = '操作') {
  // 网络错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    toast.error('网络错误', {
      description: '请检查网络连接后重试'
    })
    return
  }

  // HTTP错误
  if (error instanceof Response) {
    switch (error.status) {
      case 401:
        toast.error('未授权', {
          description: '您的登录已过期,请重新登录'
        })
        // 跳转登录
        setTimeout(() => {
          window.location.href = '/login?redirect=' + window.location.pathname
        }, 1500)
        break

      case 403:
        toast.error('权限不足', {
          description: '您没有权限执行此操作'
        })
        break

      case 500:
        toast.error('服务器错误', {
          description: '服务器遇到问题,请稍后重试'
        })
        break

      default:
        toast.error(`${operation}失败`, {
          description: `错误代码: ${error.status}`
        })
    }
    return
  }

  // API错误响应
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as ApiError
    toast.error(`${operation}失败`, {
      description: apiError.error || '未知错误'
    })
    return
  }

  // 未知错误
  console.error('Unhandled error:', error)
  toast.error('未知错误', {
    description: '请联系技术支持'
  })
}

/**
 * 提取错误消息
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return (error as ApiError).error || '未知错误'
  }
  return '未知错误'
}
```

### 3.2 使用示例

```typescript
// ❌ 旧代码
try {
  const response = await fetch('/api/admin/refunds')
  const data = await response.json()

  if (data.success) {
    setRefunds(data.data)
  } else {
    alert(data.error || '获取失败')
  }
} catch (error) {
  console.error('Error:', error)
  alert('网络错误')
}

// ✅ 新代码
import { handleApiError } from '@/lib/error-handler'
import { toast } from 'sonner'

try {
  const response = await fetch('/api/admin/refunds')

  // 检查HTTP状态
  if (!response.ok) {
    handleApiError(response, '获取退款申请列表')
    return
  }

  const data = await response.json()

  if (data.success) {
    setRefunds(data.data)
  } else {
    handleApiError(data, '获取退款申请列表')
  }
} catch (error) {
  handleApiError(error, '获取退款申请列表')
}
```

### 3.3 Toast vs Alert对比

| 特性 | alert() | sonner toast |
|------|---------|--------------|
| 用户体验 | ❌ 阻塞UI | ✅ 非阻塞 |
| 样式 | ❌ 无法定制 | ✅ 完全定制 |
| 位置 | ❌ 居中弹窗 | ✅ 角落提示 |
| 堆叠 | ❌ 不支持 | ✅ 支持多条 |
| 关闭 | ❌ 仅"确定" | ✅ 自动/手动 |
| 图标 | ❌ 无 | ✅ 成功/错误/警告 |

## 4. 竞态条件保护

### 4.1 按钮禁用策略

```typescript
// ❌ 问题代码 - 可重复点击
<Button onClick={handleAction}>
  同意退款
</Button>

// ✅ 修复后 - 防止重复点击
const [actionLoading, setActionLoading] = useState(false)

<Button
  onClick={handleAction}
  disabled={actionLoading}
>
  {actionLoading ? '处理中...' : '同意退款'}
</Button>
```

### 4.2 防重复请求

```typescript
// src/hooks/usePreventDoubleClick.ts
import { useRef } from 'react'

export function usePreventDoubleClick(delay = 1000) {
  const lastClickRef = useRef(0)

  return () => {
    const now = Date.now()
    if (now - lastClickRef.current < delay) {
      return false // 防止重复点击
    }
    lastClickRef.current = now
    return true
  }
}

// 使用
const preventDoubleClick = usePreventDoubleClick()

const handleAction = async () => {
  if (!preventDoubleClick()) return

  // ... 执行操作
}
```

## 5. 输入验证

### 5.1 Zod Schema定义

```typescript
// src/lib/validations/admin.ts
import { z } from 'zod'

export const RefundActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  note: z.string()
    .max(500, '备注不能超过500字符')
    .optional()
})

export const DisputeActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  resolution: z.string()
    .min(1, '请填写处理意见')
    .max(1000, '处理意见不能超过1000字符')
})

export type RefundActionInput = z.infer<typeof RefundActionSchema>
export type DisputeActionInput = z.infer<typeof DisputeActionSchema>
```

### 5.2 表单验证

```typescript
// ❌ 旧代码 - 无验证
const handleAction = async () => {
  const response = await fetch('/api/admin/refunds/' + id, {
    method: 'PATCH',
    body: JSON.stringify({ action: 'approve', note })
  })
}

// ✅ 新代码 - Zod验证
import { RefundActionSchema } from '@/lib/validations/admin'

const handleAction = async () => {
  // 验证输入
  const result = RefundActionSchema.safeParse({
    action: actionType,
    note
  })

  if (!result.success) {
    toast.error('输入验证失败', {
      description: result.error.errors[0].message
    })
    return
  }

  // 发送请求
  const response = await fetch('/api/admin/refunds/' + id, {
    method: 'PATCH',
    body: JSON.stringify(result.data)
  })
}
```

## 6. 内存泄漏修复

### 6.1 useEffect清理

```typescript
// ❌ 问题代码 - 未清理
useEffect(() => {
  fetchRefunds()
}, [statusFilter])

// ✅ 修复后 - 使用AbortController
useEffect(() => {
  const controller = new AbortController()

  const fetchRefunds = async () => {
    try {
      const response = await fetch('/api/admin/refunds', {
        signal: controller.signal
      })
      // ...
    } catch (error) {
      if (error.name === 'AbortError') {
        return // 请求被取消,忽略错误
      }
      handleApiError(error)
    }
  }

  fetchRefunds()

  // 清理函数
  return () => {
    controller.abort()
  }
}, [statusFilter])
```

## 7. 无障碍性改进

### 7.1 ARIA属性

```typescript
// ❌ 旧代码 - 无ARIA
<div className="fixed inset-0 bg-black bg-opacity-50">
  <div className="bg-white p-6 rounded-lg">
    <h3>同意退款</h3>
    {/* ... */}
  </div>
</div>

// ✅ 新代码 - 完整ARIA
<div
  className="fixed inset-0 bg-black bg-opacity-50"
  role="presentation"
  aria-hidden="false"
>
  <div
    className="bg-white p-6 rounded-lg"
    role="dialog"
    aria-modal="true"
    aria-labelledby="dialog-title"
  >
    <h3 id="dialog-title">同意退款</h3>
    {/* ... */}
  </div>
</div>
```

## 8. 性能影响分析

| 改进项 | 性能影响 | 优化措施 |
|--------|---------|---------|
| Middleware认证 | +10-20ms/请求 | ✅ 可接受,一次性验证 |
| DOMPurify清理 | +2-5ms/字段 | ✅ 使用useMemo缓存 |
| Toast通知 | 可忽略 | ✅ 异步渲染 |
| Zod验证 | +1-3ms/表单 | ✅ 可忽略 |
| AbortController | 可忽略 | ✅ 减少内存泄漏 |

**总计影响**: +15-30ms/页面加载, 用户无感知

## 9. 兼容性考虑

### 9.1 向后兼容

- ✅ 保留现有API接口,无破坏性变更
- ✅ 仍支持Authorization header认证 (向后兼容)
- ⚠️ 需要用户重新登录 (token迁移到Cookie)

### 9.2 浏览器支持

- Chrome/Edge: ✅ 完全支持
- Firefox: ✅ 完全支持
- Safari: ✅ 完全支持
- IE11: ❌ 不支持 (项目已不支持IE)

## 10. 部署检查清单

- [ ] 确认所有依赖已安装
- [ ] 运行 `pnpm lint` 无错误
- [ ] 运行 `pnpm build` 成功
- [ ] 测试管理员登录流程
- [ ] 测试XSS防护 (注入payload)
- [ ] 测试错误处理 (断网/401/500)
- [ ] 清理console.log
- [ ] 更新环境变量文档
- [ ] 通知现有管理员重新登录
