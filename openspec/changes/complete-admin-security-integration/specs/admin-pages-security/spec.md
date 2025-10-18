# 管理员页面安全规范

## ADDED Requirements

### 用户管理页面安全

**需求ID**: ADMIN-USERS-SEC-001
**优先级**: P0 (严重)
**依赖**: `harden-admin-page-security` (已完成)

所有用户管理页面必须应用统一的安全模式，防止XSS攻击、提供友好的错误处理、防止内存泄漏和竞态条件。

#### Scenario: 用户列表XSS防护

**Given** 用户在注册时输入恶意代码 `<script>alert('XSS')</script>` 作为姓名
**When** 管理员访问用户列表页面(`/admin/users`)
**Then**
- 用户姓名经过 `sanitizeText()` 清理
- 显示为纯文本: `<script>alert('XSS')</script>`
- 脚本不执行，无XSS漏洞

#### Scenario: 用户编辑输入验证

**Given** 管理员正在编辑用户信息
**When** 输入超过50字符的姓名并点击保存
**Then**
- `UserUpdateSchema.safeParse()` 检测到长度超限
- 显示Toast错误: "姓名不能超过50字符"
- 不发送API请求

#### Scenario: 用户编辑并发操作保护

**Given** 管理员在用户编辑页面
**When** 快速双击"保存"按钮
**Then**
- 第一次点击设置 `actionLoading = true`
- 按钮立即变灰且禁用 (`disabled={true}`)
- 第二次点击被忽略
- 仅发送一次API请求

#### Scenario: 用户列表内存泄漏防护

**Given** 管理员在用户列表页面
**When** 快速切换角色筛选条件（全部 → 管理员 → 卖家）
**Then**
- 每次切换触发新的 `fetchUsers()` 请求
- 前一个请求被 `AbortController.abort()` 取消
- 控制台无AbortError警告（已被catch块忽略）
- 无内存泄漏

#### Scenario: 用户编辑表单无障碍性

**Given** 用户使用屏幕阅读器访问用户编辑页面
**When** 浏览表单字段
**Then**
- 所有输入字段有对应的 `<label htmlFor="...">`
- 输入框有 `aria-describedby` 指向帮助文本
- 字符计数显示在 `aria-describedby` 关联的元素中
- 屏幕阅读器正确朗读字段名称和限制

**实现要求**:
- 使用 `sanitizeText()` 清理: `user.name`, `user.email`, `user.phone`
- 使用 `UserUpdateSchema` 验证表单输入
- 使用 `handleApiError()` 统一错误处理
- 使用 `useCallback` 包装 `fetchUsers` 和 `fetchUserDetail`
- 使用 `AbortController` 取消未完成的请求
- 操作按钮添加 `disabled={actionLoading}`
- 表单字段添加 `<label>`, `aria-describedby`, `maxLength`

---

### 提现审核页面安全

**需求ID**: ADMIN-WITHDRAW-SEC-001
**优先级**: P0 (严重)
**依赖**: `harden-admin-page-security` (已完成)

提现审核页面必须应用统一的安全模式，特别是审核操作的输入验证和敏感信息的XSS防护。

#### Scenario: 提现审核输入验证

**Given** 管理员正在审核提现申请
**When** 选择"拒绝"操作但不填写拒绝理由
**Then**
- `WithdrawalActionSchema.safeParse()` 检测到必填字段缺失
- 显示Toast错误: "请填写拒绝原因"
- 不发送API请求

#### Scenario: 提现审核XSS防护

**Given** 用户在提现申请中输入银行账号 `<img src=x onerror=alert('XSS')>`
**When** 管理员查看提现申请列表
**Then**
- 银行账号经过 `sanitizeText()` 清理
- 显示为纯文本，不渲染HTML
- 脚本不执行

#### Scenario: 提现审核对话框无障碍性

**Given** 管理员点击"批准提现"按钮
**When** 对话框打开
**Then**
- 对话框有 `role="dialog"` 和 `aria-modal="true"`
- 对话框标题通过 `aria-labelledby` 关联
- 表单字段有 `<label htmlFor="...">`
- 审核备注字段显示字符计数 (0/500)
- 按Esc键可以关闭对话框

#### Scenario: 提现审核并发操作保护

**Given** 管理员在提现审核对话框中
**When** 快速双击"确认批准"按钮
**Then**
- 第一次点击设置 `actionLoading = true`
- 按钮立即变灰且禁用
- 第二次点击被忽略
- 仅发送一次API请求，防止重复批准

**实现要求**:
- 使用 `sanitizeText()` 清理: `user.name`, `user.email`, `bankAccount`, `alipayAccount`
- 使用 `WithdrawalActionSchema` 验证审核表单
- 使用 `handleApiError()` 统一错误处理
- 使用 `useCallback` 包装 `fetchWithdrawals`
- 使用 `AbortController` 取消未完成的请求
- 对话框添加 `role="dialog"`, `aria-modal="true"`, `onKeyDown` (Esc关闭)
- 审核按钮添加 `disabled={actionLoading}`
- 字符计数显示 (reviewNote≤500, rejectReason≤200)

---

### 订单管理页面安全

**需求ID**: ADMIN-ORDERS-SEC-001
**优先级**: P1 (高)
**依赖**: `harden-admin-page-security` (已完成)

订单管理页面必须清理所有用户输入数据，防止XSS攻击。

#### Scenario: 订单列表XSS防护

**Given** 卖家在创建订单时输入车型 `<script>document.cookie</script>`
**When** 管理员查看订单列表
**Then**
- 车型数据经过 `sanitizeText()` 清理
- 显示为纯文本
- 脚本不执行，Cookie安全

#### Scenario: 订单列表内存泄漏防护

**Given** 管理员在订单列表页面
**When** 快速切换状态筛选条件
**Then**
- 每次切换取消前一个未完成的请求
- 使用 `AbortController` 管理请求生命周期
- 组件卸载时自动取消所有请求

**实现要求**:
- 使用 `sanitizeText()` 清理: `orderNo`, `vehicleBrand`, `vehicleModel`, `seller.name`, `buyer.name`
- 使用 `handleApiError()` 统一错误处理
- 使用 `useCallback` 包装 `fetchOrders`
- 使用 `AbortController` 取消未完成的请求

---

### 支付记录页面安全

**需求ID**: ADMIN-PAYMENTS-SEC-001
**优先级**: P1 (高)
**依赖**: `harden-admin-page-security` (已完成)

支付记录页面必须清理用户名和订单号，防止XSS攻击。

#### Scenario: 支付记录XSS防护

**Given** 支付记录中包含用户名 `<img src=x onerror=alert(1)>`
**When** 管理员查看支付记录列表
**Then**
- 用户名经过 `sanitizeText()` 清理
- 显示为纯文本
- 脚本不执行

**实现要求**:
- 使用 `sanitizeText()` 清理: `user.name`, `orderNo`
- 使用 `handleApiError()` 统一错误处理
- 使用 `useCallback` 包装 `fetchPayments`
- 使用 `AbortController` 取消未完成的请求

---

### 收益统计页面安全

**需求ID**: ADMIN-REVENUE-SEC-001
**优先级**: P2 (中)
**依赖**: `harden-admin-page-security` (已完成)

收益统计页面主要展示数值数据，XSS风险较低，但仍需统一错误处理和内存泄漏防护。

#### Scenario: 收益统计错误处理

**Given** 用户token已过期
**When** 访问收益统计页面
**Then**
- `handleApiError()` 检测到401状态
- 显示Toast: "登录已过期，请重新登录"
- 1.5秒后自动跳转到登录页

**实现要求**:
- 使用 `handleApiError()` 统一错误处理
- 使用 `useCallback` 包装 `fetchStats`
- 使用 `AbortController` 取消未完成的请求

---

## 安全合规

所有管理员页面必须符合以下安全标准：

- **OWASP Top 10 2021**
  - A01: Broken Access Control ✅ (Middleware已保护)
  - A03: Injection ✅ (XSS防护)
- **CVSS v3.1** 评分标准
- **WCAG 2.1 AA** 无障碍性标准 (用户编辑、提现审核)

---

## 代码质量要求

所有修改的页面必须：

- [ ] 通过 `pnpm lint` 检查（Error级别必须修复）
- [ ] 通过 TypeScript编译
- [ ] 符合 React Hooks `exhaustive-deps` 规则
- [ ] 使用 `useCallback` 包装fetch函数
- [ ] 所有 `useEffect` 返回清理函数

---

## 部署检查清单

- [ ] 所有6个页面已应用安全模式
- [ ] XSS注入测试通过（手动测试）
- [ ] 错误处理测试通过（401/403/500/网络错误）
- [ ] 竞态保护测试通过（快速双击）
- [ ] 输入验证测试通过（用户编辑、提现审核）
- [ ] 内存泄漏测试通过（快速切换筛选）
- [ ] `pnpm lint` 无Error
- [ ] `pnpm build` 成功
- [ ] CLAUDE.md已更新
