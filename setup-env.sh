#!/bin/bash
#
# FSD担保交易平台 - 环境配置自动生成脚本
#
# 使用方法:
#   chmod +x setup-env.sh
#   ./setup-env.sh
#

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════"
echo "  FSD担保交易平台 - 环境配置自动生成"
echo "═══════════════════════════════════════════"
echo ""

# 检查是否已存在.env文件
if [ -f .env ]; then
  echo -e "${YELLOW}⚠️  .env 文件已存在${NC}"
  read -p "是否覆盖现有配置? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}❌ 操作已取消${NC}"
    exit 1
  fi
  # 备份现有.env
  cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
  echo -e "${GREEN}✅ 已备份现有配置到 .env.backup.*${NC}"
fi

# 生成强随机密钥
echo -e "${BLUE}🔧 生成安全密钥...${NC}"

# 生成JWT_SECRET (256位 = 64个hex字符)
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo -e "${GREEN}✅ JWT_SECRET 已生成${NC}"

# 生成NEXTAUTH_SECRET
NEXTAUTH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
echo -e "${GREEN}✅ NEXTAUTH_SECRET 已生成${NC}"

# 生成数据库密码
POSTGRES_PASSWORD=$(node -e "console.log(require('crypto').randomBytes(16).toString('hex'))")
echo -e "${GREEN}✅ POSTGRES_PASSWORD 已生成${NC}"

# 获取用户输入
echo ""
echo -e "${BLUE}📧 请输入邮件服务配置（用于发送验证码）${NC}"
echo -e "${YELLOW}提示: 如果暂时不配置，可以直接回车跳过，后续再手动修改 .env 文件${NC}"
echo ""

read -p "SMTP服务器 (默认: smtp.qq.com): " SMTP_HOST
SMTP_HOST=${SMTP_HOST:-smtp.qq.com}

read -p "SMTP端口 (默认: 465): " SMTP_PORT
SMTP_PORT=${SMTP_PORT:-465}

read -p "发件邮箱 (例如: your-email@qq.com): " SMTP_USER
if [ -z "$SMTP_USER" ]; then
  SMTP_USER="your-email@qq.com"
  echo -e "${YELLOW}⚠️  未配置发件邮箱，请稍后修改 .env 文件${NC}"
fi

read -p "邮箱授权码 (非邮箱密码!): " SMTP_PASS
if [ -z "$SMTP_PASS" ]; then
  SMTP_PASS="your-email-authorization-code"
  echo -e "${YELLOW}⚠️  未配置授权码，请稍后修改 .env 文件${NC}"
fi

echo ""
echo -e "${BLUE}☁️  请输入七牛云配置（用于图片上传）${NC}"
echo -e "${YELLOW}提示: 如果暂时不配置，可以直接回车跳过${NC}"
echo ""

read -p "七牛云 AccessKey: " QINIU_ACCESS_KEY
if [ -z "$QINIU_ACCESS_KEY" ]; then
  QINIU_ACCESS_KEY="your-qiniu-access-key"
  echo -e "${YELLOW}⚠️  未配置七牛云，请稍后修改 .env 文件${NC}"
fi

read -p "七牛云 SecretKey: " QINIU_SECRET_KEY
if [ -z "$QINIU_SECRET_KEY" ]; then
  QINIU_SECRET_KEY="your-qiniu-secret-key"
fi

read -p "七牛云 Bucket名称 (默认: fsddanbao): " QINIU_BUCKET
QINIU_BUCKET=${QINIU_BUCKET:-fsddanbao}

read -p "七牛云访问域名 (默认: https://fsddanbao.s3.ap-southeast-1.qiniucs.com): " QINIU_DOMAIN
QINIU_DOMAIN=${QINIU_DOMAIN:-https://fsddanbao.s3.ap-southeast-1.qiniucs.com}

# 生成.env文件
echo ""
echo -e "${BLUE}📝 生成 .env 文件...${NC}"

cat > .env << EOF
# ============================================
# 🔐 核心安全配置（自动生成）
# ============================================

# JWT密钥（256位强随机密钥）
# ⚠️ 生产环境切勿修改，否则会导致所有用户登录失效
JWT_SECRET="${JWT_SECRET}"

# NextAuth密钥
NEXTAUTH_SECRET="${NEXTAUTH_SECRET}"
NEXTAUTH_URL="http://localhost:3005"

# ============================================
# 🐳 Docker 部署配置
# ============================================

# 应用端口（宿主机端口）
APP_PORT=3005

# PostgreSQL配置（自动生成密码）
POSTGRES_USER=fsd_user
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"
POSTGRES_DB=fsd_escrow
POSTGRES_PORT=5432

# 数据库连接URL（Docker内部使用）
DATABASE_URL="postgresql://fsd_user:${POSTGRES_PASSWORD}@postgres:5432/fsd_escrow?schema=public"

# 数据库连接池配置（可选）
DATABASE_CONNECTION_LIMIT="20"
DATABASE_CONNECTION_TIMEOUT="30000"

# ============================================
# 📧 邮件服务配置（Nodemailer SMTP）
# ============================================

# SMTP配置
SMTP_HOST="${SMTP_HOST}"
SMTP_PORT="${SMTP_PORT}"
SMTP_SECURE="true"
SMTP_USER="${SMTP_USER}"
SMTP_PASS="${SMTP_PASS}"
SMTP_FROM_NAME="FSD担保交易平台"

# 大额订单阈值（单位：元）
LARGE_PAYMENT_THRESHOLD=10000

# ============================================
# 📦 七牛云存储配置（用于图片上传）
# ============================================

QINIU_ACCESS_KEY="${QINIU_ACCESS_KEY}"
QINIU_SECRET_KEY="${QINIU_SECRET_KEY}"
QINIU_BUCKET="${QINIU_BUCKET}"
QINIU_ZONE="Zone_as0"
QINIU_DOMAIN="${QINIU_DOMAIN}"

# ============================================
# 💰 平台配置
# ============================================

PLATFORM_FEE_RATE=0.03

# ============================================
# 🔒 Upstash Redis配置（可选，用于请求限流）
# ============================================
# 生产环境推荐配置，开发环境可以留空
UPSTASH_REDIS_REST_URL=""
UPSTASH_REDIS_REST_TOKEN=""

# ============================================
# 📁 文件上传配置
# ============================================

UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE=5242880

# ============================================
# 💳 支付配置（示例，暂未集成）
# ============================================

ALIPAY_APP_ID=""
ALIPAY_PRIVATE_KEY=""
ALIPAY_PUBLIC_KEY=""

WECHAT_APP_ID=""
WECHAT_APP_SECRET=""
WECHAT_MCH_ID=""
WECHAT_API_KEY=""
EOF

echo -e "${GREEN}✅ .env 文件已生成${NC}"

# 创建配置摘要文件
cat > .env.summary.txt << EOF
═══════════════════════════════════════════
  FSD担保交易平台 - 配置摘要
═══════════════════════════════════════════

生成时间: $(date '+%Y-%m-%d %H:%M:%S')

🔐 自动生成的安全密钥:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
JWT_SECRET:         ${JWT_SECRET}
NEXTAUTH_SECRET:    ${NEXTAUTH_SECRET}
POSTGRES_PASSWORD:  ${POSTGRES_PASSWORD}

📧 邮件服务配置:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SMTP服务器:     ${SMTP_HOST}
SMTP端口:       ${SMTP_PORT}
发件邮箱:       ${SMTP_USER}
授权码:         ${SMTP_PASS}

☁️  七牛云配置:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AccessKey:      ${QINIU_ACCESS_KEY}
SecretKey:      ${QINIU_SECRET_KEY}
Bucket:         ${QINIU_BUCKET}
域名:           ${QINIU_DOMAIN}

📊 数据库连接信息:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
数据库用户:     fsd_user
数据库密码:     ${POSTGRES_PASSWORD}
数据库名称:     fsd_escrow
数据库端口:     5432

🚀 应用访问地址:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
应用地址:       http://localhost:3005
管理后台:       http://localhost:3005/admin

⚠️  重要提示:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. 请妥善保管此文件，包含敏感信息
2. 切勿将 .env 和 .env.summary.txt 提交到 Git
3. 部署到服务器时，请将 .env 文件一起上传
4. 如需修改配置，请直接编辑 .env 文件

═══════════════════════════════════════════
EOF

echo ""
echo -e "${GREEN}✅ 配置摘要已保存到 .env.summary.txt${NC}"
echo ""

# 设置文件权限
chmod 600 .env
chmod 600 .env.summary.txt

echo -e "${GREEN}✅ 文件权限已设置为 600（仅所有者可读写）${NC}"
echo ""

# 显示配置摘要
echo "═══════════════════════════════════════════"
echo -e "${GREEN}  🎉 环境配置完成！${NC}"
echo "═══════════════════════════════════════════"
echo ""
echo -e "${BLUE}📋 配置摘要:${NC}"
echo "  JWT密钥:        ✅ 已生成（256位）"
echo "  数据库密码:      ✅ 已生成（128位）"
echo "  NextAuth密钥:    ✅ 已生成"
echo "  SMTP邮箱:       ${SMTP_USER}"
echo "  七牛云:         ${QINIU_ACCESS_KEY}"
echo ""

if [ "$SMTP_USER" = "your-email@qq.com" ] || [ "$SMTP_PASS" = "your-email-authorization-code" ]; then
  echo -e "${YELLOW}⚠️  邮件服务未完全配置，请手动编辑 .env 文件:${NC}"
  echo "   - SMTP_USER: 您的邮箱地址"
  echo "   - SMTP_PASS: 邮箱授权码（非密码）"
  echo ""
  echo -e "${YELLOW}   获取QQ邮箱授权码:${NC}"
  echo "   1. 登录 https://mail.qq.com"
  echo "   2. 设置 → 账户 → POP3/IMAP/SMTP服务"
  echo "   3. 开启服务 → 生成授权码"
  echo ""
fi

if [ "$QINIU_ACCESS_KEY" = "your-qiniu-access-key" ]; then
  echo -e "${YELLOW}⚠️  七牛云未配置，请手动编辑 .env 文件:${NC}"
  echo "   - QINIU_ACCESS_KEY"
  echo "   - QINIU_SECRET_KEY"
  echo ""
  echo -e "${YELLOW}   获取七牛云密钥:${NC}"
  echo "   1. 登录 https://portal.qiniu.com"
  echo "   2. 个人中心 → 密钥管理"
  echo ""
fi

echo "═══════════════════════════════════════════"
echo ""
echo -e "${GREEN}🚀 下一步 - 一键部署:${NC}"
echo ""
echo "  1. 开发环境部署:"
echo "     ${BLUE}./docker-deploy.sh dev${NC}"
echo ""
echo "  2. 生产环境部署:"
echo "     ${BLUE}./docker-deploy.sh prod${NC}"
echo ""
echo "  3. 创建管理员账户:"
echo "     ${BLUE}docker-compose exec app npx ts-node scripts/create-admin.ts${NC}"
echo ""
echo "═══════════════════════════════════════════"
echo ""
echo -e "${YELLOW}📝 详细信息已保存到: .env.summary.txt${NC}"
echo ""
