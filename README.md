# FSD担保交易平台

一个基于 Next.js 14 的 Tesla FSD（完全自动驾驶）权限转让担保交易平台。

## 项目简介

本平台为 Tesla FSD 权限买卖双方提供安全的担保交易服务，确保交易过程透明、公正、安全。

## 核心功能

### 1. 用户系统
- 用户注册与登录（JWT认证）
- 用户角色管理（买家/卖家/管理员）
- 用户实名认证状态

### 2. 订单管理
- **发布订单**：卖家发布FSD权限转让信息
- **市场浏览**：无需登录即可浏览公开订单
- **订单状态流转**：
  - `PUBLISHED` - 已发布，等待买家下单
  - `PAID` - 已支付，款项托管中
  - `TRANSFERRING` - 转移中，卖家已发起权限转移
  - `COMPLETED` - 已完成
  - `CANCELLED` - 已取消
  - `DISPUTE` - 申诉中

### 3. 支付与托管
- 买家付款到平台托管账户
- 交易完成后自动释放款项给卖家
- 取消订单自动退款给买家
- 平台手续费自动计算（默认3%）

### 4. 退款系统
- **买家申请退款**：在PAID状态可申请退款
- **卖家处理退款**：可同意或拒绝退款申请
- **自动退款**：卖家同意后自动将款项退还买家
- 完整的退款流程记录

### 5. 申诉系统
- **买家保护**：在TRANSFERRING状态可申诉未收到货
- **平台仲裁**：申诉后订单进入DISPUTE状态，由管理员介入处理
- **详细记录**：完整记录申诉原因、描述和处理状态

### 6. 订单时间线
- 记录所有关键操作时间点
- 显示退款申请和处理详情
- 展示申诉信息和状态
- 时间精确到秒

### 7. 权限控制
- **订单查看权限**：
  - 卖家可查看所有自己的订单
  - 买家只能查看参与过的订单
  - PUBLISHED状态对所有登录用户可见

- **订单操作权限**：
  - PUBLISHED状态：卖家和买家均可取消
  - PAID状态：卖家可直接取消（自动退款），买家需申请退款
  - TRANSFERRING状态：买家可确认收货或申诉

### 8. 管理员功能
- 用户管理
- 订单审核
- 申诉处理（开发中）

## 技术栈

- **前端框架**：Next.js 14 (App Router)
- **UI组件**：shadcn/ui + Tailwind CSS
- **开发语言**：TypeScript
- **数据库**：PostgreSQL
- **ORM**：Prisma
- **身份认证**：JWT

## 项目结构

```
fsddanbao/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API路由
│   │   │   ├── auth/          # 认证相关API
│   │   │   ├── orders/        # 订单相关API
│   │   │   └── admin/         # 管理员API
│   │   ├── login/             # 登录页面
│   │   ├── register/          # 注册页面
│   │   ├── orders/            # 订单页面
│   │   └── admin/             # 管理后台
│   ├── components/            # React组件
│   │   └── ui/               # UI组件库
│   ├── lib/                   # 工具函数
│   │   ├── prisma.ts         # Prisma客户端
│   │   ├── auth.ts           # 认证工具
│   │   └── utils.ts          # 通用工具
│   └── types/                 # TypeScript类型定义
├── prisma/
│   └── schema.prisma          # 数据库模型定义
└── public/                    # 静态资源
```

## 数据库设计

### 核心表
- `User` - 用户表
- `Order` - 订单表
- `Payment` - 支付记录表
- `Dispute` - 申诉表
- `Review` - 评价表

### 关键字段说明

#### Order（订单表）
```prisma
model Order {
  id              String      @id @default(cuid())
  orderNo         String      @unique
  status          OrderStatus @default(PUBLISHED)

  // 退款相关
  refundRequested Boolean     @default(false)
  refundReason    String?
  refundRequestedAt DateTime?
  refundStatus    RefundStatus?

  // 时间戳
  createdAt       DateTime    @default(now())
  paidAt          DateTime?
  transferredAt   DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
}
```

## 部署方式

### 方式一：Docker部署（推荐）🐳

**优点：**
- 一键部署，无需配置环境
- 自动包含PostgreSQL数据库
- 生产环境就绪
- 易于维护和更新

**快速开始：**

```bash
# 1. 配置环境变量
cp .env.production.example .env.production
# 编辑 .env.production，修改数据库密码和密钥

# 2. 一键启动（使用便捷脚本）
./deploy.sh start

# 或使用docker-compose
docker-compose up -d --build
```

**详细文档：** 查看 [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md)

**常用命令：**
```bash
./deploy.sh start     # 启动服务
./deploy.sh stop      # 停止服务
./deploy.sh logs      # 查看日志
./deploy.sh status    # 查看状态
./deploy.sh backup    # 备份数据库
```

访问 http://localhost:3005

---

### 方式二：本地开发部署

## 环境配置

1. 复制环境变量模板：
```bash
cp .env.example .env
```

2. 配置数据库连接：
```
DATABASE_URL="postgresql://user:password@localhost:5432/fsddanbao"
JWT_SECRET="your-secret-key"
```

## 安装运行

```bash
# 安装依赖
pnpm install

# 初始化数据库
pnpm prisma generate
pnpm prisma db push

# 创建管理员账号（可选）
npx tsx scripts/create-admin.ts

# 启动开发服务器
pnpm dev
```

访问 http://localhost:3005

## 订单流程图

```
[卖家发布订单] → PUBLISHED
     ↓
[买家下单支付] → PAID
     ↓
[卖家提交转移凭证] → TRANSFERRING
     ↓
[买家确认收货] → COMPLETED

// 退款流程
PAID → [买家申请退款] → [卖家同意] → CANCELLED

// 申诉流程
TRANSFERRING → [买家申诉未收到货] → DISPUTE → [平台处理]

// 取消流程
PUBLISHED → [任一方取消] → CANCELLED
PAID → [卖家取消（自动退款）] → CANCELLED
```

## 安全特性

- JWT Token 认证
- 密码加密存储
- 敏感信息脱敏显示（手机号、车架号）
- 订单权限严格控制
- SQL注入防护（Prisma ORM）
- CSRF保护

## 开发计划

- [x] 用户认证系统
- [x] 订单管理功能
- [x] 退款申请系统
- [x] 申诉系统
- [x] 订单时间线
- [ ] 管理员申诉处理界面
- [ ] 邮件通知系统
- [ ] 评价系统
- [ ] 用户信用评分
- [ ] 订单搜索和筛选
- [ ] 支付接口集成

## 贡献指南

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue 或联系项目维护者。

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
