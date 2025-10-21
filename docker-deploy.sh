#!/bin/bash
#
# FSD担保交易平台 - Docker 快速部署脚本
#
# 使用方法:
#   chmod +x docker-deploy.sh
#   ./docker-deploy.sh [dev|prod]
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 帮助信息
function show_help() {
  echo "用法: $0 [dev|prod]"
  echo ""
  echo "参数:"
  echo "  dev   - 开发环境部署（本地构建）"
  echo "  prod  - 生产环境部署（使用远程镜像）"
  echo ""
  echo "示例:"
  echo "  $0 dev   # 开发环境部署"
  echo "  $0 prod  # 生产环境部署"
}

# 错误处理
function error() {
  echo -e "${RED}❌ 错误: $1${NC}"
  exit 1
}

# 成功信息
function success() {
  echo -e "${GREEN}✅ $1${NC}"
}

# 警告信息
function warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# 检查环境
function check_environment() {
  echo "🔧 检查运行环境..."

  # 检查 Docker
  if ! command -v docker &> /dev/null; then
    error "Docker 未安装，请先安装 Docker"
  fi
  success "Docker 已安装"

  # 检查 Docker Compose
  if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose 未安装，请先安装 Docker Compose"
  fi
  success "Docker Compose 已安装"

  # 检查 .env 文件
  if [ ! -f .env ]; then
    warning ".env 文件不存在，正在从 .env.example 复制..."
    cp .env.example .env
    error "请先编辑 .env 文件，配置必要的环境变量，然后重新运行此脚本"
  fi
  success ".env 文件存在"

  # 检查必要的环境变量
  source .env

  if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" == "your-jwt-secret-key-change-this" ]; then
    error "请在 .env 文件中配置 JWT_SECRET (使用强随机密钥)"
  fi

  if [ -z "$POSTGRES_PASSWORD" ] || [ "$POSTGRES_PASSWORD" == "your-database-password" ]; then
    error "请在 .env 文件中配置 POSTGRES_PASSWORD"
  fi

  success "环境变量检查通过"
}

# 开发环境部署
function deploy_dev() {
  echo ""
  echo "🚀 开始开发环境部署..."
  echo ""

  # 停止现有服务
  echo "📦 停止现有服务..."
  docker-compose down || true

  # 构建镜像
  echo "🔨 构建 Docker 镜像..."
  docker-compose build

  # 启动服务
  echo "▶️  启动服务..."
  docker-compose up -d

  # 等待服务启动
  echo "⏳ 等待服务启动..."
  sleep 10

  # 检查服务状态
  echo "📊 检查服务状态..."
  docker-compose ps

  echo ""
  success "开发环境部署完成！"
  echo ""
  echo "访问地址:"
  echo "  应用: http://localhost:${APP_PORT:-3005}"
  echo "  管理后台: http://localhost:${APP_PORT:-3005}/admin"
  echo ""
  echo "查看日志:"
  echo "  docker-compose logs -f"
  echo ""
}

# 生产环境部署
function deploy_prod() {
  echo ""
  echo "🚀 开始生产环境部署..."
  echo ""

  # 停止现有服务
  echo "📦 停止现有服务..."
  docker-compose -f docker-compose.prod.yml down || true

  # 拉取最新镜像
  echo "📥 拉取最新镜像..."
  docker-compose -f docker-compose.prod.yml pull

  # 启动服务
  echo "▶️  启动服务..."
  docker-compose -f docker-compose.prod.yml up -d

  # 等待服务启动
  echo "⏳ 等待服务启动..."
  sleep 10

  # 检查服务状态
  echo "📊 检查服务状态..."
  docker-compose -f docker-compose.prod.yml ps

  echo ""
  success "生产环境部署完成！"
  echo ""
  echo "访问地址:"
  echo "  应用: http://localhost:${APP_PORT:-3005}"
  echo "  管理后台: http://localhost:${APP_PORT:-3005}/admin"
  echo ""
  echo "查看日志:"
  echo "  docker-compose -f docker-compose.prod.yml logs -f"
  echo ""
}

# 主程序
function main() {
  echo "═══════════════════════════════════════════"
  echo "  FSD担保交易平台 - Docker 部署工具"
  echo "═══════════════════════════════════════════"
  echo ""

  # 检查参数
  if [ $# -eq 0 ]; then
    show_help
    exit 1
  fi

  MODE=$1

  # 检查环境
  check_environment

  # 根据模式部署
  case $MODE in
    dev)
      deploy_dev
      ;;
    prod)
      deploy_prod
      ;;
    *)
      error "无效的部署模式: $MODE"
      show_help
      exit 1
      ;;
  esac

  echo "═══════════════════════════════════════════"
  echo ""
  echo "🎉 部署完成！祝您使用愉快！"
  echo ""
  echo "下一步:"
  echo "  1. 访问应用: http://localhost:${APP_PORT:-3005}"
  echo "  2. 创建管理员: docker-compose exec app npx ts-node scripts/create-admin.ts"
  echo "  3. 查看日志: docker-compose logs -f"
  echo "  4. 完整文档: 查看 DOCKER_DEPLOYMENT.md"
  echo ""
  echo "═══════════════════════════════════════════"
}

# 运行主程序
main "$@"
