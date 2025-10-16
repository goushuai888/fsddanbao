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

## 环境变量

必需配置（`.env.local`）：
```
DATABASE_URL="postgresql://..."  # PostgreSQL 连接字符串
JWT_SECRET="..."                 # JWT 签名密钥
PLATFORM_FEE_RATE=0.03          # 平台手续费率（3%）
```

可选配置：
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`: NextAuth.js（如果使用）
- `ALIPAY_*`, `WECHAT_*`: 支付接口配置（待实现）
- `UPLOAD_DIR`, `MAX_FILE_SIZE`: 文件上传配置（待实现）

## 待实现功能（优先级排序）

### 高优先级 🚧
1. **订单展示页面** - 订单列表页面和详情页面的完整实现
2. **支付集成** - 支付宝/微信支付接口和回调处理
3. **文件上传** - 转移凭证上传功能（可使用 OSS 或本地存储）
4. **用户中心** - 个人信息管理、实名认证、账户余额

### 中优先级 🔨
5. **评价系统** - 完善评价发布和展示
6. **申诉处理** - 申诉提交和管理员处理流程
7. **通知系统** - 站内消息、邮件通知、订单状态推送
8. **搜索筛选** - 多条件筛选和排序

### 低优先级 🎯
9. **管理后台** - 用户/订单管理、数据统计
10. **安全增强** - 二次验证、操作日志、风控系统
11. **性能优化** - CDN、缓存、数据库索引

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
- ✅ 密码使用 bcryptjs 加密存储
- ✅ API 路由有 JWT 认证
- ✅ Prisma 防止 SQL 注入
- ⚠️ 待加强：CSRF 保护、XSS 防护、限流、文件上传验证

## 业务逻辑核心

### 资金托管流程
1. 买家支付 → 款项进入平台账户（创建 `ESCROW` 类型 Payment）
2. 卖家转移 FSD 权限 → 提交凭证
3. 买家确认收货 → 平台释放款项给卖家（创建 `RELEASE` 类型 Payment）
4. 平台扣除手续费（默认 3%）

### 申诉机制
- 在 PAID/TRANSFERRING 状态下，任一方都可发起申诉
- 订单状态变为 DISPUTE
- 管理员审核证据后做出裁决（退款或放款）

## 参考文档
- 详细 API 文档：`API.md`
- 架构和规划：`ARCHITECTURE.md`
- 快速开始：`QUICKSTART.md`
- 数据库设计：`prisma/schema.prisma`
