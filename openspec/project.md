# Project Context

## Purpose
FSD担保交易平台 - 专门用于 Tesla FSD (Full Self-Driving) 自动驾驶权限转移的担保交易平台。平台作为可信第三方，托管买家资金直到卖家完成 FSD 权限转移，保护双方交易安全。

## Tech Stack
- **前端**: Next.js 14 (App Router) + React 18 + TypeScript
- **样式**: Tailwind CSS + Radix UI + shadcn/ui
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: JWT (jsonwebtoken) + bcryptjs
- **包管理**: pnpm
- **部署**: Docker + Docker Compose

## Project Conventions

### Code Style
- TypeScript strict 模式，所有代码必须有类型定义
- 使用 ESLint 检查代码质量（`pnpm lint`）
- Tailwind CSS 工具类优先，使用 `cn()` 函数合并条件类名
- 文件命名：kebab-case（路由文件）、PascalCase（组件）
- 组件放在 `src/components/`，UI组件在 `src/components/ui/`

### Architecture Patterns
- **App Router**: 使用 Next.js 14 App Router，页面在 `src/app/`
- **API Routes**: RESTful 风格，响应格式统一：`{ success, data, error }`
- **数据库**: Prisma Client 单例（`src/lib/prisma.ts`），避免多实例
- **认证**: JWT token（7天有效期），存储在 localStorage
- **事务保护**: 所有关键操作（支付、确认、退款）使用 Prisma 事务
- **并发控制**: 所有订单状态变更使用乐观锁（version字段）+ `updateMany`
- **文件引用**: 使用 `file_path:line_number` 格式（如 `src/lib/auth.ts:42`）

### Testing Strategy
- **事务完整性测试**: `scripts/verify-transactions.ts`（验证ACID特性）
- **乐观锁测试**: `scripts/verify-optimistic-lock.ts`（验证并发保护）
- **手动测试**: 使用 Prisma Studio（`pnpm db:studio`）检查数据
- **测试执行**: `DATABASE_URL="..." npx tsx scripts/[test-file].ts`

### Git Workflow
- **主分支**: `main`（所有PR合并到main）
- **提交规范**:
  - `feat:` 新功能
  - `fix:` 错误修复
  - `docs:` 文档更新
  - `chore:` 依赖升级、配置变更
- **提交消息**: 详细描述变更，自动添加 Claude Code 标识
- **版本管理**: 使用 Git tags（如 v1.2.0）
- **部署**: 推送到 GitHub Container Registry（ghcr.io/goushuai888/fsddanbao）

## Domain Context

### 业务流程
1. **卖家发布订单**（PUBLISHED）- 设置价格、描述 FSD 权限详情
2. **买家支付**（PAID）- 款项进入平台托管
3. **卖家转移权限**（TRANSFERRING）- 提交转移凭证
4. **买家确认收货**（COMPLETED）- 平台释放款项给卖家，扣除手续费（3%）

### 退款机制
- 买家在 PAID 状态可申请退款（系统自动设置响应截止时间）
- 卖家必须在截止时间内响应：同意/拒绝/申请延期
- 拒绝退款必须填写理由，买家可申请平台介入
- 超时未响应自动同意退款

### 申诉系统
- 买家在 TRANSFERRING 状态未收到货可申诉
- 买家在退款被拒后可申请平台介入
- 订单进入 DISPUTE 状态，等待管理员仲裁

### 核心实体
- **User**: 用户（role: BUYER/SELLER/ADMIN）
- **Order**: 订单（状态流转核心）
- **Payment**: 支付记录（ESCROW托管/RELEASE释放/REFUND退款）
- **Dispute**: 申诉记录
- **Withdrawal**: 提现记录
- **AuditLog**: 审计日志

## Important Constraints

### 安全要求
- JWT密钥必须使用256位强随机密钥（禁止默认密钥）
- 所有密码使用 bcryptjs 加密存储（10轮salt）
- 所有订单操作使用乐观锁防止并发竞态
- 关键操作必须记录审计日志（待实施）
- 管理员页面必须有服务端认证检查（待实施）

### 数据完整性
- 所有资金操作必须在事务内完成
- 订单状态变更必须原子性（状态+版本号同步更新）
- 数据库索引已优化（27个索引）

### 性能要求
- 订单列表需要分页（待实施）
- 数据库查询使用索引（已完成）
- 前端使用 React 优化（React.memo, useCallback - 待实施）

## External Dependencies

### 生产依赖
- **数据库**: PostgreSQL（必需）
- **支付接口**: 支付宝/微信支付（待集成）
- **文件存储**: 本地存储或OSS（待实施）

### 开发依赖
- **Node.js**: >= 18
- **pnpm**: 包管理器
- **Docker**: 生产部署
- **OpenSSL**: 生成JWT密钥（`openssl rand -hex 32`）

### 环境变量
```env
DATABASE_URL="postgresql://..."  # PostgreSQL连接串（必需）
JWT_SECRET="..."                 # 256位密钥（必需）
PLATFORM_FEE_RATE=0.03          # 平台手续费率
```
