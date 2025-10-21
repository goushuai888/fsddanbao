# Docker 部署指南

FSD担保交易平台的Docker部署完整指南。

## 📋 目录

- [前置要求](#前置要求)
- [快速开始](#快速开始)
- [环境配置](#环境配置)
- [部署方式](#部署方式)
- [数据库管理](#数据库管理)
- [常见问题](#常见问题)
- [监控和日志](#监控和日志)

## 🔧 前置要求

- Docker Engine 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 10GB 可用磁盘空间

安装 Docker：
```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# macOS
brew install --cask docker

# 验证安装
docker --version
docker-compose --version
```

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd fsddanbao
```

### 2. 配置环境变量

创建 `.env` 文件：

```bash
cp .env.example .env
```

**必须修改的环境变量**：

```env
# JWT密钥 (必须256位强随机密钥)
JWT_SECRET=生成强随机密钥（使用下面的命令）

# 数据库密码
POSTGRES_PASSWORD=你的数据库密码

# SMTP邮箱配置 (用于验证码)
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@qq.com
SMTP_PASS=你的授权码

# 七牛云存储配置 (用于图片上传)
QINIU_ACCESS_KEY=你的AccessKey
QINIU_SECRET_KEY=你的SecretKey
QINIU_BUCKET=fsddanbao
QINIU_ZONE=Zone_as0
QINIU_DOMAIN=https://fsddanbao.s3.ap-southeast-1.qiniucs.com
```

**生成安全密钥**：

```bash
# 生成JWT密钥
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 或使用OpenSSL
openssl rand -hex 32
```

### 3. 启动服务

**开发环境** (本地构建):

```bash
docker-compose up -d
```

**生产环境** (使用远程镜像):

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 4. 初始化数据库

首次部署需要运行数据库迁移：

```bash
# 查看应用日志，确认迁移自动执行
docker-compose logs -f app

# 或手动执行迁移
docker-compose exec app npx prisma migrate deploy
```

### 5. 创建管理员账户

```bash
docker-compose exec app npx ts-node scripts/create-admin.ts
```

按提示输入：
- 管理员邮箱
- 密码
- 姓名
- 手机号

### 6. 访问应用

- 应用地址: http://localhost:3005
- 管理后台: http://localhost:3005/admin
- 数据库端口: 5432

## ⚙️ 环境配置

### 完整环境变量列表

```env
# ============================================
# 核心配置 (必须设置)
# ============================================

# 应用端口
APP_PORT=3005

# JWT密钥 (256位强随机密钥)
JWT_SECRET=your-256-bit-secret-key

# 数据库配置
POSTGRES_USER=fsd_user
POSTGRES_PASSWORD=your-database-password
POSTGRES_DB=fsd_escrow
POSTGRES_PORT=5432

# ============================================
# 邮箱验证配置 (必须设置)
# ============================================

# SMTP配置
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@qq.com
SMTP_PASS=your-authorization-code
SMTP_FROM_NAME=FSD担保交易平台

# 大额支付阈值
LARGE_PAYMENT_THRESHOLD=10000

# ============================================
# 七牛云存储配置 (必须设置)
# ============================================

QINIU_ACCESS_KEY=your-access-key
QINIU_SECRET_KEY=your-secret-key
QINIU_BUCKET=fsddanbao
QINIU_ZONE=Zone_as0
QINIU_DOMAIN=https://your-domain.com

# ============================================
# 可选配置
# ============================================

# 平台手续费率 (默认3%)
PLATFORM_FEE_RATE=0.03

# Next.js配置
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=http://localhost:3005
```

### 环境变量说明

| 变量名 | 必需 | 默认值 | 说明 |
|--------|------|--------|------|
| `JWT_SECRET` | ✅ | - | JWT签名密钥，必须256位 |
| `POSTGRES_PASSWORD` | ✅ | - | 数据库密码 |
| `SMTP_USER` | ✅ | - | SMTP发件邮箱 |
| `SMTP_PASS` | ✅ | - | SMTP授权码 |
| `QINIU_ACCESS_KEY` | ✅ | - | 七牛云AccessKey |
| `QINIU_SECRET_KEY` | ✅ | - | 七牛云SecretKey |
| `APP_PORT` | ❌ | 3005 | 应用端口 |
| `PLATFORM_FEE_RATE` | ❌ | 0.03 | 平台手续费率 |

## 📦 部署方式

### 方式一：本地构建部署

适用于开发环境或需要修改代码的场景。

```bash
# 1. 构建镜像
docker-compose build

# 2. 启动服务
docker-compose up -d

# 3. 查看日志
docker-compose logs -f
```

### 方式二：使用远程镜像部署

适用于生产环境，无需本地构建。

```bash
# 1. 拉取最新镜像
docker-compose -f docker-compose.prod.yml pull

# 2. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 3. 查看状态
docker-compose -f docker-compose.prod.yml ps
```

### 方式三：自动化部署脚本

创建 `deploy.sh`:

```bash
#!/bin/bash
set -e

echo "📦 拉取最新代码..."
git pull origin main

echo "🔧 配置环境变量..."
if [ ! -f .env ]; then
  echo "❌ 错误: .env 文件不存在，请先创建"
  exit 1
fi

echo "🚀 重新构建并启动服务..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "📊 运行数据库迁移..."
docker-compose exec -T app npx prisma migrate deploy

echo "✅ 部署完成！"
docker-compose ps
```

使用方法：

```bash
chmod +x deploy.sh
./deploy.sh
```

## 🗄️ 数据库管理

### 备份数据库

```bash
# 自动备份脚本
docker-compose exec postgres pg_dump \
  -U fsd_user \
  -d fsd_escrow \
  --clean \
  --if-exists \
  > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 恢复数据库

```bash
# 从备份文件恢复
cat backup_20251021_143000.sql | \
  docker-compose exec -T postgres psql \
  -U fsd_user \
  -d fsd_escrow
```

### 查看数据库

```bash
# 连接到PostgreSQL
docker-compose exec postgres psql -U fsd_user -d fsd_escrow

# 或使用Prisma Studio
docker-compose exec app npx prisma studio
# 访问 http://localhost:5555
```

### 数据库迁移

```bash
# 查看迁移状态
docker-compose exec app npx prisma migrate status

# 应用迁移
docker-compose exec app npx prisma migrate deploy

# 创建新迁移
docker-compose exec app npx prisma migrate dev --name your-migration-name
```

## 🐛 常见问题

### 1. 构建失败：找不到 JWT_SECRET

**错误信息**: `FATAL: JWT_SECRET must be set`

**解决方案**:

```bash
# 确保 .env 文件存在且包含 JWT_SECRET
grep JWT_SECRET .env

# 如果没有，生成一个
echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env
```

### 2. 数据库连接失败

**错误信息**: `Error: P1001: Can't reach database server`

**解决方案**:

```bash
# 1. 检查数据库是否健康
docker-compose ps postgres

# 2. 查看数据库日志
docker-compose logs postgres

# 3. 手动测试连接
docker-compose exec postgres pg_isready -U fsd_user
```

### 3. 端口已被占用

**错误信息**: `Error: bind: address already in use`

**解决方案**:

```bash
# 方式1: 更改端口
echo "APP_PORT=3006" >> .env
docker-compose up -d

# 方式2: 停止占用端口的进程
lsof -ti:3005 | xargs kill -9
```

### 4. Prisma Client 版本不匹配

**错误信息**: `The Prisma Client version mismatch`

**解决方案**:

```bash
# 重新生成 Prisma Client
docker-compose exec app npx prisma generate

# 如果还不行，重新构建镜像
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### 5. 邮件发送失败

**错误信息**: `SMTP配置不完整`

**解决方案**:

```bash
# 1. 确认SMTP配置正确
grep SMTP .env

# 2. 测试SMTP连接
docker-compose exec app node -e "
require('./src/lib/infrastructure/email/nodemailer').getTransporter()
  .verify()
  .then(() => console.log('✅ SMTP连接成功'))
  .catch(err => console.error('❌ SMTP连接失败:', err.message))
"
```

## 📊 监控和日志

### 查看日志

```bash
# 所有服务日志
docker-compose logs -f

# 仅应用日志
docker-compose logs -f app

# 仅数据库日志
docker-compose logs -f postgres

# 最近100行日志
docker-compose logs --tail=100 app
```

### 健康检查

```bash
# 检查所有服务状态
docker-compose ps

# 检查应用健康
curl http://localhost:3005/api/auth/me

# 检查数据库健康
docker-compose exec postgres pg_isready
```

### 资源使用

```bash
# 查看容器资源使用
docker stats

# 查看磁盘使用
docker system df

# 清理未使用的资源
docker system prune -a
```

## 🔄 更新和维护

### 更新应用

```bash
# 1. 停止服务
docker-compose down

# 2. 拉取最新代码
git pull

# 3. 重新构建
docker-compose build

# 4. 启动服务
docker-compose up -d

# 5. 运行迁移
docker-compose exec app npx prisma migrate deploy
```

### 滚动更新（零停机）

```bash
# 1. 构建新镜像
docker-compose build app

# 2. 创建新容器
docker-compose up -d --no-deps --build app

# 3. 等待新容器健康
sleep 10
curl http://localhost:3005/api/auth/me
```

## 🔒 安全建议

1. **使用强随机密钥**
   ```bash
   # 所有密钥都应该是强随机的
   JWT_SECRET=$(openssl rand -hex 32)
   POSTGRES_PASSWORD=$(openssl rand -hex 16)
   ```

2. **限制数据库访问**
   ```yaml
   # docker-compose.yml
   postgres:
     ports:
       - "127.0.0.1:5432:5432"  # 只监听localhost
   ```

3. **使用环境文件权限**
   ```bash
   chmod 600 .env
   ```

4. **定期备份数据库**
   ```bash
   # 添加到 cron
   0 2 * * * /path/to/backup-script.sh
   ```

5. **启用防火墙**
   ```bash
   # 只允许必要端口
   ufw allow 3005/tcp
   ufw allow 22/tcp
   ufw enable
   ```

## 📞 技术支持

如有问题，请查看：

- 项目文档: `docs/` 目录
- 问题追踪: GitHub Issues
- 邮件验证文档: `docs/EMAIL_VERIFICATION_GUIDE.md`
- 七牛云集成: `QINIU_INTEGRATION.md`

## 🎉 完成！

现在你可以访问：

- **应用**: http://localhost:3005
- **管理后台**: http://localhost:3005/admin
- **API文档**: 查看 `API.md`

祝你使用愉快！🚀
