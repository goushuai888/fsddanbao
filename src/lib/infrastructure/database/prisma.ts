import { PrismaClient } from '@prisma/client'

/**
 * Prisma客户端单例
 *
 * 安全修复: CVSS 6.5 - 数据库连接池配置
 *
 * 配置说明:
 * - 连接池大小: 根据环境动态调整（开发10个，生产20个）
 * - 超时设置: 防止连接泄漏
 * - 日志级别: 开发环境详细，生产环境精简
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// 获取连接池大小配置
const getConnectionLimit = (): number => {
  // 优先使用环境变量
  if (process.env.DATABASE_CONNECTION_LIMIT) {
    return parseInt(process.env.DATABASE_CONNECTION_LIMIT, 10)
  }

  // 根据环境自动配置
  // 生产环境: 20个连接（适合中小型应用）
  // 开发环境: 10个连接（减少资源占用）
  return process.env.NODE_ENV === 'production' ? 20 : 10
}

// 获取连接超时配置
const getConnectionTimeout = (): number => {
  if (process.env.DATABASE_CONNECTION_TIMEOUT) {
    return parseInt(process.env.DATABASE_CONNECTION_TIMEOUT, 10)
  }

  // 默认30秒超时
  return 30000
}

// 构建数据库URL（包含连接池参数）
const getDatabaseUrl = (): string => {
  const baseUrl = process.env.DATABASE_URL
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  // 解析URL并添加连接池参数
  const url = new URL(baseUrl)
  const connectionLimit = getConnectionLimit()

  // 设置连接池参数
  url.searchParams.set('connection_limit', String(connectionLimit))
  url.searchParams.set('pool_timeout', '30') // 秒

  return url.toString()
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // 数据库连接配置
    datasources: {
      db: {
        url: getDatabaseUrl()
      }
    },

    // 日志配置
    log: process.env.NODE_ENV === 'production'
      ? ['error', 'warn'] // 生产环境只记录错误和警告
      : ['query', 'error', 'warn'], // 开发环境记录所有查询

    // 错误格式化
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'colorless',
  })

// 开发环境保存单例到全局
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

// 优雅关闭数据库连接
if (process.env.NODE_ENV === 'production') {
  process.on('beforeExit', async () => {
    await prisma.$disconnect()
  })

  process.on('SIGINT', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
}

