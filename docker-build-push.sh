#!/bin/bash
#
# FSD担保交易平台 - Docker镜像构建和推送脚本
#
# 使用方法:
#   chmod +x docker-build-push.sh
#   ./docker-build-push.sh
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置
DOCKER_USERNAME="goushuai888"
IMAGE_NAME="fsddanbao"
VERSION="v1.4.0"

echo "═══════════════════════════════════════════"
echo "  FSD担保交易平台 - Docker镜像构建推送"
echo "═══════════════════════════════════════════"
echo ""

# 检查Docker是否运行
echo -e "${BLUE}🔧 检查Docker状态...${NC}"
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}❌ Docker未运行${NC}"
  echo ""
  echo "请先启动Docker："
  echo "  - Docker Desktop: 打开Docker Desktop应用"
  echo "  - OrbStack: 打开OrbStack应用"
  echo ""
  exit 1
fi
echo -e "${GREEN}✅ Docker已运行${NC}"
echo ""

# 构建镜像
echo -e "${BLUE}🔨 开始构建Docker镜像...${NC}"
echo "  镜像名称: ${DOCKER_USERNAME}/${IMAGE_NAME}"
echo "  版本标签: ${VERSION}, latest"
echo ""

docker build \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}:latest \
  .

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ 镜像构建失败${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ 镜像构建成功${NC}"
echo ""

# 显示镜像信息
echo -e "${BLUE}📊 镜像信息:${NC}"
docker images | grep ${IMAGE_NAME} | head -2
echo ""

# 登录Docker Hub
echo -e "${BLUE}🔐 登录Docker Hub...${NC}"
echo "  用户名: ${DOCKER_USERNAME}"
echo ""
echo "⚠️  请在下方提示中输入您的Docker Hub访问令牌"
echo ""

docker login -u ${DOCKER_USERNAME}

if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Docker Hub登录失败${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}✅ Docker Hub登录成功${NC}"
echo ""

# 推送镜像
echo -e "${BLUE}📤 推送镜像到Docker Hub...${NC}"
echo "  推送 ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}

echo ""
echo "  推送 ${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:latest

echo ""
echo -e "${GREEN}✅ 镜像推送成功${NC}"
echo ""

# 完成
echo "═══════════════════════════════════════════"
echo -e "${GREEN}  🎉 Docker镜像发布完成！${NC}"
echo "═══════════════════════════════════════════"
echo ""
echo -e "${BLUE}📦 镜像信息:${NC}"
echo "  Docker Hub: https://hub.docker.com/r/${DOCKER_USERNAME}/${IMAGE_NAME}"
echo "  镜像地址: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo "  最新版本: ${DOCKER_USERNAME}/${IMAGE_NAME}:latest"
echo ""
echo -e "${BLUE}🚀 使用方法:${NC}"
echo ""
echo "  在任何有Docker的服务器上运行："
echo "  ${GREEN}docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:latest${NC}"
echo ""
echo "  或使用docker-compose部署："
echo "  ${GREEN}docker-compose -f docker-compose.prod.yml up -d${NC}"
echo ""
echo "═══════════════════════════════════════════"
echo ""
