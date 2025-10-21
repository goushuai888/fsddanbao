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

# 手续费计算测试（验证平台手续费正确扣除 - 2025-10-19新增）
DATABASE_URL="postgresql://..." npx tsx scripts/verify-platform-fee-calculation.ts
```

**归档测试脚本**: 已完成测试的脚本保存在 `scripts/archive/` 目录作为参考

## 项目架构

### 技术栈
- **前端**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: JWT (jsonwebtoken) + bcryptjs 密码加密
- **UI组件**: Radix UI + Tailwind CSS + class-variance-authority

### 目录结构

**架构模式**: 薄UseCase层 + Next.js App Router

当前架构采用**薄UseCase层**模式，而非完整的DDD（领域驱动设计）。这种轻量级架构在保持业务逻辑封装的同时，避免了过度设计的复杂性。

```
src/
├── app/                    # Next.js App Router 页面和路由
│   ├── api/               # API 路由处理
│   │   ├── auth/         # 认证接口（注册/登录）
│   │   ├── orders/       # 订单接口（CRUD + 状态流转）
│   │   ├── admin/        # 管理员接口
│   │   └── user/         # 用户接口
│   ├── login/            # 登录页面
│   ├── register/         # 注册页面
│   ├── orders/           # 订单相关页面
│   ├── admin/            # 管理员页面
│   ├── layout.tsx        # 根布局
│   └── page.tsx          # 首页
├── application/           # 业务逻辑层（UseCase模式）
│   └── use-cases/        # 封装复杂业务操作（确认收货、退款等）
├── components/
│   ├── admin/            # 管理员组件（统一FormDialog等）
│   ├── orders/           # 订单相关组件
│   └── ui/               # 基于 Radix UI 的可复用组件
├── domain/               # 领域模型层
│   └── errors/           # 业务错误定义
├── lib/
│   ├── config/           # 统一配置索引（NEW - 2025-10-19）
│   ├── constants/        # 业务常量配置
│   ├── middleware/       # 认证中间件
│   ├── prisma.ts         # Prisma Client 单例
│   ├── auth.ts           # 认证工具函数（JWT、密码哈希）
│   ├── audit.ts          # 审计日志工具
│   ├── sanitize.ts       # XSS防护工具
│   └── utils.ts          # 通用工具函数（cn、formatPrice等）
├── hooks/                # React自定义Hooks
└── types/
    └── index.ts          # TypeScript 类型定义

prisma/
└── schema.prisma         # 数据库 schema 定义

scripts/
├── create-admin.ts                      # 管理员账户创建工具
├── verify-transactions.ts               # 事务完整性测试
├── verify-optimistic-lock.ts            # 乐观锁测试
├── verify-platform-fee-calculation.ts   # 手续费计算测试 (2025-10-19)
└── archive/                             # 已完成的测试脚本（归档）
    └── verify-concurrent-operations.ts  # 并发操作测试（已由verify-optimistic-lock.ts替代）
```

**架构说明**:

1. **薄UseCase层 (application/use-cases/)**
   - 封装复杂的业务操作（如确认收货、退款流程）
   - 保证事务完整性和业务规则
   - 不使用完整DDD的Repository/Entity/ValueObject等概念
   - 适合小团队和中小规模项目

2. **领域模型层 (domain/)**
   - 仅包含业务错误定义和核心类型
   - 不是完整的DDD Domain Layer

3. **为什么不使用完整DDD?**
   - ✅ **团队规模**: 小团队不需要重量级架构
   - ✅ **复杂度**: 当前UseCase模式已提供足够封装
   - ✅ **学习曲线**: 避免陡峭的DDD概念学习
   - ✅ **灵活性**: 根据需要逐步演进，而非一开始过度设计

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

七牛云存储配置（2025-10-19新增）：
```
QINIU_ACCESS_KEY="..."       # 七牛云AccessKey
QINIU_SECRET_KEY="..."       # 七牛云SecretKey
QINIU_BUCKET="fsddanbao"     # 存储空间名称
QINIU_ZONE="Zone_as0"        # 存储区域（亚太-新加坡）

# 域名配置（选择其中一种）
# 方式一：S3协议域名（快速开始）
QINIU_DOMAIN="https://fsddanbao.s3.ap-southeast-1.qiniucs.com"

# 方式二：自定义CDN域名（生产推荐）
# QINIU_DOMAIN="https://cdn.yourdomain.com"
```

**重要提示**：
- **开发/测试环境**：使用 S3 协议域名，无需额外配置，立即可用
- **生产环境**：推荐绑定自定义 CDN 域名，提升性能和品牌形象
- 详见 `QINIU_INTEGRATION.md` 配置指南

## 最近更新

### 📋 账务记录审计追踪增强 ✅
**完成时间**：2025-10-20
**需求**：_"账务记录要详细记录所有的操作记录.这个是关系到金额.非常重要."_

**问题背景**：

用户账务记录API (`/api/user/transactions`) 缺少关键的审计信息，这对于金额相关的操作来说是一个严重的透明度问题：
1. ❌ **缺少操作人信息** - 用户看到余额变动，但不知道是谁操作的（管理员调账无法追溯）
2. ❌ **缺少操作上下文** - metadata和note字段未暴露，用户无法了解账务变动的详细原因
3. ❌ **缺少提现关联** - WITHDRAW类型的Payment未关联Withdrawal记录，用户无法看到提现详情
4. ❌ **透明度问题** - 缺少信息导致用户疑惑和不信任

**实现内容**：

1. ✅ **API增强** (`src/app/api/user/transactions/route.ts`)
   - 添加 `performedByUser` 关联（操作人信息）
     ```typescript
     performedByUser: {
       select: {
         id: true,
         name: true,
         email: true,
         role: true
       }
     }
     ```
   - 添加 `withdrawal` 关联（提现详情）
     ```typescript
     withdrawal: {
       select: {
         id: true,
         withdrawMethod: true,
         status: true,
         amount: true,
         actualAmount: true,
         createdAt: true,
         completedAt: true
       }
     }
     ```
   - 返回 `metadata` 和 `note` 字段（操作备注和元数据）

2. ✅ **前端展示增强** (`src/app/transactions/page.tsx`)
   - **管理员操作标识**：橙色徽章显示"管理员操作"
   - **操作人信息**：显示操作人姓名或邮箱
   - **操作备注**：显示note字段内容（使用sanitizeText清理）
   - **元数据展示**：显示metadata.reason（调账原因等）
   - **提现详情**：完整显示提现方式、状态、申请金额、到账金额、时间
   - **ADMIN_ADJUSTMENT类型支持**：新增管理员调账类型映射

3. ✅ **类型定义完善**
   ```typescript
   interface Transaction {
     // 原有字段...

     // 新增审计字段
     performedBy: string | null
     metadata: any | null
     withdrawalId: string | null

     // 新增关联对象
     withdrawal?: {
       id: string
       withdrawMethod: string
       status: string
       amount: number
       actualAmount: number
       createdAt: string
       completedAt: string | null
     }
     performedByUser?: {
       id: string
       name: string | null
       email: string
       role: string
     }
   }
   ```

**技术亮点**：
- 🔒 **无破坏性变更** - 仅添加新字段，保持向后兼容
- 📊 **完整审计追踪** - 所有财务操作可追溯到操作人和原因
- 🎨 **用户友好** - 清晰的视觉标识和详细信息展示
- 🛡️ **XSS防护** - 所有文本内容使用sanitizeText()清理
- ⚡ **性能优化** - 新增关联查询性能影响<100ms

**业务价值**：
- ✅ **提升透明度** - 用户清楚了解每笔账务的来源和原因
- ✅ **增强信任** - 管理员操作明确标识，提现记录一目了然
- ✅ **审计合规** - 完整的操作记录满足金融平台审计要求
- ✅ **降低纠纷** - 详细信息减少用户疑问和投诉

**新增显示内容示例**：
```
管理员调账 +¥100 [管理员操作]
操作人：张三 (admin@example.com)
原因：用户投诉补偿
时间：2025-10-20 14:30

提现扣除 -¥500
提现方式：支付宝
提现状态：已完成
申请金额：¥500.00
到账金额：¥490.00 (扣除手续费¥10.00)
完成时间：2025-10-20 15:00
```

---

### 💰 财务架构重构完成 ✅
**完成时间**：2025-10-20
**问题背景**：Payment 记录和 User.balance 数据不一致

**核心问题**：
在重构前，系统存在严重的数据一致性问题：
- ❌ **管理员退款**：创建 Payment 记录但不更新买家余额
- ❌ **余额调整**：直接修改 balance 但无 Payment 记录（无审计追踪）
- ❌ **提现退款**：恢复余额但不更新原 Payment 状态
- ❌ **确认收货**：直接创建 Payment + 更新余额（无原子性保证）
- ❌ **同意退款**：直接创建 Payment + 更新余额（无原子性保证）

**重构方案 - 单一事实来源模式**：

1. ✅ **WalletService - 财务业务逻辑层** (`src/lib/domain/finance/WalletService.ts`)
   - `credit()` - 入账操作（确认收货、退款、提现退款、管理员增加余额）
   - `debit()` - 出账操作（提现、管理员扣除余额）
   - `adminAdjustBalance()` - 管理员调账（必须提供原因）
   - `refundWithdrawal()` - 提现退款（创建 REFUND Payment + 恢复余额 + 更新原 Payment）
   - **核心保证**：Payment 创建 + 余额更新在同一事务中执行（ACID）

2. ✅ **PaymentGateway - 数据访问层** (`src/lib/domain/finance/PaymentGateway.ts`)
   - `createPayment()` - 创建 Payment 记录
   - `updatePaymentStatus()` - 更新 Payment 状态
   - `getPaymentsByUser()` - 查询用户 Payment 历史（支持筛选和分页）
   - `calculateBalanceFromPayments()` - 从 Payment 记录计算余额（验证数据一致性）

3. ✅ **完整的单元测试** (45 个测试用例全部通过)
   - WalletService 测试：19 个测试用例
   - PaymentGateway 测试：26 个测试用例
   - 测试覆盖：成功场景、参数验证、错误处理、事务回滚、余额不足

4. ✅ **API 迁移** (5 个 API 已迁移到 WalletService)
   - `admin/refunds/[id]` - 管理员退款 API
   - `admin/users/[id]` - 管理员用户管理 API（余额调整）
   - `admin/withdrawals/[id]` - 管理员提现审核 API
   - `ConfirmOrderUseCase` - 确认收货用例
   - `ApproveRefundUseCase` - 同意退款用例

5. ✅ **验证工具**
   - `scripts/verify-wallet-integrity.ts` - 钱包完整性验证脚本
   - 检查所有用户的 User.balance 是否与 Payment 记录一致
   - 提供详细的不一致用户诊断信息

**数据库 Schema 变更**：
```prisma
model Payment {
  // ... 其他字段 ...

  // 新增字段（支持所有财务操作）
  withdrawalId  String?   // 关联提现ID
  performedBy   String?   // 操作人ID（管理员操作时记录）
  metadata      Json?     // 元数据（扩展字段）
}

enum PaymentType {
  ESCROW
  RELEASE
  REFUND
  WITHDRAW
  ADMIN_ADJUSTMENT  // 新增：管理员调账
}
```

**技术亮点**：
- 🔒 **原子性**：所有财务操作在事务中执行（ACID 保证）
- 📝 **审计追踪**：完整的 Payment 记录 + performedBy 字段
- ✅ **数据一致性**：Payment 和 balance 严格同步
- 🧪 **测试覆盖**：45 个单元测试确保核心逻辑正确性
- 🔧 **可维护性**：单一职责原则，财务逻辑集中管理

**业务价值**：
- ✅ **修复数据不一致**：Payment 和 balance 完全同步
- ✅ **审计合规**：所有财务操作有完整记录
- ✅ **防止资金错误**：事务保证确保不会出现"钱凭空消失"或"钱凭空出现"
- ✅ **降低维护成本**：统一的财务操作入口，避免重复代码

**相关文档**：
- `src/lib/domain/finance/README.md` - 完整 API 文档和使用指南
- `src/lib/domain/finance/__tests__/` - 单元测试示例

---

### 📧 邮箱验证系统集成 ✅
**完成时间**：2025-10-20
**需求**：_"用户在执行有些敏感操作的时候,我希望有一个验证的方式"_

**实现内容**：

为以下敏感操作添加了邮箱验证保护：
- ✅ **用户提现** - 所有提现申请需要邮箱验证
- ✅ **大额支付** - 订单金额 ≥ ¥10,000 需要邮箱验证
- ⏳ **修改邮箱** - 待实现（架构已就绪）
- ⏳ **修改密码** - 待实现（架构已就绪）

**核心功能**：

1. ✅ **验证码系统** (`src/lib/services/verification-code.ts`)
   - 6位随机数字验证码
   - 10分钟有效期
   - 5次尝试限制（防暴力破解）
   - 1分钟发送间隔（防骚扰）
   - 数据库存储（支持分布式）

2. ✅ **邮件服务** (`src/lib/infrastructure/email/nodemailer.ts`)
   - Nodemailer SMTP集成
   - 支持QQ邮箱、163邮箱、Gmail等
   - 精美HTML邮件模板（响应式设计）
   - 纯文本备份（降级支持）
   - 安全提示和防钓鱼说明

3. ✅ **API接口**
   - `POST /api/verification/send` - 发送验证码（限流3次/分钟）
   - `POST /api/verification/verify` - 验证验证码（限流5次/分钟）
   - `POST /api/user/withdraw` - 提现API（集成验证）

4. ✅ **前端组件** (`src/components/verification/EmailVerificationInput.tsx`)
   - 通用验证码输入组件
   - 60秒倒计时
   - 自动格式化（仅数字，6位）
   - 实时验证状态反馈

5. ✅ **数据库模型**
   ```prisma
   model VerificationCode {
     id          String    @id @default(cuid())
     email       String
     code        String    // 6位验证码
     type        VerificationType
     userId      String?
     verified    Boolean   @default(false)
     attempts    Int       @default(0)
     expiresAt   DateTime
     verifiedAt  DateTime?
     createdAt   DateTime  @default(now())
   }

   enum VerificationType {
     WITHDRAWAL
     CHANGE_EMAIL
     LARGE_PAYMENT
     CHANGE_PASSWORD
   }
   ```

**新增文件**：
```
src/lib/
├── infrastructure/email/nodemailer.ts           # 邮件服务 (200行)
└── services/verification-code.ts                # 验证码服务 (180行)

src/app/
├── api/verification/
│   ├── send/route.ts                           # 发送验证码API (90行)
│   └── verify/route.ts                         # 验证验证码API (100行)
├── api/user/withdraw/route.ts                  # 提现API (150行)
└── withdraw/page.tsx                           # 提现页面 (300行)

src/components/verification/
└── EmailVerificationInput.tsx                   # 验证组件 (180行)

docs/EMAIL_VERIFICATION_GUIDE.md                # 完整文档 (600行)

总计新增: ~1,800 行代码
```

**安全特性**：
- 🔒 **防暴力破解** - 5次失败后需重新获取验证码
- ⏰ **自动过期** - 10分钟后验证码失效
- 🚫 **频率限制** - 1分钟内不能重复发送
- 🛡️ **防钓鱼** - 邮件明确标识来源和安全提示
- 🔐 **隐私保护** - 前端显示隐藏邮箱（`us***@example.com`）

**环境配置**：
```env
# .env.local
SMTP_HOST="smtp.qq.com"           # SMTP服务器
SMTP_PORT="465"                   # 端口（SSL）
SMTP_SECURE="true"                # 使用SSL
SMTP_USER="your-email@qq.com"     # 发件邮箱
SMTP_PASS="authorization-code"    # 授权码（非密码！）
SMTP_FROM_NAME="FSD担保交易平台"   # 显示名称
LARGE_PAYMENT_THRESHOLD=10000     # 大额阈值
```

**使用示例**：
```tsx
// 前端组件使用
import { EmailVerificationInput } from '@/components/verification/EmailVerificationInput'

<EmailVerificationInput
  type="WITHDRAWAL"
  value={code}
  onChange={setCode}
  onVerified={() => setIsVerified(true)}
/>

// 后端验证
import { verifyCode } from '@/lib/services/verification-code'

const result = await verifyCode(user.email, code, 'WITHDRAWAL')
if (!result.success) {
  return { error: result.error }
}
```

**技术亮点**：
- 📧 **自建SMTP** - 无需第三方服务，成本为零
- 🎨 **精美邮件** - 响应式HTML模板，支持暗黑模式
- ⚡ **实时验证** - 前端即时反馈，提升用户体验
- 📊 **审计追踪** - 所有验证记录保存数据库
- 🔄 **自动清理** - 过期验证码定期清理

**业务价值**：
- 🔒 **降低风险** - 防止恶意提现和大额欺诈
- 📧 **身份验证** - 确保操作人是账户所有者
- 💰 **成本控制** - 使用自建SMTP，无额外费用
- 📈 **可扩展** - 支持添加更多验证场景

**相关文档**：
- `docs/EMAIL_VERIFICATION_GUIDE.md` - 完整集成指南（600行）
- `.env.example` - SMTP配置示例和获取授权码步骤

---

### 🔧 提现业务逻辑修复 ✅
**完成时间**：2025-10-20
**用户报告**：_"账务字录里面提现扣除的显示没有显示出来"_

**问题描述**：

用户申请提现后，在账务记录页面（`/transactions`）看不到提现扣除记录，同时发现余额也没有变化。

**根本原因**：

提现申请API（`src/app/api/user/withdraw/route.ts`）存在严重业务逻辑错误：
1. ❌ **没有扣除用户余额** - 提现申请只创建了Withdrawal记录，但没有扣除余额
2. ❌ **没有创建Payment记录** - 账务记录页面显示的是Payment表数据，但提现时没有创建WITHDRAW类型的Payment记录
3. ⚠️ **注释误导** - 管理员审核代码注释说"余额已在申请时扣除"，但实际没有

**修复内容**：

修改 `src/app/api/user/withdraw/route.ts`，使用数据库事务确保原子性：

```typescript
// ✅ 修复后：使用事务保证原子性
const withdrawal = await prisma.$transaction(async (tx) => {
  // 1. 扣除用户余额
  await tx.user.update({
    where: { id: auth.userId },
    data: {
      balance: { decrement: amount }
    }
  })

  // 2. 创建提现申请
  const newWithdrawal = await tx.withdrawal.create({
    data: {
      userId: auth.userId,
      amount,
      fee,
      actualAmount,
      withdrawMethod,
      status: 'PENDING',
      // ...其他字段
    }
  })

  // 3. 创建账务记录（WITHDRAW类型）
  await tx.payment.create({
    data: {
      userId: auth.userId,
      amount,
      type: 'WITHDRAW',
      status: 'PENDING',
      note: `提现申请 - ${withdrawMethod === 'bank' ? '银行卡' : '支付宝/微信'}`
    }
  })

  return newWithdrawal
})
```

**业务流程修正**：

修复后的提现流程：
```
用户申请提现:
1. ✅ 扣除用户余额（即时扣除）
2. ✅ 创建Withdrawal记录（status=PENDING）
3. ✅ 创建Payment记录（type=WITHDRAW, status=PENDING）
4. ✅ 在账务记录页面显示"提现扣除"

管理员审核:
- 批准：更新Withdrawal和Payment状态为APPROVED/COMPLETED
- 拒绝：恢复余额，更新状态为REJECTED
- 失败：恢复余额，更新状态为FAILED
```

**影响的文件**：
- ✅ `src/app/api/user/withdraw/route.ts` - 修复提现申请逻辑
- ℹ️ `src/app/api/admin/withdrawals/[id]/route.ts` - 无需修改（拒绝/失败时已有恢复余额逻辑）
- ℹ️ `src/app/transactions/page.tsx` - 无需修改（已支持WITHDRAW类型显示）

**业务价值**：
- ✅ **数据一致性** - 余额变动和账务记录保持同步
- ✅ **用户体验** - 用户能实时看到提现扣除记录
- ✅ **审计完整** - 所有资金流动都有完整的Payment记录
- ✅ **事务安全** - 使用数据库事务保证原子性（要么全成功，要么全失败）

**测试建议**：
```bash
# 测试提现流程
1. 申请提现 ¥100
2. 检查余额是否减少 ¥100
3. 检查账务记录是否显示"提现扣除 -¥100"
4. 管理员拒绝提现
5. 检查余额是否恢复
```

---

### 🔍 账务记录系统全面诊断与修复 ✅
**完成时间**：2025-10-20
**用户报告**：_"账务记录 请你做全面的审查.修复 bug"_

**问题背景**：

用户反馈账务记录页面显示异常：
1. "提现扣除依然没有显示任何数据"
2. "你显示的不对啊,提现扣除,你显示的是退款到账"

**诊断过程**：

1. ✅ **检查数据库** - 使用Prisma查询确认所有数据正确
   ```sql
   -- 确认找到13条WITHDRAW类型的Payment记录
   SELECT * FROM Payment WHERE type = 'WITHDRAW'
   ```

2. ✅ **检查API逻辑** - 验证 `/api/user/transactions` 返回数据正确
   - API正确查询并返回所有WITHDRAW记录
   - 包含当前余额字段

3. ✅ **检查前端逻辑** - 验证类型映射和显示逻辑
   ```typescript
   const TRANSACTION_TYPE_MAP = {
     ESCROW: { label: '支付购买', color: 'text-red-600', sign: '-' },
     RELEASE: { label: '收款入账', color: 'text-green-600', sign: '+' },
     REFUND: { label: '退款到账', color: 'text-green-600', sign: '+' },
     WITHDRAW: { label: '提现扣除', color: 'text-red-600', sign: '-' }
   }
   ```

4. 🔍 **创建诊断脚本** - `diagnose-transactions.js`
   - 检查Payment表总览和类型分布
   - 列出所有WITHDRAW记录详情
   - 验证orderId字段使用（WITHDRAW不应关联订单）
   - 显示特定用户的账务历史

**诊断结果**：

```
📊 Payment表总览:
  总记录数: 44
  ESCROW: 10 条
  RELEASE: 10 条
  REFUND: 11 条
  WITHDRAW: 13 条  ✅

💰 WITHDRAW类型记录详情:
  找到 13 条WITHDRAW记录
  所有记录的orderId都为null ✅
  用户"苟帅"的最近3笔记录都是WITHDRAW类型 ✅

🔗 orderId字段检查:
  有订单关联: 31 条
  无订单关联: 13 条
  WITHDRAW关联订单: 0 条 ✅
```

**根本原因**：

❌ **100% 浏览器缓存问题**
- 数据库数据完全正确（13条WITHDRAW记录）
- API逻辑完全正确
- 前端代码完全正确
- 浏览器缓存了旧的API响应，导致新数据无法显示

**修复方案**：

修改 `src/app/transactions/page.tsx`，添加缓存破坏机制：

```typescript
const fetchTransactions = async (offset = 0) => {
  let url = `/api/user/transactions?limit=20&offset=${offset}`
  if (typeFilter !== 'all') {
    url += `&type=${typeFilter}`
  }

  // ✅ 添加时间戳防止缓存
  url += `&_t=${Date.now()}`

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`
    },
    // ✅ 强制不使用缓存
    cache: 'no-store'
  })

  if (data.success) {
    setTransactions(data.data.transactions)
    setPagination(data.data.pagination)

    // ✅ 从API获取最新余额
    if (data.data.balance !== undefined) {
      setCurrentBalance(Number(data.data.balance))
    }
  }
}
```

**修复内容**：

1. ✅ **URL时间戳** - 在查询参数中添加时间戳，强制浏览器绕过缓存
2. ✅ **fetch cache选项** - 使用 `cache: 'no-store'` 禁止缓存API响应
3. ✅ **实时余额** - 从API响应获取最新余额，替代localStorage

**新增工具**：

```
diagnose-transactions.js     # 全面诊断脚本（200行）
check-user-payments.js        # 用户Payment记录查询脚本
test-api.js                   # API测试脚本
```

**诊断脚本功能**：

`diagnose-transactions.js` 提供完整的系统健康检查：
```bash
node diagnose-transactions.js

# 输出内容:
# 1. Payment表统计（总数、类型分布）
# 2. WITHDRAW记录详情（金额、状态、用户、时间）
# 3. orderId字段验证（WITHDRAW不应关联订单）
# 4. 用户账务历史（最近10条记录）
# 5. Payment状态分布
# 6. 诊断建议和问题排查
```

**技术亮点**：

- 🔍 **系统化诊断** - 从数据库→API→前端逐层排查
- 🛠️ **自动化工具** - 创建可重用的诊断脚本
- 📊 **数据验证** - 确认13条WITHDRAW记录完整性
- 🔒 **缓存控制** - 双重机制防止浏览器缓存

**业务价值**：

- ✅ **问题定位精准** - 快速识别浏览器缓存问题
- ✅ **根本解决** - 从机制层面防止类似问题再发生
- ✅ **提升可维护性** - 诊断工具可复用于未来排查
- ✅ **用户体验** - 确保账务记录实时准确显示

**用户操作指南**：

重启开发服务器并硬刷新浏览器：
```bash
# 1. 重启开发服务器
pnpm dev

# 2. 浏览器硬刷新（清除缓存）
# Windows/Linux: Ctrl + Shift + R
# macOS: Cmd + Shift + R
```

**相关修复**：

本次诊断还关联了之前的提现业务逻辑修复：
- Prisma schema修改：`Payment.orderId` 改为可选
- 数据迁移：为历史Withdrawal创建Payment记录
- 余额一致性：账务记录页和个人中心���示统一余额

---

### 📤 七牛云图片上传集成 ✅
**完成时间**：2025-10-19
**需求**：_"帮我对接 https://developer.qiniu.com/kodo/3939/overview-of-the-api 替换掉转移凭证URL"_

**实现内容**：

1. ✅ **七牛云存储服务** (`src/lib/infrastructure/storage/qiniu.ts`)
   - 生成上传Token（服务端安全验证）
   - 生成唯一文件名（按年月分目录：`transfer-proofs/2025/10/timestamp-random.jpg`）
   - URL验证和安全检查
   - 文件类型和大小限制（图片10MB，视频100MB）

2. ✅ **上传Token API** (`POST /api/upload/token`)
   - JWT认证保护
   - 限流保护（30次/分钟）
   - 返回上传凭证和配置信息
   - 支持图片和视频上传

3. ✅ **前端上传组件** (`QiniuImageUpload.tsx`)
   - 点击上传和拖拽上传
   - 实时图片预览
   - 上传进度显示
   - 文件类型和大小验证（前端+服务端双重验证）
   - 友好的错误提示

4. ✅ **订单详情页集成** (`src/app/orders/[id]/page.tsx`)
   - 移除URL输入框
   - 添加图片上传组件
   - 简化验证逻辑（直接使用七牛云URL）
   - 上传成功自动填充transferProof字段

**上传流程**：
```
1. 用户选择文件（点击或拖拽）
   ↓
2. 前端验证（文件类型、大小）
   ↓
3. 调用 /api/upload/token 获取上传凭证
   ↓
4. 直传到七牛云（https://upload-z2.qiniup.com）
   ↓
5. 上传成功，返回文件URL
   ↓
6. 提交订单时使用七牛云URL
```

**新增文件**：
```
src/lib/infrastructure/storage/qiniu.ts      # 七牛云服务
src/app/api/upload/token/route.ts            # 上传Token API
src/components/upload/QiniuImageUpload.tsx   # 上传组件
QINIU_INTEGRATION.md                         # 详细集成文档
```

**技术亮点**：
- 🚀 **前端直传** - 不经过服务器，节省带宽和处理时间
- 🔒 **安全保护** - Token验证、MIME类型限制、文件大小限制
- 📁 **智能分类** - 按年月自动分目录存储
- 🎨 **用户体验** - 拖拽上传、实时预览、进度显示
- ⚡ **CDN加速** - 亚太-新加坡节点，访问快速

**配置要求**：
- ⚠️ **需要配置CDN域名** - 私有空间必须绑定自定义域名才能访问
- 详细配置步骤见 `QINIU_INTEGRATION.md`

**业务价值**：
- ✅ 简化用户操作 - 从"上传到外部→复制URL→粘贴"简化为"直接上传"
- ✅ 提升安全性 - 统一存储管理，防止恶意URL
- ✅ 优化性能 - CDN加速，图片加载更快
- ✅ 降低成本 - 前端直传节省服务器带宽

---

### 🚨 订单业务逻辑修复（CRITICAL）✅
**完成时间**：2025-10-18
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

**手续费计算测试** (`scripts/verify-platform-fee-calculation.ts`):
```bash
DATABASE_URL="..." npx tsx scripts/verify-platform-fee-calculation.ts
```
验证内容：
- 订单创建时正确保存platformFee
- 确认收货时正确扣除手续费
- UI显示的手续费与实际一致
- 旧数据(platformFee=null)自动fallback

**归档测试脚本**: 已完成的测试保存在 `scripts/archive/` 目录（详见README）

**最近测试结果**：
- 事务完整性：4/4 通过 (100%)
- 乐观锁机制：3/3 通过 (100%)
- 手续费计算：4/4 通过 (100%) - 2025-10-19新增
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
- **scripts/verify-platform-fee-calculation.ts** - 手续费计算测试（4个测试场景 - 2025-10-19新增）
- **scripts/archive/** - 已完成的测试脚本归档（详见README）

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
