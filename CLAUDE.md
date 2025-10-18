<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

FSD担保交易平台 - 专门用于Tesla FSD自动驾驶权限转移的担保交易平台。使用 Next.js 14 + PostgreSQL + Prisma 构建的全栈应用。

## 开发环境配置

### 依赖安装
```bash
pnpm install  # 项目使用 pnpm 作为包管理器
```

### 数据库初始化
```bash
# 生成 Prisma Client
pnpm db:generate

# 推送数据库 schema（开发环境）
pnpm db:push

# 创建 migration（生产环境）
pnpm db:migrate
```

### 启动开发服务器
```bash
pnpm dev  # 在 http://localhost:3000 启动
```

### 其他常用命令
```bash
pnpm build        # 构建生产版本
pnpm start        # 启动生产服务器
pnpm lint         # 运行 ESLint
pnpm db:studio    # 打开 Prisma Studio 数据库管理界面
```

### 测试与验证
```bash
# 事务完整性测试（验证支付、确认、取消、退款的原子性）
DATABASE_URL="postgresql://..." npx tsx scripts/verify-transactions.ts

# 乐观锁测试（验证并发购买保护机制）
DATABASE_URL="postgresql://..." npx tsx scripts/verify-optimistic-lock.ts
```

## 项目架构

### 技术栈
- **前端**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: JWT (jsonwebtoken) + bcryptjs 密码加密
- **UI组件**: Radix UI + Tailwind CSS + class-variance-authority

### 目录结构
```
src/
├── app/                    # Next.js App Router 页面和路由
│   ├── api/               # API 路由处理
│   │   ├── auth/         # 认证接口（注册/登录）
│   │   └── orders/       # 订单接口（CRUD + 状态流转）
│   ├── login/            # 登录页面
│   ├── register/         # 注册页面
│   ├── orders/           # 订单相关页面
│   ├── layout.tsx        # 根布局
│   └── page.tsx          # 首页
├── components/
│   └── ui/               # 基于 Radix UI 的可复用组件
├── lib/
│   ├── prisma.ts         # Prisma Client 单例
│   ├── auth.ts           # 认证工具函数（JWT、密码哈希）
│   └── utils.ts          # 通用工具函数（cn 等）
└── types/
    └── index.ts          # TypeScript 类型定义

prisma/
└── schema.prisma         # 数据库 schema 定义
```

## 核心数据模型

### 主要关系
- **User**: 用户表，通过 `role` 区分买家/卖家/管理员
- **Order**: 订单表，关联卖家（必需）和买家（可选）
- **Payment**: 支付记录表，记录托管/释放/退款等操作
- **Dispute**: 申诉表，处理交易纠纷
- **Review**: 评价表，支持买卖双方互评

### 订单状态流转（2025-10-18 业务逻辑修复）

**状态流转图**:
```
PUBLISHED (已发布)
    ↓ 买家支付 (pay)
PAID (已支付 - 款项进入平台托管)
    ↓ 卖家提交转移凭证 (transfer)
TRANSFERRING (转移中)
    ↓ 买家确认收货 (confirm)
COMPLETED (已完成 - 平台释放款项给卖家)

特殊流转:
- PUBLISHED → CANCELLED (卖家取消未付款订单)
- PAID → CANCELLED (买家申请退款 + 卖家同意)
- TRANSFERRING → DISPUTE (买家申诉未收到货)
- PAID → DISPUTE (退款被拒后买家申请平台介入)
```

**各状态允许的操作** ✅:

| 状态 | 卖家可以 | 买家可以 | 说明 |
|------|---------|---------|------|
| **PUBLISHED** | 取消订单(cancel) | 购买(pay) | ✅ 卖家可删除未售出订单<br>❌ 卖家不能购买自己的订单 |
| **PAID** | 提交转移凭证(transfer)<br>同意退款(approve_refund)<br>拒绝退款(reject_refund) | 申请退款(request_refund) | ❌ **卖家不能直接取消**（已修复CRITICAL漏洞）<br>⚠️ **有退款申请时不能提交转移凭证**（已修复）<br>✅ 退款流程: 买家申请 → 卖家同意/拒绝 |
| **TRANSFERRING** | - | 确认收货(confirm)<br>申诉未收到货(create_dispute) | ❌ 任何人不能取消 |
| **DISPUTE** | - | - | 仅管理员可处理 |
| **COMPLETED** | - | - | 交易结束 |
| **CANCELLED** | - | - | 订单已取消 |

## 认证系统

### JWT 认证流程
1. 用户注册/登录后，后端生成包含 `userId`, `email`, `role` 的 JWT token
2. Token 有效期为 7 天
3. 前端将 token 存储在 localStorage 中
4. 受保护的 API 路由通过 `Authorization: Bearer <token>` 验证身份

### 认证工具函数（`src/lib/auth.ts`）
- `generateToken()`: 生成 JWT
- `verifyToken()`: 验证 JWT
- `hashPassword()`: bcrypt 加密密码
- `comparePassword()`: 验证密码

### API 路由认证示例
在需要认证的 API 路由中：
```typescript
const token = request.headers.get('authorization')?.replace('Bearer ', '')
const payload = verifyToken(token)
if (!payload) {
  return NextResponse.json({ error: '未授权' }, { status: 401 })
}
```

## API 接口规范

### 响应格式
成功响应：
```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

错误响应：
```json
{
  "success": false,
  "error": "错误描述"
}
```

### 订单操作接口（`PATCH /api/orders/[id]`）
通过 `action` 参数区分操作类型：
- `pay`: 买家支付（状态: PUBLISHED → PAID）
- `transfer`: 卖家提交转移凭证（PAID → TRANSFERRING）
- `confirm`: 买家确认收货（TRANSFERRING → COMPLETED）
- `cancel`: 取消订单（任何状态 → CANCELLED）
- `request_refund`: 买家申请退款（PAID状态，自动设置响应截止时间）
- `approve_refund`: 卖家同意退款（PAID → CANCELLED，退款给买家）
- `reject_refund`: 卖家拒绝退款（**必须提供拒绝理由**）
- `request_refund_extension`: 卖家申请延期（**需提供延期理由**，延长24小时）
- `create_dispute`: 买家发起申诉（TRANSFERRING状态未收到货，或PAID状态退款被拒后申请平台介入）

**所有操作均使用乐观锁保护**，防止并发冲突（2025-10-18）

## 环境变量

必需配置（`.env.local`）：
```
DATABASE_URL="postgresql://..."  # PostgreSQL 连接字符串
JWT_SECRET="..."                 # JWT 签名密钥（必须使用256位强随机密钥）
PLATFORM_FEE_RATE=0.03          # 平台手续费率（3%）
```

**重要安全提示**：
- JWT_SECRET 必须使用强随机密钥（可用 `openssl rand -hex 32` 生成）
- 生产环境禁止使用默认密钥或硬编码密钥

可选配置：
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`: NextAuth.js（如果使用）
- `ALIPAY_*`, `WECHAT_*`: 支付接口配置（待实现）
- `UPLOAD_DIR`, `MAX_FILE_SIZE`: 文件上传配置（待实现）

## 最近更新（2025-10-18）

### 🚨 订单业务逻辑修复（CRITICAL）✅
**完成时间**：2025-10-18（最新）
**严重程度**：🚨 CRITICAL (CVSS 9.1 - 业务逻辑绕过)
**用户报告**：_"买家付款后，卖家仍能点击取消订单，取消成功了"_

**问题描述**：
发现严重业务逻辑漏洞，破坏担保交易的核心原则：
- ❌ **PAID状态卖家可以直接取消订单**（最严重）
- ⚠️ **PAID+退款申请时卖家仍可提交转移凭证**
- ℹ️ **卖家可以购买自己的订单**

**修复内容**：

1. ✅ **禁止PAID状态的cancel操作**（API路由）
   ```typescript
   // 修复前：卖家可以取消已付款订单
   if (order.status === 'PAID' && order.sellerId !== payload.userId) {
     return error('已付款订单只有卖家可以取消') // ❌ 卖家可以取消！
   }

   // 修复后：完全禁止PAID状态cancel
   if (order.status === 'PAID') {
     return error('已付款订单不能直接取消。买家可以申请退款，卖家可以同意或拒绝。')
   }
   ```

2. ✅ **移除PAID状态卖家的取消按钮**（前端UI）
   - 删除 `src/app/orders/[id]/page.tsx:532-543` 的"取消订单（退款给买家）"按钮
   - 保留PUBLISHED状态卖家的取消功能

3. ✅ **禁止PAID+退款申请时提交转移凭证**
   ```typescript
   // transfer操作中添加检查
   if (order.refundRequested && order.refundStatus === 'PENDING') {
     return error('买家已申请退款，请先处理退款申请')
   }
   ```

4. ✅ **禁止卖家购买自己的订单**
   ```typescript
   // pay操作中添加检查
   if (order.sellerId === payload.userId) {
     return error('卖家不能购买自己的订单')
   }
   ```

**正确的退款流程**：
```
PAID状态下:
1. 买家申请退款 (request_refund)
2. 卖家同意退款 (approve_refund) → 订单变为CANCELLED，款项退还买家
   或 卖家拒绝退款 (reject_refund) → 买家可申请平台介入
3. ❌ 卖家不能直接取消订单（已修复）
```

**受影响文件**：
```
src/app/api/orders/[id]/route.ts  # 修复3个操作的业务逻辑
src/app/orders/[id]/page.tsx       # 移除错误UI
docs/BUSINESS_LOGIC_ERRORS.md     # 详细错误报告（新建）
docs/BUSINESS_LOGIC_AUDIT_CHECKLIST.md  # 审查清单（新建）
```

**业务影响**：
- 🔒 保护买家权益 - 付款后卖家不能单方面取消
- ✅ 符合担保交易原则 - 款项托管后必须通过退款流程
- 📊 防止恶意卖家攻击 - 无法通过取消订单刷单

---

### 👤 用户账务记录功能 ✅
**完成时间**：2025-10-18（最新）
**需求**：_"每个用户要能看见他自己的账务变动记录"_

**实现内容**：

1. ✅ **账务记录API**（`GET /api/user/transactions`）
   - 查询当前用户的所有Payment记录
   - 支持按类型筛选（ESCROW/RELEASE/REFUND/WITHDRAW）
   - 分页支持（默认20条/页，最大100条）
   - 包含关联订单信息
   - 限流保护（30次/分钟）

2. ✅ **账务记录页面**（`/transactions`）
   - 显示当前余额
   - 按类型筛选账务记录
   - 账务类型映射：
     - 支付购买 (ESCROW) - 红色，减号
     - 收款入账 (RELEASE) - 绿色，加号
     - 退款到账 (REFUND) - 绿色，加号
     - 提现扣除 (WITHDRAW) - 红色，减号
   - 显示关联订单链接
   - 显示交易状态（已完成/处理中/已取消）
   - 加载更多按钮（分页）
   - XSS防护（sanitizeText清理备注）

3. ✅ **导航栏集成**
   - 在Navbar组件添加"账务记录"链接
   - 位于"我的订单"和"退出"之间

**新增文件**：
```
src/app/api/user/transactions/route.ts  # 账务记录API
src/app/transactions/page.tsx           # 账务记录页面
```

**修改文件**：
```
src/components/layout/Navbar.tsx  # 添加账务记录链接
```

**技术亮点**：
- 🔍 利用现有Payment表（无需新建表）
- 🎨 清晰的收支标识（颜色+符号）
- 🔗 关联订单可点击跳转
- 📱 响应式设计
- 🔒 认证和限流保护

---

### 管理员页面安全加固完成 ✅
**完成时间**：2025-10-18

**OpenSpec变更**：`harden-admin-page-security`

**实施内容**：
1. ✅ **服务端认证保护**（CVSS 9.1 严重漏洞修复）
   - Middleware已实现完整的JWT验证
   - 检查管理员角色（role === 'ADMIN'）
   - 拦截所有 `/admin/*` 路由的未授权访问
   - Token过期/无效/非管理员自动重定向登录页

2. ✅ **XSS防护**（CVSS 7.3 高危漏洞修复）
   - 创建 `src/lib/sanitize.ts` 工具库（使用isomorphic-dompurify）
   - `sanitizeText()` - 移除所有HTML标签
   - `sanitizeHtml()` - 保留安全HTML标签
   - `sanitizeObject()` / `sanitizeArray()` - 批量清理
   - 已集成到退款页面、申诉页面的所有用户输入数据

3. ✅ **统一错误处理**
   - 创建 `src/lib/error-handler.ts`
   - `handleApiError()` - 统一处理401/403/500/网络错误
   - 替换所有 `alert()` 为 `toast.error()` / `toast.success()`
   - 401自动跳转登录页（1.5秒延迟）
   - 已集成到3个管理员页面

4. ✅ **输入验证**
   - 创建 `src/lib/validations/admin.ts`（Zod schemas）
   - `RefundActionSchema` - 退款操作验证（备注≤500字符）
   - `DisputeActionSchema` - 申诉处理验证（处理意见必填，≤1000字符）
   - `UserUpdateSchema` - 用户更新验证（手机号格式、余额≥0）
   - `WithdrawalActionSchema` - 提现审核验证（拒绝理由、交易ID）

5. ✅ **竞态条件保护**
   - 所有操作按钮添加 `disabled={actionLoading}`
   - 按钮文本动态显示"处理中..."
   - try/finally确保loading状态正确重置

6. ✅ **内存泄漏防护**
   - 所有useEffect使用AbortController
   - 组件卸载时自动取消未完成的请求
   - 使用useCallback包装fetch函数（符合React Hooks最佳实践）

7. ✅ **无障碍性增强**
   - 对话框添加role="dialog" aria-modal="true"
   - 表单字段添加htmlFor和aria-describedby
   - 支持Esc键关闭对话框
   - 按钮添加aria-label描述
   - 输入框显示字符计数（500/1000字符限制）

**修改的文件**：
```
src/lib/
├── sanitize.ts              # XSS防护工具（新增sanitizeArray）
├── error-handler.ts         # 统一错误处理（新建）
└── validations/admin.ts     # Zod验证schemas（新建）

src/app/admin/
├── layout.tsx               # 添加Toaster组件，替换alert为toast
├── page.tsx                 # 集成错误处理 + 内存泄漏防护
├── refunds/page.tsx         # 完整安全加固（XSS + 错误 + 验证 + 无障碍）
└── disputes/page.tsx        # 完整安全加固（XSS + 错误 + 验证 + 无障碍）

src/middleware.ts            # 已实现管理员认证（无需修改）
```

**安全合规**：
- ✅ OWASP Top 10 2021: A01 Broken Access Control（服务端认证）
- ✅ OWASP Top 10 2021: A03 Injection（XSS防护）
- ✅ WCAG 2.1 AA 无障碍性标准（部分）

**代码质量**：
- ✅ 使用useCallback防止不必要的重渲染
- ✅ 符合React Hooks exhaustive-deps规则
- ✅ TypeScript strict模式类型安全
- ✅ ESLint警告已修复（退款/申诉页面）

**业务价值**：
- 🔒 修复3个严重/高危安全漏洞（CVSS 9.1 + 7.3）
- 🎯 提升用户体验（Toast通知、字符计数、加载状态）
- ♿ 支持键盘导航和屏幕阅读器
- 🐛 防止内存泄漏和竞态条件

### 审计日志集成完成 ✅
**完成时间**：2025-10-18

**实施内容**：
1. ✅ **扩展审计操作常量** - 新增4个 AUDIT_ACTIONS：
   - `DELETE_USER` - 删除用户
   - `FAIL_WITHDRAWAL` - 提现失败
   - `APPROVE_REFUND` - 批准退款
   - `REJECT_REFUND` - 拒绝退款

2. ✅ **集成审计日志到4个管理员 API**（共12处调用）：
   - **用户管理** (`src/app/api/admin/users/[id]/route.ts`)
     - PATCH: 更新用户信息（余额、角色、认证状态）
     - DELETE: 删除用户
   - **提现管理** (`src/app/api/admin/withdrawals/[id]/route.ts`)
     - 批准/拒绝/完成/失败提现（4个操作）
   - **申诉处理** (`src/app/api/admin/disputes/[id]/route.ts`)
     - 同意/拒绝申诉（2个操作）
   - **退款管理** (`src/app/api/admin/refunds/[id]/route.ts`)
     - 批准/拒绝退款（2个操作）

3. ✅ **审计日志记录内容**：
   - 操作人（userId）
   - 操作类型（action，使用预定义常量）
   - 操作目标（target + targetType）
   - 修改前后的值（oldValue/newValue）
   - 操作描述（description）
   - 来源追溯（IP地址 + User-Agent）

**技术特性**：
```typescript
// 审计日志调用示例
await logAudit({
  userId: payload.userId,
  action: AUDIT_ACTIONS.APPROVE_WITHDRAWAL,
  target: withdrawalId,
  targetType: 'Withdrawal',
  oldValue: { status: 'PENDING' },
  newValue: { status: 'APPROVED', amount: 100 },
  description: '批准提现申请',
  req: request
})
```

**安全价值**：
- ✅ 满足金融平台审计要求
- ✅ 完整的操作追溯能力（谁、何时、做了什么）
- ✅ 支持安全事件调查和纠纷处理
- ✅ 审计日志失败不影响主业务流程

**相关文件**：
- `src/lib/audit.ts` - 审计日志工具（已扩展）
- `src/app/api/admin/users/[id]/route.ts` - 用户管理审计
- `src/app/api/admin/withdrawals/[id]/route.ts` - 提现管理审计
- `src/app/api/admin/disputes/[id]/route.ts` - 申诉处理审计
- `src/app/api/admin/refunds/[id]/route.ts` - 退款管理审计

### 并发保护全面增强 ✅
**完成的改进**：
1. ✅ **所有订单操作添加乐观锁保护** - 防止多标签页/多设备并发操作冲突
   - `transfer` (提交转移凭证)
   - `confirm` (确认收货)
   - `cancel` (取消订单)
   - `request_refund` (申请退款)
   - `approve_refund` (同意退款)
   - `reject_refund` (拒绝退款)
   - `request_refund_extension` (申请延期)
   - `create_dispute` (创建申诉)

2. ✅ **并发保护机制**：
   - 使用 `updateMany` + `version` 字段检查确保原子性
   - 状态变更时同步递增版本号
   - 并发冲突时返回 409 状态码，提示用户刷新页面
   - 事务操作（confirm, approve_refund, cancel, create_dispute）内部集成乐观锁

3. ✅ **用户体验优化**：
   - 退款倒计时显示秒级精度（动态更新）
   - 所有错误提示统一为"订单状态已变更，请刷新页面后重试"

**技术细节**：
```typescript
// 并发保护模式示例
const result = await prisma.order.updateMany({
  where: {
    id: orderId,
    status: 'EXPECTED_STATUS',
    version: currentVersion
  },
  data: {
    status: 'NEW_STATUS',
    version: { increment: 1 }
  }
})

if (result.count === 0) {
  return { error: '订单状态已变更，请刷新页面', status: 409 }
}
```

**业务价值**：
- 防止用户在多个浏览器标签页同时操作造成数据不一致
- 防止买家和卖家同时操作（如买家确认收货时卖家取消订单）
- 确保退款、支付、确认等关键操作的数据完整性
- 提升系统可靠性和用户信任度

### 退款超时系统 ✅
**新增功能**（从上一会话继承）：
1. ✅ 卖家响应退款申请的截止时间机制
   - 普通卖家：48小时响应时间
   - 认证卖家：24小时响应时间
   - 支持一次延期（额外24小时）
   - 考虑节假日自动延期

2. ✅ 倒计时显示组件（`RefundCountdown.tsx`）
   - 实时显示剩余时间（秒级精度）
   - 超时自动触发回调
   - 支持节假日标识

3. ✅ 自动超时处理
   - 超时未响应自动同意退款
   - 记录 `refundAutoApproved` 标识
   - 完整的审计追踪

**配置文件**：`src/lib/constants/refund-config.ts`

## 最近更新（2025-10-17）

### 安全改进 ✅
**已完成的安全修复**（详见 `SECURITY_VERIFICATION_REPORT.md`）：
1. ✅ JWT密钥升级为256位强随机密钥（CVSS 9.8 - 严重）
2. ✅ 数据库索引优化 - 27个索引已配置（CVSS 7.5 - 高危）
3. ✅ 所有关键操作使用事务保护（确认收货、取消订单、退款）
4. ✅ 乐观锁机制防止并发购买（支付竞态条件）
5. ✅ 审计日志系统已创建（`src/lib/audit.ts`）

**验证结果**：
- 事务完整性测试：4/4 通过（100%）
- 乐观锁测试：3/3 通过（100%）
- 数据库索引：27个已创建并生效

### 退款系统增强 ✅
**新增功能**（详见 `REFUND_SYSTEM_FIX_REPORT.md`）：
1. ✅ 卖家拒绝退款必须填写理由（API强制验证）
2. ✅ 订单时间线显示拒绝详情（拒绝时间 + 理由）
3. ✅ 买家可在退款被拒后申请平台介入
4. ✅ 完整的退款流程记录和追溯

**业务价值**：
- 提高透明度：所有拒绝操作必须说明理由
- 买家保护：退款被拒后可申请平台仲裁
- 审计完整：时间线完整记录所有操作

### 数据库Schema更新
**Order表新增字段**：
```prisma
model Order {
  // ... 其他字段 ...

  // 乐观锁
  version              Int       @default(0)     // 乐观锁版本号（并发控制）

  // 退款相关
  refundRejectedReason String?                  // 卖家拒绝退款理由
  refundRejectedAt     DateTime?                // 拒绝退款时间

  // 退款超时系统（2025-10-18新增）
  refundResponseDeadline       DateTime?  // 卖家响应退款的截止时间
  refundExtensionRequested     Boolean @default(false)  // 是否申请延期
  refundExtensionReason        String?    // 延期理由
  refundExtensionGrantedAt     DateTime?  // 延期批准时间
  refundAutoApproved           Boolean @default(false)  // 是否因超时自动同意
}
```

## 待实现功能（优先级排序）

### 高优先级 🔴
1. **管理员页面安全增强** - 缺少服务端认证检查和XSS防护（详见代码审查报告）
2. **支付集成** - 支付宝/微信支付接口和回调处理
3. **文件上传** - 转移凭证上传功能（可使用 OSS 或本地存储）

### 中优先级 🟡
4. **请求限流保护** - 防止暴力破解和DOS攻击（建议使用 @upstash/ratelimit）
5. **输入验证增强** - 使用Zod库统一验证（替代当前的手动验证）
6. **评价系统** - 完善评价发布和展示
7. **通知系统** - 站内消息、邮件通知、订单状态推送
8. **搜索筛选** - 多条件筛选和排序

### 低优先级 🟢
9. **管理后台完善** - 用户/订单管理、数据统计、申诉处理
10. **CSRF保护** - 关键操作添加CSRF Token验证
11. **性能优化** - CDN、缓存、React优化（React.memo, useCallback）
12. **分页功能** - 列表页面添加分页
13. **国际化** - 多语言支持（目前硬编码中文）

## 开发注意事项

### 数据库操作
- 使用 `src/lib/prisma.ts` 中的单例 Prisma Client
- 避免创建多个实例（会导致连接池耗尽）
- 开发时优先使用 `pnpm db:push`，生产环境使用 `pnpm db:migrate`

### 类型安全
- 项目使用 TypeScript strict 模式
- Prisma 自动生成类型定义
- 公共类型定义在 `src/types/index.ts`

### 样式系统
- 使用 Tailwind CSS 工具类
- `cn()` 函数（`src/lib/utils.ts`）用于条件类名合并
- UI 组件基于 Radix UI，支持无障碍访问

### 安全措施
- ✅ 密码使用 bcryptjs 加密存储（10轮salt）
- ✅ API 路由有 JWT 认证（7天有效期）
- ✅ Prisma 防止 SQL 注入
- ✅ JWT密钥使用256位强随机密钥
- ✅ 数据库事务保护所有关键操作（ACID保证）
- ✅ **乐观锁防止所有订单操作的并发竞态条件**（2025-10-18完成）
  - 8个订单操作全部使用 version 字段 + updateMany 模式
  - 防止多标签页/多设备并发操作冲突
  - 并发冲突返回 409 状态码
- ✅ 数据库索引优化查询性能（27个索引）
- ✅ **审计日志系统已集成**（2025-10-18完成）
  - 4个管理员 API 共12处审计日志调用
  - 记录所有敏感操作（用户管理、提现、申诉、退款）
  - 完整追溯：操作人、时间、目标、修改内容、IP/UA
- ⚠️ 待加强：CSRF 保护、XSS 防护、限流、文件上传验证

### 测试验证
项目包含完整的自动化测试脚本：

**事务完整性测试** (`scripts/verify-transactions.ts`):
```bash
DATABASE_URL="..." npx tsx scripts/verify-transactions.ts
```
验证内容：
- 支付操作事务完整性（订单状态 + 支付记录 + 版本号）
- 确认收货事务完整性（订单完成 + 款项释放 + 卖家余额）
- 取消订单事务完整性（订单取消 + 退款记录 + 买家余额）
- 退款操作事务完整性（状态更新 + 退款记录 + 余额恢复）

**乐观锁测试** (`scripts/verify-optimistic-lock.ts`):
```bash
DATABASE_URL="..." npx tsx scripts/verify-optimistic-lock.ts
```
验证内容：
- 单个购买成功（version 0→1）
- 并发购买保护（3个买家同时购买，只有1个成功）
- 错误version拒绝（使用旧version购买失败）

**最近测试结果**：
- 事务完整性：4/4 通过 (100%)
- 乐观锁机制：3/3 通过 (100%)
- 数据库索引：27个已创建并生效

## 业务逻辑核心

### 资金托管流程
1. 买家支付 → 款项进入平台账户（创建 `ESCROW` 类型 Payment）
2. 卖家转移 FSD 权限 → 提交凭证
3. 买家确认收货 → 平台释放款项给卖家（创建 `RELEASE` 类型 Payment）
4. 平台扣除手续费（默认 3%）

### 申诉机制
- 买家在 **TRANSFERRING** 状态下可以申诉未收到货
- 买家在 **PAID** 状态下，退款被拒绝后可以申请平台介入
- 订单状态变为 **DISPUTE**
- 申诉自动包含完整上下文（买家退款原因、卖家拒绝理由、买家诉求）
- 管理员审核证据后做出裁决（退款或放款）

### 退款流程
1. **买家申请退款**（PAID状态）：
   - 填写退款原因
   - 退款状态变为 PENDING
   - **系统自动设置响应截止时间**：
     - 认证卖家：24小时
     - 普通卖家：48小时
     - 节假日自动延期

2. **卖家处理退款**：
   - **同意退款**：订单取消，款项退还给买家
   - **拒绝退款**：**必须填写拒绝理由**，退款状态变为 REJECTED
   - **申请延期**：可申请一次延期（额外24小时），需填写延期理由
   - **超时未响应**：自动同意退款，记录 `refundAutoApproved = true`

3. **退款被拒后**：
   - 买家可以申请平台介入
   - 创建申诉记录，包含双方理由
   - 订单进入 DISPUTE 状态
   - 等待管理员仲裁

4. **倒计时显示**（用户界面）：
   - 实时显示剩余时间（秒级精度）
   - 格式："剩余 23小时59分钟45秒"
   - 超时后自动刷新订单状态

## 已知问题与改进计划

### 高优先级 🔴
1. **管理员页面安全** - 缺少服务端认证和XSS防护
   - `src/app/admin/refunds/page.tsx` 无认证检查（CVSS 9.1）
   - 用户数据未经清理直接渲染（XSS风险）
   - 缺少错误处理和竞态条件保护

### 中优先级 🟡
2. **请求限流** - 所有API端点无限流保护
   - 容易遭受暴力破解
   - 建议使用 @upstash/ratelimit

3. **输入验证** - 依赖手动验证，容易遗漏
   - 建议使用 Zod 库统一验证
   - 提供类型安全和自动错误消息

### 低优先级 🟢
4. **CSRF保护** - 敏感操作缺少CSRF Token
5. **性能优化** - 缺少分页、缓存、React优化
6. **国际化** - 硬编码中文文本

## 参考文档

### 核心文档
- **SECURITY_VERIFICATION_REPORT.md** - 完整的安全验证报告
  - 7个已修复漏洞详情
  - 测试脚本使用指南
  - 验收清单
  - 改进建议

- **REFUND_SYSTEM_FIX_REPORT.md** - 退款系统修复报告
  - 3个用户报告问题的修复
  - 平台介入功能实现
  - 业务价值分析
  - 部署指南

### 其他文档
- **API.md** - 详细 API 文档
- **ARCHITECTURE.md** - 架构和规划
- **QUICKSTART.md** - 快速开始指南
- **prisma/schema.prisma** - 数据库设计

### 测试脚本
- **scripts/verify-transactions.ts** - 事务完整性测试（4个测试场景）
- **scripts/verify-optimistic-lock.ts** - 乐观锁测试（3个测试场景）

## 代码审查发现

最近对 `src/app/admin/refunds/page.tsx` 进行了AI代码审查，发现以下问题：

### 严重问题 (CRITICAL)
- ❌ **缺少认证检查** (CVSS 9.1) - 任何人都可访问管理员页面

### 高危问题 (HIGH)
- ❌ **XSS漏洞** (CVSS 7.3) - 用户数据未清理直接渲染
- ❌ **错误处理不完整** - 缺少401/403/500/超时处理
- ✅ **竞态条件** - API层面已通过乐观锁解决（2025-10-18），前端UI需添加loading状态防止重复点击

### 中危问题 (MEDIUM)
- ⚠️ 缺少输入验证（note字段长度）
- ⚠️ useEffect内存泄漏
- ⚠️ 缺少无障碍属性
- ⚠️ 低效重渲染

### 低危问题 (LOW)
- 缺少分页
- 缺少操作确认
- 硬编码文本
- 缺少错误边界

**推荐修复顺序**：CRITICAL → HIGH → MEDIUM → LOW

## 提交历史

### 2025-10-18 并发保护全面增强
- **待提交** - 所有订单操作添加乐观锁保护
  - 修复8个订单操作的并发竞态条件
  - 使用 updateMany + version 模式确保原子性
  - 并发冲突返回409状态码
  - 退款倒计时显示秒级精度
  - 更新CLAUDE.md文档

**改进的操作**：
- `transfer` - 提交转移凭证
- `confirm` - 确认收货（事务+乐观锁）
- `cancel` - 取消订单（事务+乐观锁）
- `request_refund` - 申请退款
- `approve_refund` - 同意退款（事务+乐观锁）
- `reject_refund` - 拒绝退款
- `request_refund_extension` - 申请延期
- `create_dispute` - 创建申诉（事务+乐观锁）

### 2025-10-17 安全验证和退款系统改进
- **266c359** - 添加完整的安全验证报告和测试脚本
  - SECURITY_VERIFICATION_REPORT.md（600+行）
  - scripts/verify-transactions.ts
  - scripts/verify-optimistic-lock.ts

- **102fe16** - 添加退款系统修复详细报告
  - REFUND_SYSTEM_FIX_REPORT.md（544行）

- **a63604e** - 完善退款流程和申诉机制
  - 拒绝退款必须填写理由
  - 买家可申请平台介入
  - 订单时间线完整记录

### 2025-10-16 核心安全修复
- **0033ad1** - 修复7个关键安全漏洞
  - JWT密钥升级
  - 数据库索引添加
  - 事务保护实现
  - 乐观锁机制
  - 审计日志系统创建
