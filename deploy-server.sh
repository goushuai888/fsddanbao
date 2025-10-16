#!/bin/bash

# FSD担保交易平台 - 服务器端一键部署脚本
# 使用远程Docker镜像部署

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_step() {
    echo -e "${BLUE}==>${NC} $1"
}

# 检查Docker是否安装
check_docker() {
    print_step "检查Docker环境..."
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装，请先安装Docker"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi

    print_info "Docker环境检查通过"
}

# 创建 docker-compose.yml
create_docker_compose() {
    print_step "创建 docker-compose.yml 文件..."

    cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:16-alpine
    container_name: fsd-escrow-db
    restart: always
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-fsd_user}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-fsd_password}
      POSTGRES_DB: ${POSTGRES_DB:-fsd_escrow}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-fsd_user}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - fsd-network

  # Next.js 应用 - 使用远程镜像
  app:
    image: ghcr.io/goushuai888/fsddanbao:latest
    container_name: fsd-escrow-app
    restart: always
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://${POSTGRES_USER:-fsd_user}:${POSTGRES_PASSWORD:-fsd_password}@postgres:5432/${POSTGRES_DB:-fsd_escrow}?schema=public
      JWT_SECRET: ${JWT_SECRET:-your-super-secret-jwt-key-change-this-in-production}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET:-your-nextauth-secret-key-change-this}
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3005}
    ports:
      - "${APP_PORT:-3005}:3000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - fsd-network
    command: sh -c "npx prisma migrate deploy && node server.js"

volumes:
  postgres_data:
    driver: local

networks:
  fsd-network:
    driver: bridge
EOF

    print_info "docker-compose.yml 创建成功"
}

# 创建环境变量文件
create_env_file() {
    print_step "创建环境变量文件..."

    if [ -f ".env.production" ]; then
        print_warn ".env.production 文件已存在，跳过创建"
        return
    fi

    cat > .env.production << 'EOF'
# PostgreSQL 数据库配置
POSTGRES_USER=fsd_user
POSTGRES_PASSWORD=AnMhtZ1z+Y03GJ+tV/W2NvzC1J8nvOD+
POSTGRES_DB=fsd_escrow
POSTGRES_PORT=5432

# Node 环境
NODE_ENV=production

# 应用端口
APP_PORT=3005

# 数据库连接URL（Docker内部使用postgres作为host）
DATABASE_URL=postgresql://fsd_user:AnMhtZ1z+Y03GJ+tV/W2NvzC1J8nvOD+@postgres:5432/fsd_escrow?schema=public

# JWT 密钥（已生成安全随机密钥）
JWT_SECRET=9KxxwN0BA5xDxZ75EgIe744MfsxFf4A69vrYm5DDW+o=

# NextAuth 配置（已生成安全随机密钥）
NEXTAUTH_SECRET=hwYQ8Ec9lo5Ga3K8ydrxV/yui3sFJhkIN6SedFiRSXs=
NEXTAUTH_URL=http://localhost:3005

# 支付配置（如需使用请填写）
ALIPAY_APP_ID=
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=

WECHAT_APP_ID=
WECHAT_APP_SECRET=
WECHAT_MCH_ID=
WECHAT_API_KEY=

# 文件上传配置
UPLOAD_DIR=./public/uploads
MAX_FILE_SIZE=5242880

# 平台配置
PLATFORM_FEE_RATE=0.03
EOF

    print_info ".env.production 创建成功"
    print_warn "⚠️  重要：请根据实际情况修改以下配置："
    echo "   - POSTGRES_PASSWORD: 数据库密码"
    echo "   - JWT_SECRET: JWT密钥"
    echo "   - NEXTAUTH_SECRET: NextAuth密钥"
    echo "   - NEXTAUTH_URL: 如有域名请修改"
}

# 拉取最新镜像
pull_image() {
    print_step "拉取最新Docker镜像..."
    docker pull ghcr.io/goushuai888/fsddanbao:latest
    print_info "镜像拉取成功"
}

# 启动服务
start_services() {
    print_step "启动服务..."

    # 检查是否使用 docker compose 或 docker-compose
    if docker compose version &> /dev/null; then
        docker compose --env-file .env.production up -d
    else
        docker-compose --env-file .env.production up -d
    fi

    print_info "等待服务启动..."
    sleep 5

    print_step "服务状态："
    if docker compose version &> /dev/null; then
        docker compose ps
    else
        docker-compose ps
    fi
}

# 显示部署信息
show_deploy_info() {
    echo ""
    echo -e "${GREEN}========================================${NC}"
    echo -e "${GREEN}   ✅ 部署成功！${NC}"
    echo -e "${GREEN}========================================${NC}"
    echo ""
    echo -e "${BLUE}应用信息：${NC}"
    echo "  📍 应用地址: http://localhost:3005"
    echo "  📍 数据库端口: 5432"
    echo ""
    echo -e "${BLUE}常用命令：${NC}"
    echo "  查看日志: docker-compose logs -f"
    echo "  停止服务: docker-compose stop"
    echo "  重启服务: docker-compose restart"
    echo "  查看状态: docker-compose ps"
    echo ""
    echo -e "${BLUE}下一步操作：${NC}"
    echo "  1. 访问 http://localhost:3005 查看应用"
    echo "  2. 创建管理员账户：docker-compose exec app npx tsx scripts/create-admin.ts"
    echo ""
    echo -e "${YELLOW}注意事项：${NC}"
    echo "  🔒 请妥善保管 .env.production 文件中的密钥"
    echo "  🌐 如有域名，请修改 NEXTAUTH_URL 配置"
    echo "  🔄 定期备份数据库：docker-compose exec postgres pg_dump -U fsd_user fsd_escrow > backup.sql"
    echo ""
}

# 主函数
main() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "  FSD担保交易平台 - 一键部署脚本"
    echo "=========================================="
    echo -e "${NC}"

    check_docker
    create_docker_compose
    create_env_file
    pull_image
    start_services
    show_deploy_info
}

# 执行主函数
main
