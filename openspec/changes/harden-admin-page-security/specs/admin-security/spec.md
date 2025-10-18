# 管理员安全规范

## ADDED Requirements

### 服务端认证验证

**需求ID**: ADMIN-AUTH-001
**优先级**: P0 (严重)
**CVSS**: 9.1 (Critical)

所有管理员页面必须在服务端进行认证验证,不得仅依赖客户端检查。

#### Scenario: 未登录用户访问管理后台

**Given** 用户未登录 (无token)
**When** 访问 `/admin` 或任何 `/admin/*` 路径
**Then**
- Middleware拦截请求
- 返回302重定向到 `/login?redirect=/admin`
- 页面内容不被渲染

#### Scenario: 非管理员用户访问管理后台

**Given** 用户已登录但角色为 `USER` (非ADMIN)
**When** 访问 `/admin/*`
**Then**
- Middleware验证JWT token
- 检测到 `role !== 'ADMIN'`
- 返回302重定向到 `/login?error=unauthorized`

#### Scenario: Token过期访问管理后台

**Given** 用户的JWT token已过期
**When** 访问 `/admin/*`
**Then**
- Middleware验证token失败
- 返回302重定向到 `/login?error=invalid_token`
- 客户端localStorage被清除

#### Scenario: 尝试绕过客户端认证

**Given** 攻击者修改localStorage设置假管理员身份
**When** 执行 `localStorage.setItem('user', JSON.stringify({role: 'ADMIN'}))`
**And** 访问 `/admin/*`
**Then**
- Middleware不信任localStorage,仅验证服务端token
- 由于无有效token,请求被拦截
- 返回302重定向到登录页

**实现要求**:
- `src/middleware.ts` 实现认证中间件
- 验证来自Cookie或Authorization header的JWT token
- 验证用户角色为 `ADMIN`
- 配置matcher: `['/admin/:path*']`

---

### XSS防护

**需求ID**: ADMIN-XSS-001
**优先级**: P0 (严重)
**CVSS**: 7.3 (High)

所有用户输入数据在渲染到页面前必须经过XSS清理,防止注入攻击。

#### Scenario: Script标签注入

**Given** 用户在退款理由中输入 `<script>alert('XSS')</script>`
**When** 管理员查看退款申请列表
**Then**
- 数据经过 `sanitizeText()` 清理
- 显示为纯文本: `<script>alert('XSS')</script>`
- 脚本不执行

#### Scenario: 事件处理器注入

**Given** 用户在用户名中输入 `<img src=x onerror=alert('XSS')>`
**When** 管理员查看用户列表
**Then**
- 数据经过 `sanitizeText()` 清理
- `onerror` 属性被移除
- 显示为安全内容或空字符串

#### Scenario: JavaScript URL注入

**Given** 用户在申诉描述中输入 `<a href="javascript:alert('XSS')">点击</a>`
**When** 管理员查看申诉详情
**Then**
- 数据经过 `sanitizeText()` 或 `sanitizeHtml()` 清理
- `javascript:` URL被移除
- 链接变为无害内容

#### Scenario: 嵌套XSS攻击

**Given** 用户输入 `<<script>alert('XSS')<</script>>`
**When** 数据渲染到页面
**Then**
- DOMPurify完全清理嵌套标签
- 显示为安全文本

#### Scenario: 安全HTML保留

**Given** 使用 `sanitizeHtml()` 模式
**When** 输入包含 `<p>正常段落</p><strong>加粗</strong>`
**Then**
- 保留 `<p>` 和 `<strong>` 等安全标签
- 移除不安全的属性和标签
- 渲染格式化文本

**实现要求**:
- 安装 `isomorphic-dompurify`
- 创建 `src/lib/sanitize.ts` 工具函数
- `sanitizeText()` - 移除所有HTML
- `sanitizeHtml()` - 保留安全HTML标签
- `sanitizeObject()` - 递归清理对象
- 在所有管理员页面应用清理

**清理字段**:
```
退款页面: seller.name, seller.email, buyer.name, buyer.email, refundReason
申诉页面: initiator.name, initiator.email, reason, description, resolution
用户页面: name, email, phone
```

---

### 统一错误处理

**需求ID**: ADMIN-ERROR-001
**优先级**: P1 (高)

所有管理员页面必须使用统一的错误处理机制,替换原始 `alert()` 弹窗。

#### Scenario: 401 Unauthorized错误

**Given** 用户token已过期
**When** 发起API请求 (如获取退款列表)
**Then**
- `handleApiError()` 检测到401状态
- 显示Toast: "您的登录已过期,请重新登录"
- 1.5秒后自动跳转到 `/login?redirect=<current_path>`

#### Scenario: 403 Forbidden错误

**Given** 用户无权限执行操作
**When** 发起需要更高权限的API请求
**Then**
- `handleApiError()` 检测到403状态
- 显示Toast: "您没有权限执行此操作"
- 不跳转页面

#### Scenario: 500 Internal Server Error

**Given** 服务器遇到内部错误
**When** API请求返回500状态
**Then**
- `handleApiError()` 检测到500状态
- 显示Toast: "服务器遇到问题,请稍后重试"
- 不跳转页面

#### Scenario: 网络错误

**Given** 用户网络断开
**When** 发起fetch请求
**Then**
- 捕获 `TypeError: Failed to fetch`
- 显示Toast: "网络错误,请检查网络连接后重试"

#### Scenario: 成功操作提示

**Given** 管理员成功批准退款
**When** API返回 `{success: true, message: '已批准退款'}`
**Then**
- 显示 `toast.success()` 成功提示
- 自动刷新列表数据

**实现要求**:
- 使用 `sonner` Toast库
- 创建 `src/lib/error-handler.ts`
- 实现 `handleApiError()` 函数
- 替换所有 `alert()` 为 `toast.error()` 或 `toast.success()`
- 所有9个管理员页面集成

---

### 竞态条件保护

**需求ID**: ADMIN-RACE-001
**优先级**: P1 (高)

所有操作按钮必须在加载状态下禁用,防止用户快速重复点击导致重复操作。

#### Scenario: 快速双击操作按钮

**Given** 退款申请列表加载完成
**When** 用户快速双击"同意退款"按钮
**Then**
- 第一次点击触发操作,设置 `actionLoading = true`
- 按钮立即变为禁用状态 (`disabled={true}`)
- 第二次点击被忽略 (按钮已禁用)
- 仅发送一次API请求

#### Scenario: 按钮加载状态显示

**Given** 用户点击"同意退款"按钮
**When** API请求进行中
**Then**
- 按钮文本变为 "处理中..."
- 按钮变灰且禁用
- 显示加载指示器 (可选)

#### Scenario: 请求完成后恢复按钮

**Given** API请求完成 (成功或失败)
**When** 响应返回
**Then**
- 设置 `actionLoading = false`
- 按钮恢复可点击状态
- 按钮文本恢复为 "同意退款"

**实现要求**:
- 所有操作按钮添加 `disabled={actionLoading}`
- 条件渲染按钮文本: `{actionLoading ? '处理中...' : '确认'}`
- 在 `handleAction` 函数中正确管理 loading 状态
- 使用 try/finally 确保 loading 状态在错误时也被重置

---

### 输入验证

**需求ID**: ADMIN-VALID-001
**优先级**: P2 (中)

所有管理员表单输入必须经过Zod schema验证,确保数据格式和长度正确。

#### Scenario: 超长输入验证

**Given** 退款备注输入框
**When** 用户输入超过500字符的备注
**Then**
- Zod验证检测到长度超限
- 显示错误Toast: "备注不能超过500字符"
- 不发送API请求

#### Scenario: 必填字段验证

**Given** 处理申诉对话框
**When** 用户不填写"处理意见"直接点击确认
**Then**
- Zod验证检测到必填字段缺失
- 显示错误Toast: "请填写处理意见"
- 不发送API请求

#### Scenario: 格式验证

**Given** 用户余额更新表单
**When** 输入负数余额 `-100`
**Then**
- Zod验证检测到数值不符合规则 (>=0)
- 显示错误Toast: "余额不能为负数"
- 不发送API请求

**实现要求**:
- 创建 `src/lib/validations/admin.ts`
- 定义Zod schemas: `RefundActionSchema`, `DisputeActionSchema`, `UserUpdateSchema`
- 字段规则:
  - `note`: 可选, 最大500字符
  - `resolution`: 必填, 1-1000字符
  - `balance`: 可选, >=0
- 在表单提交前调用 `.safeParse()` 验证

---

### 内存泄漏防护

**需求ID**: ADMIN-MEM-001
**优先级**: P2 (中)

所有使用 `useEffect` 的组件必须提供清理函数,防止组件卸载后的内存泄漏和请求竞态。

#### Scenario: 组件快速切换

**Given** 用户在退款列表页
**When** 快速在"待处理"和"已处理"筛选间切换
**Then**
- 每次切换触发新的 `fetchRefunds()` 请求
- 前一个请求被 `AbortController.abort()` 取消
- 不显示 `AbortError` 错误Toast
- 无内存泄漏

#### Scenario: 页面卸载时取消请求

**Given** 数据正在加载 (请求未完成)
**When** 用户离开页面 (导航到其他路由)
**Then**
- useEffect清理函数被调用
- `AbortController.abort()` 取消未完成的请求
- 组件正常卸载,无内存泄漏

**实现要求**:
- 在所有 `useEffect` 中使用 `AbortController`
- 将 `signal` 传递给 `fetch()` 请求
- 返回清理函数: `return () => controller.abort()`
- 在catch块中检查 `error.name === 'AbortError'` 并忽略

---

### 无障碍性

**需求ID**: ADMIN-A11Y-001
**优先级**: P3 (低)

管理员页面应符合基本的Web无障碍性标准 (WCAG 2.1 AA)。

#### Scenario: 键盘导航

**Given** 用户仅使用键盘
**When** 按Tab键浏览页面
**Then**
- 所有交互元素 (按钮, 输入框, 链接) 可通过Tab访问
- 焦点顺序符合逻辑
- 焦点样式清晰可见

#### Scenario: Esc关闭对话框

**Given** 对话框已打开
**When** 用户按Esc键
**Then**
- 对话框关闭
- 焦点返回触发元素

#### Scenario: 屏幕阅读器支持

**Given** 用户使用屏幕阅读器
**When** 浏览页面
**Then**
- 所有表单字段有对应的 `<label>`
- 按钮有 `aria-label` 描述
- 对话框有 `role="dialog"` 和 `aria-modal="true"`
- 对话框标题通过 `aria-labelledby` 关联

**实现要求**:
- 所有表单字段添加 `<label>` 元素
- 操作按钮添加 `aria-label` (如果文本不明确)
- 对话框添加适当的ARIA属性
- 支持键盘事件 (Enter提交, Esc关闭)

---

## 审计日志集成

本变更依赖于 `integrate-audit-logging` 变更,所有管理员敏感操作已集成审计日志:
- 用户管理 (更新用户信息, 删除用户) → `AUDIT_ACTIONS.UPDATE_USER_*`, `DELETE_USER`
- 提现审核 → `APPROVE_WITHDRAWAL`, `REJECT_WITHDRAWAL`, `COMPLETE_WITHDRAWAL`, `FAIL_WITHDRAWAL`
- 申诉处理 → `RESOLVE_DISPUTE`, `CLOSE_DISPUTE`
- 退款审核 → `APPROVE_REFUND`, `REJECT_REFUND`

---

## 安全合规

本规范符合以下安全标准:
- **OWASP Top 10 2021**
  - A01: Broken Access Control ✅ (服务端认证验证)
  - A03: Injection ✅ (XSS防护)
- **CVSS v3.1** 评分标准
- **WCAG 2.1 AA** 无障碍性标准 (部分)

---

## 部署检查清单

- [ ] 所有依赖已安装 (`isomorphic-dompurify`, `sonner`, `zod`)
- [ ] Middleware认证通过测试 (未登录/非管理员/token过期)
- [ ] XSS注入测试通过 (各种payload)
- [ ] 错误处理测试通过 (401/403/500/网络错误)
- [ ] 竞态保护测试通过 (快速双击)
- [ ] 输入验证测试通过 (超长/必填/格式)
- [ ] 内存泄漏测试通过 (组件快速切换)
- [ ] 代码审查通过
- [ ] `pnpm lint` 无错误
- [ ] `pnpm build` 成功
