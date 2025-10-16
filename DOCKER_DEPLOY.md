# FSD担保交易平台 - Docker部署指南

本文档说明如何使用Docker容器化部署FSD担保交易平台。

## 📋 前置要求

- Docker 20.10+
- Docker Compose 2.0+
- 至少 2GB 可用内存
- 至少 10GB 可用磁盘空间

## 🚀 快速开始

### 1. 克隆项目（如果还没有）

```bash
git clone https://github.com/goushuai888/fsddanbao.git
cd fsddanbao
```

### 2. 配置环境变量

复制环境变量模板并修改：

```bash
cp .env.production.example .env.production
```

编辑 `.env.production` 文件，**务必修改以下关键配置**：

```env
# 修改数据库密码
POSTGRES_PASSWORD=your_strong_password_here

# 修改JWT密钥（使用随机字符串）
JWT_SECRET=your_random_jwt_secret_key

# 修改NextAuth密钥（使用随机字符串）
NEXTAUTH_SECRET=your_random_nextauth_secret

# 如果有域名，修改URL
NEXTAUTH_URL=https://your-domain.com
```

**生成随机密钥的方法：**
```bash
# 生成JWT密钥
openssl rand -base64 32

# 生成NextAuth密钥
openssl rand -base64 32
```

### 3. 构建并启动服务

```bash
# 构建镜像并启动所有服务
docker-compose up -d --build
```

### 4. 查看服务状态

```bash
# 查看运行中的容器
docker-compose ps

# 查看应用日志
docker-compose logs -f app

# 查看数据库日志
docker-compose logs -f postgres
```

### 5. 访问应用

打开浏览器访问：
- 应用地址：http://localhost:3000
- 如果修改了端口，使用配置的端口

### 6. 创建管理员账户

进入应用容器：
```bash
docker-compose exec app sh
```

运行创建管理员脚本（如果有）：
```bash
npx tsx scripts/create-admin.ts
```

退出容器：
```bash
exit
```

## 🔧 常用命令

### 启动服务
```bash
docker-compose up -d
```

### 停止服务
```bash
docker-compose stop
```

### 重启服务
```bash
docker-compose restart
```

### 停止并删除容器
```bash
docker-compose down
```

### 停止并删除容器和数据卷（⚠️ 会删除数据库数据）
```bash
docker-compose down -v
```

### 重新构建镜像
```bash
docker-compose build --no-cache
docker-compose up -d
```

### 查看日志
```bash
# 查看所有服务日志
docker-compose logs -f

# 只查看应用日志
docker-compose logs -f app

# 只查看数据库日志
docker-compose logs -f postgres

# 查看最近100行日志
docker-compose logs --tail=100 app
```

### 进入容器
```bash
# 进入应用容器
docker-compose exec app sh

# 进入数据库容器
docker-compose exec postgres psql -U fsd_user -d fsd_escrow
```

## 🗄️ 数据库管理

### 运行数据库迁移
```bash
docker-compose exec app npx prisma migrate deploy
```

### 数据库备份
```bash
# 备份数据库到本地
docker-compose exec postgres pg_dump -U fsd_user fsd_escrow > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 数据库恢复
```bash
# 从备份文件恢复
docker-compose exec -T postgres psql -U fsd_user fsd_escrow < backup_file.sql
```

### 访问数据库
```bash
# 使用psql连接
docker-compose exec postgres psql -U fsd_user -d fsd_escrow

# 或者从宿主机连接
psql -h localhost -p 5432 -U fsd_user -d fsd_escrow
```

## 🔐 安全建议

1. **修改默认密码**：生产环境务必修改所有默认密码
2. **使用强密钥**：JWT_SECRET和NEXTAUTH_SECRET使用足够长的随机字符串
3. **HTTPS配置**：生产环境使用nginx反向代理配置HTTPS
4. **防火墙设置**：只开放必要的端口（如80、443）
5. **定期备份**：建立自动化数据库备份机制
6. **更新镜像**：定期更新基础镜像和依赖包

## 🌐 生产环境部署（使用Nginx）

### 1. 创建nginx配置

```nginx
# /etc/nginx/sites-available/fsddanbao
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. 配置HTTPS（使用Let's Encrypt）

```bash
# 安装certbot
sudo apt install certbot python3-certbot-nginx

# 获取SSL证书
sudo certbot --nginx -d your-domain.com

# 自动续期
sudo certbot renew --dry-run
```

## 📊 监控和日志

### 查看资源使用
```bash
docker stats
```

### 导出日志
```bash
docker-compose logs --since 24h > logs_$(date +%Y%m%d).log
```

## 🐛 故障排查

### 应用无法启动
```bash
# 检查日志
docker-compose logs app

# 检查环境变量
docker-compose exec app env | grep DATABASE_URL
```

### 数据库连接失败
```bash
# 检查数据库状态
docker-compose ps postgres

# 测试数据库连接
docker-compose exec postgres pg_isready -U fsd_user
```

### 端口占用
```bash
# 查看端口占用
lsof -i :3000
lsof -i :5432

# 修改docker-compose.yml中的端口映射
```

## 📝 更新应用

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建并启动
docker-compose up -d --build

# 3. 运行数据库迁移（如有）
docker-compose exec app npx prisma migrate deploy
```

## 🆘 获取帮助

如果遇到问题，请：
1. 查看日志：`docker-compose logs -f`
2. 检查GitHub Issues：https://github.com/goushuai888/fsddanbao/issues
3. 提交新Issue并附上日志信息
