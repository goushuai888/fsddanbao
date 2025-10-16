#!/bin/bash

# FSD担保交易平台 - Docker快速部署脚本
# 用法: ./deploy.sh [start|stop|restart|rebuild|logs|status]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
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

# 检查Docker是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker未安装，请先安装Docker"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose未安装，请先安装Docker Compose"
        exit 1
    fi

    print_info "Docker环境检查通过"
}

# 检查环境变量文件
check_env() {
    if [ ! -f ".env.production" ]; then
        print_warn "未找到 .env.production 文件"
        print_info "正在从模板创建..."
        cp .env.production.example .env.production
        print_warn "请编辑 .env.production 文件，修改数据库密码和密钥"
        print_warn "运行以下命令生成随机密钥："
        echo "  openssl rand -base64 32"
        read -p "是否已配置环境变量？(y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "请先配置环境变量后再运行"
            exit 1
        fi
    fi
}

# 启动服务
start_services() {
    print_info "正在启动服务..."
    check_docker
    check_env

    docker-compose up -d

    print_info "等待服务启动..."
    sleep 5

    print_info "服务状态："
    docker-compose ps

    print_info "✅ 服务启动成功！"
    print_info "应用地址: http://localhost:3000"
    print_info "查看日志: ./deploy.sh logs"
}

# 停止服务
stop_services() {
    print_info "正在停止服务..."
    docker-compose stop
    print_info "✅ 服务已停止"
}

# 重启服务
restart_services() {
    print_info "正在重启服务..."
    docker-compose restart
    print_info "✅ 服务已重启"
}

# 重新构建
rebuild_services() {
    print_warn "将重新构建镜像并启动服务"
    read -p "确认继续？(y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "正在重新构建..."
        docker-compose build --no-cache
        docker-compose up -d
        print_info "✅ 重新构建完成"
    fi
}

# 查看日志
show_logs() {
    print_info "正在显示日志 (Ctrl+C 退出)..."
    docker-compose logs -f
}

# 查看状态
show_status() {
    print_info "服务状态："
    docker-compose ps
    echo ""
    print_info "资源使用："
    docker stats --no-stream
}

# 数据库备份
backup_database() {
    print_info "正在备份数据库..."
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    docker-compose exec -T postgres pg_dump -U fsd_user fsd_escrow > "$BACKUP_FILE"
    print_info "✅ 数据库已备份到: $BACKUP_FILE"
}

# 显示帮助信息
show_help() {
    echo "FSD担保交易平台 - Docker部署脚本"
    echo ""
    echo "用法: ./deploy.sh [命令]"
    echo ""
    echo "可用命令:"
    echo "  start     - 启动服务"
    echo "  stop      - 停止服务"
    echo "  restart   - 重启服务"
    echo "  rebuild   - 重新构建并启动"
    echo "  logs      - 查看日志"
    echo "  status    - 查看服务状态"
    echo "  backup    - 备份数据库"
    echo "  help      - 显示帮助信息"
    echo ""
    echo "示例:"
    echo "  ./deploy.sh start"
    echo "  ./deploy.sh logs"
}

# 主函数
main() {
    case "${1:-help}" in
        start)
            start_services
            ;;
        stop)
            stop_services
            ;;
        restart)
            restart_services
            ;;
        rebuild)
            rebuild_services
            ;;
        logs)
            show_logs
            ;;
        status)
            show_status
            ;;
        backup)
            backup_database
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 执行主函数
main "$@"
