import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// ✅ 安全修复: 强制要求JWT_SECRET环境变量
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'FATAL: JWT_SECRET must be set in environment variables and at least 32 characters long. ' +
    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  )
}

// 类型断言：经过上面的检查，JWT_SECRET一定是string
const JWT_SECRET_VERIFIED: string = JWT_SECRET

export interface TokenPayload {
  userId: string
  email: string
  role: string
  verified?: boolean  // 用户验证状态
  iat?: number  // issued at
  exp?: number  // expiration
}

// 生成JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET_VERIFIED, {
    expiresIn: '7d'
  })
}

// 验证JWT token
export function verifyToken(token: string | null | undefined): TokenPayload | null {
  if (!token) return null

  try {
    const payload = jwt.verify(token, JWT_SECRET_VERIFIED) as TokenPayload

    // 额外验证: 检查token是否过期
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return null
    }

    return payload
  } catch (error) {
    // 记录错误但不暴露详细信息
    if (process.env.NODE_ENV === 'development') {
      console.warn('Token verification failed:', error instanceof Error ? error.message : 'Unknown error')
    }
    return null
  }
}

// 加密密码
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

// 验证密码
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
