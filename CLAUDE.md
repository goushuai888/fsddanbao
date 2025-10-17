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

### 订单状态流转
```
PUBLISHED (已发布)
    ↓ 买家支付
PAID (已支付 - 款项进入平台托管)
    ↓ 卖家提交转移凭证
TRANSFERRING (转移中)
    ↓ 买家确认收货
COMPLETED (已完成 - 平台释放款项给卖家)

任何阶段都可能进入 → CANCELLED (已取消) 或 DISPUTE (申诉中)
```

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
- `request_refund`: 买家申请退款（PAID状态）
- `approve_refund`: 卖家同意退款（PAID → CANCELLED，退款给买家）
- `reject_refund`: 卖家拒绝退款（**必须提供拒绝理由**）
- `create_dispute`: 买家发起申诉（TRANSFERRING状态未收到货，或PAID状态退款被拒后申请平台介入）

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
  version              Int       @default(0)     // 乐观锁版本号
  refundRejectedReason String?                  // 卖家拒绝退款理由
  refundRejectedAt     DateTime?                // 拒绝退款时间
}
```

## 待实现功能（优先级排序）

### 高优先级 🔴
1. **审计日志集成** - `src/lib/audit.ts` 已实现，需要在13个管理员API路由中调用
2. **管理员页面安全增强** - 缺少服务端认证检查和XSS防护（详见代码审查报告）
3. **支付集成** - 支付宝/微信支付接口和回调处理
4. **文件上传** - 转移凭证上传功能（可使用 OSS 或本地存储）

### 中优先级 🟡
5. **请求限流保护** - 防止暴力破解和DOS攻击（建议使用 @upstash/ratelimit）
6. **输入验证增强** - 使用Zod库统一验证（替代当前的手动验证）
7. **评价系统** - 完善评价发布和展示
8. **通知系统** - 站内消息、邮件通知、订单状态推送
9. **搜索筛选** - 多条件筛选和排序

### 低优先级 🟢
10. **管理后台完善** - 用户/订单管理、数据统计、申诉处理
11. **CSRF保护** - 关键操作添加CSRF Token验证
12. **性能优化** - CDN、缓存、React优化（React.memo, useCallback）
13. **分页功能** - 列表页面添加分页
14. **国际化** - 多语言支持（目前硬编码中文）

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
- ✅ 乐观锁防止并发竞态条件
- ✅ 数据库索引优化查询性能（27个索引）
- ⚠️ 待加强：CSRF 保护、XSS 防护、限流、文件上传验证、审计日志集成

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

2. **卖家处理退款**：
   - **同意退款**：订单取消，款项退还给买家
   - **拒绝退款**：**必须填写拒绝理由**，退款状态变为 REJECTED

3. **退款被拒后**：
   - 买家可以申请平台介入
   - 创建申诉记录，包含双方理由
   - 订单进入 DISPUTE 状态
   - 等待管理员仲裁

## 已知问题与改进计划

### 高优先级 🔴
1. **审计日志集成** - `src/lib/audit.ts` 已创建但未在管理员API中使用
   - 影响13个管理员API路由
   - 缺少操作追溯能力
   - 不符合安全合规要求

2. **管理员页面安全** - 缺少服务端认证和XSS防护
   - `src/app/admin/refunds/page.tsx` 无认证检查（CVSS 9.1）
   - 用户数据未经清理直接渲染（XSS风险）
   - 缺少错误处理和竞态条件保护

### 中优先级 🟡
3. **请求限流** - 所有API端点无限流保护
   - 容易遭受暴力破解
   - 建议使用 @upstash/ratelimit

4. **输入验证** - 依赖手动验证，容易遗漏
   - 建议使用 Zod 库统一验证
   - 提供类型安全和自动错误消息

### 低优先级 🟢
5. **CSRF保护** - 敏感操作缺少CSRF Token
6. **性能优化** - 缺少分页、缓存、React优化
7. **国际化** - 硬编码中文文本

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
- ❌ **竞态条件** - 并发操作可能导致状态不一致

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
