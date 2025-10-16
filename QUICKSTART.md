# FSD担保交易平台 - 快速开始指南

## 1. 环境准备

### 必备软件
- Node.js 18+
- PostgreSQL 14+
- npm 或 yarn

### 安装依赖

```bash
# 克隆项目后进入目录
cd fsddanbao

# 安装依赖包
npm install

# 或使用 yarn
yarn install
```

## 2. 数据库配置

### 创建数据库

```sql
-- 在PostgreSQL中创建数据库
CREATE DATABASE fsd_escrow;

-- 创建用户(可选)
CREATE USER fsd_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE fsd_escrow TO fsd_user;
```

### 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env.local

# 编辑 .env.local 文件，填入数据库连接信息
DATABASE_URL="postgresql://用户名:密码@localhost:5432/fsd_escrow?schema=public"
```

### 初始化数据库

```bash
# 生成Prisma Client
npm run db:generate

# 推送数据库schema
npm run db:push

# 或者使用migration
npm run db:migrate
```

## 3. 启动开发服务器

```bash
# 启动开发服务器
npm run dev

# 服务器将在 http://localhost:3000 启动
```

## 4. 访问应用

打开浏览器访问:
- 首页: http://localhost:3000
- 登录: http://localhost:3000/login
- 注册: http://localhost:3000/register

## 5. 项目结构

```
fsddanbao/
├── prisma/
│   └── schema.prisma          # 数据库模型定义
├── src/
│   ├── app/                   # Next.js App Router
│   │   ├── api/              # API路由
│   │   │   ├── auth/         # 认证相关API
│   │   │   └── orders/       # 订单相关API
│   │   ├── login/            # 登录页面
│   │   ├── register/         # 注册页面
│   │   ├── layout.tsx        # 全局布局
│   │   ├── page.tsx          # 首页
│   │   └── globals.css       # 全局样式
│   ├── components/
│   │   └── ui/               # UI组件
│   ├── lib/
│   │   ├── prisma.ts         # Prisma客户端
│   │   ├── auth.ts           # 认证工具函数
│   │   └── utils.ts          # 通用工具函数
│   └── types/
│       └── index.ts          # TypeScript类型定义
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── README.md
```

## 6. 核心功能说明

### 用户认证
- **注册**: `/api/auth/register`
- **登录**: `/api/auth/login`

### 订单管理
- **创建订单**: `POST /api/orders`
- **获取订单列表**: `GET /api/orders`
- **获取订单详情**: `GET /api/orders/[id]`
- **更新订单**: `PATCH /api/orders/[id]`

### 订单状态流转

```
PUBLISHED (已发布)
    ↓ 买家支付
PAID (已支付)
    ↓ 卖家转移
TRANSFERRING (转移中)
    ↓ 买家确认
COMPLETED (已完成)
```

## 7. 数据库管理

```bash
# 查看数据库
npm run db:studio

# 这将打开 Prisma Studio (http://localhost:5555)
# 可以直接在浏览器中查看和编辑数据
```

## 8. 常见问题

### Q: 数据库连接失败
A: 检查PostgreSQL是否启动，确认.env.local中的DATABASE_URL配置正确

### Q: 端口被占用
A: 修改端口，运行 `PORT=3001 npm run dev`

### Q: Prisma Client报错
A: 重新生成客户端 `npm run db:generate`

## 9. 生产部署

### 构建项目

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### 环境变量(生产环境)

生产环境需要配置:
```
DATABASE_URL=your_production_db_url
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret
```

### 部署平台推荐
- **Vercel** (推荐用于Next.js项目)
- **Railway** (支持PostgreSQL)
- **Render**
- **自建服务器**

## 10. 下一步开发

还需要完善的功能:
- [ ] 支付接口集成
- [ ] 文件上传功能
- [ ] 订单列表页面
- [ ] 订单详情页面
- [ ] 用户中心
- [ ] 实名认证
- [ ] 评价系统
- [ ] 申诉处理
- [ ] 管理后台
- [ ] 邮件通知
- [ ] 短信验证

## 11. 技术支持

遇到问题请检查:
1. Node.js版本是否正确
2. PostgreSQL是否正常运行
3. 环境变量是否正确配置
4. 依赖是否完整安装
