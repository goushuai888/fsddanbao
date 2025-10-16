import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key'

export interface TokenPayload {
  userId: string
  email: string
  role: string
}

// 生成JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: '7d'
  })
}

// 验证JWT token
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload
  } catch (error) {
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
