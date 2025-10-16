# FSD担保交易平台

## 项目简介
专门用于FSD自动驾驶权限转移的担保交易平台，确保买卖双方交易安全。

## 技术栈
- **前端**: Next.js 14 + React 18 + TypeScript + Tailwind CSS
- **数据库**: PostgreSQL + Prisma ORM
- **认证**: NextAuth.js
- **UI组件**: Radix UI + Tailwind CSS
- **支付**: 支付宝/微信支付集成

## 主要功能

### 用户端
- 注册/登录 (邮箱/手机号)
- 实名认证
- 发布FSD转让信息
- 购买FSD权限
- 查看订单状态
- 评价系统
- 申诉处理

### 管理端
- 用户管理
- 订单管理
- 申诉处理
- 平台设置
- 数据统计

## 核心交易流程

1. **发布转让**
   - 卖家填写车辆信息、FSD版本、价格等
   - 平台审核信息真实性

2. **买家下单**
   - 买家选择FSD产品并付款到平台托管
   - 平台确认收款

3. **权限转移**
   - 卖家在Tesla App中发起FSD权限转移
   - 提交转移凭证

4. **买家确认**
   - 买家确认收到FSD权限
   - 平台释放款项给卖家

5. **完成交易**
   - 双方互评
   - 订单完成

## 安全保障

- **资金托管**: 买家付款先到平台，确认收货后释放给卖家
- **实名认证**: 所有用户必须完成实名认证
- **转移验证**: 要求提供Tesla官方转移凭证
- **申诉机制**: 纠纷可提交平台仲裁
- **评价体系**: 建立用户信用体系

## 安装部署

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env.local

# 初始化数据库
npm run db:migrate

# 启动开发服务器
npm run dev
```

## 环境变量配置

参考 `.env.example` 文件配置数据库连接、支付接口等。

## 数据库设计

详细的数据表设计见 `prisma/schema.prisma`

## 项目结构

```
src/
├── app/                # Next.js App Router
├── components/         # React组件
├── lib/               # 工具函数和配置
├── api/               # API路由
├── types/             # TypeScript类型定义
└── hooks/             # 自定义React Hooks
```
