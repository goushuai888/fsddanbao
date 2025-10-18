'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useState } from 'react'
import { setAuthToken } from '@/lib/cookies'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (data.success) {
        // 安全修复: 同时保存token到localStorage和Cookie（供中间件使用）
        setAuthToken(data.data.token)
        localStorage.setItem('user', JSON.stringify(data.data.user))

        // 检查是否有之前保存的跳转路径
        const redirectPath = localStorage.getItem('redirectAfterLogin')
        if (redirectPath) {
          localStorage.removeItem('redirectAfterLogin')
          window.location.href = redirectPath
        } else {
          // 默认跳转到订单列表
          window.location.href = '/orders'
        }
      } else {
        alert(data.error || '登录失败')
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
            登录您的账户
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            还没有账户？{' '}
            <Link href="/register" className="font-medium text-blue-600 hover:text-blue-500">
              立即注册
            </Link>
          </p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <CardHeader>
              <CardTitle>登录</CardTitle>
              <CardDescription>
                输入您的邮箱和密码来登录账户
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  邮箱地址
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
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  密码
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="请输入密码"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? '登录中...' : '登录'}
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
