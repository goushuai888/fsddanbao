'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useState } from 'react'

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    const name = formData.get('name') as string
    const phone = formData.get('phone') as string
    const role = formData.get('role') as string

    if (password !== confirmPassword) {
      alert('两次输入的密码不一致')
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name, phone, role }),
      })

      const data = await response.json()

      if (data.success) {
        alert('注册成功，即将跳转到登录页面')
        window.location.href = '/login'
      } else {
        alert(data.error || '注册失败')
      }
    } catch (error) {
      alert('网络错误，请稍后重试')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Link href="/" className="text-2xl font-bold text-blue-600">
              FSD担保交易平台
            </Link>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            注册新账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            已有账户？{' '}
            <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
              立即登录
            </Link>
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>注册</CardTitle>
              <CardDescription>
                填写以下信息创建新账户
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址 *
                </label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="请输入邮箱地址"
                />
              </div>

              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  姓名
                </label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="请输入姓名"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  手机号
                </label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="请输入手机号"
                />
              </div>

              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  用户类型
                </label>
                <select
                  id="role"
                  name="role"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  defaultValue="BUYER"
                >
                  <option value="BUYER">买家</option>
                  <option value="SELLER">卖家</option>
                </select>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  密码 *
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="请输入密码(至少6位)"
                  minLength={6}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                  确认密码 *
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  placeholder="请再次输入密码"
                  minLength={6}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? '注册中...' : '注册'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <div className="text-center">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            ← 返回首页
          </Link>
        </div>
      </div>
    </div>
  )
}
