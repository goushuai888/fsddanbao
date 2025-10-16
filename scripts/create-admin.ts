import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function createAdmin() {
  try {
    // 管理员账号信息
    const adminEmail = 'admin@fsddanbao.com'
    const adminPassword = 'admin123456' // 请在首次登录后修改密码
    const adminName = '超级管理员'

    // 检查是否已存在该管理员
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail }
    })

    if (existingAdmin) {
      console.log('❌ 管理员账号已存在')
      console.log('邮箱:', adminEmail)
      console.log('角色:', existingAdmin.role)
      return
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(adminPassword, 10)

    // 创建管理员
    const admin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: hashedPassword,
        name: adminName,
        role: 'ADMIN',
        verified: true, // 管理员默认已认证
        balance: 0
      }
    })

    console.log('✅ 超级管理员账号创建成功！')
    console.log('----------------------------')
    console.log('邮箱:', adminEmail)
    console.log('密码:', adminPassword)
    console.log('角色:', admin.role)
    console.log('ID:', admin.id)
    console.log('----------------------------')
    console.log('⚠️  请务必在首次登录后修改密码！')

  } catch (error) {
    console.error('❌ 创建管理员失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
