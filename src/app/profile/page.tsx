'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/layout/Navbar'
import { formatPrice } from '@/lib/utils/helpers/common'

interface UserProfile {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  verified: boolean
  balance: number
  createdAt: string
}

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // 个人信息表单
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: ''
  })

  // 密码修改表单
  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  // 加载用户信息
  useEffect(() => {
    const fetchProfile = async () => {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      try {
        const response = await fetch('/api/user/profile', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })

        const data = await response.json()
        if (data.success) {
          setUser(data.data)
          setProfileForm({
            name: data.data.name || '',
            phone: data.data.phone || ''
          })
        } else {
          setError(data.error)
          if (response.status === 401) {
            router.push('/login')
          }
        }
      } catch (err) {
        setError('加载用户信息失败')
      } finally {
        setLoading(false)
      }
    }

    fetchProfile()
  }, [router])

  // 更新个人信息
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const response = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(profileForm)
      })

      const data = await response.json()
      if (data.success) {
        setUser(data.data)
        setMessage('个人信息更新成功')
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('更新失败，请重试')
    }
  }

  // 修改密码
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    // 验证新密码
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setError('两次输入的新密码不一致')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      setError('新密码长度不能少于6位')
      return
    }

    const token = localStorage.getItem('token')
    if (!token) {
      router.push('/login')
      return
    }

    try {
      const response = await fetch('/api/user/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          oldPassword: passwordForm.oldPassword,
          newPassword: passwordForm.newPassword
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage('密码修改成功，即将退出登录，请用新密码重新登录...')
        setPasswordForm({
          oldPassword: '',
          newPassword: '',
          confirmPassword: ''
        })

        // 2秒后自动退出登录
        setTimeout(() => {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          router.push('/login')
        }, 2000)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('修改密码失败，请重试')
    }
  }

  // 退出登录
  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <Navbar user={user} onLogout={handleLogout} />

      <div className="py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* 返回链接 */}
        <div className="mb-4">
          <Link href="/orders" className="text-blue-600 hover:underline">
            ← 返回订单列表
          </Link>
        </div>

        {/* 页面标题 */}
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">个人中心</h1>
          <Button onClick={handleLogout} variant="outline">
            退出登录
          </Button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-800 rounded-md">
            {message}
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-md">
            {error}
          </div>
        )}

        {/* 用户信息卡片 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>账户信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">用户ID:</span>
              <span className="font-medium">{user?.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">邮箱:</span>
              <span className="font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">角色:</span>
              <span className="font-medium">
                {user?.role === 'ADMIN' ? '管理员' : user?.role === 'SELLER' ? '卖家' : '买家'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">实名认证:</span>
              <span className={`font-medium ${user?.verified ? 'text-green-600' : 'text-orange-600'}`}>
                {user?.verified ? '已认证' : '未认证'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">账户余额:</span>
              <div className="flex items-center gap-3">
                <span className="font-medium text-lg">{user?.balance && formatPrice(Number(user.balance))}</span>
                <Link href="/withdrawals">
                  <Button size="sm" variant="outline">
                    提现
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="profile">个人信息</TabsTrigger>
            <TabsTrigger value="password">修改密码</TabsTrigger>
          </TabsList>

          {/* 个人信息 Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>编辑个人信息</CardTitle>
                <CardDescription>更新您的个人资料</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">姓名</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="请输入姓名"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">手机号</Label>
                    <Input
                      id="phone"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="请输入手机号"
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    保存修改
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 修改密码 Tab */}
          <TabsContent value="password">
            <Card>
              <CardHeader>
                <CardTitle>修改密码</CardTitle>
                <CardDescription>请输入旧密码和新密码</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword">旧密码</Label>
                    <Input
                      id="oldPassword"
                      type="password"
                      value={passwordForm.oldPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, oldPassword: e.target.value })}
                      placeholder="请输入旧密码"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">新密码</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="请输入新密码（至少6位）"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">确认新密码</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="请再次输入新密码"
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    修改密码
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      </div>
    </div>
  )
}
