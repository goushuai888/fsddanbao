# 多阶段构建 - 使用 Debian Slim 以获得更好的兼容性
FROM node:20-slim AS base

# 安装依赖阶段
FROM base AS deps
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 复制 package 文件
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# 安装 pnpm 并安装依赖
RUN npm install -g pnpm && \
    pnpm install --frozen-lockfile

# 构建阶段
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 设置环境变量
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# 构建时需要虚拟环境变量（实际运行时会被覆盖）
ENV DATABASE_URL="postgresql://user:password@localhost:5432/db?schema=public"
ENV JWT_SECRET="build-time-secret-will-be-replaced-at-runtime-12345678901234567890123456789012"
ENV NEXTAUTH_SECRET="build-time-secret-will-be-replaced-at-runtime"
ENV PLATFORM_FEE_RATE="0.03"

# 生成 Prisma Client
RUN npm install -g pnpm && \
    pnpm prisma generate

# 构建 Next.js 应用
RUN pnpm build

# 运行阶段
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# 安装运行时依赖
RUN apt-get update && apt-get install -y \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 创建非 root 用户
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 nextjs

# 安装 pnpm (用于 prisma generate)
RUN npm install -g pnpm

# 复制必要文件
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

# 复制 Next.js 构建产物
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# 在 runner 阶段生成 Prisma Client
RUN pnpm install @prisma/client prisma && \
    pnpm prisma generate && \
    chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 启动应用
CMD ["node", "server.js"]
