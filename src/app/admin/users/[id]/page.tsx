'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, formatPrice, maskString } from '@/lib/utils'

interface UserDetail {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  verified: boolean
  balance: number
  createdAt: string
  updatedAt: string
  sellOrders: Array<{
    id: string
    orderNo: string
    status: string
    price: number
    createdAt: string
  }>
  buyOrders: Array<{
    id: string
    orderNo: string
    status: string
    price: number
    createdAt: string
  }>
  _count: {
    sellOrders: number
    buyOrders: number
    payments: number
  }
}

const ROLE_MAP: Record<string, string> = {
  ADMIN: '管理员',
  SELLER: '卖家',
  BUYER: '买家'
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: '已发布', color: 'bg-blue-100 text-blue-800' },
  PAID: { label: '已支付', color: 'bg-green-100 text-green-800' },
  TRANSFERRING: { label: '转移中', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMING: { label: '待确认', color: 'bg-orange-100 text-orange-800' },
  COMPLETED: { label: '已完成', color: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-800' }
}

export default function AdminUserDetailPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.id as string

  const [user, setUser] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // 编辑表单
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    role: '',
    verified: false,
    balance: 0
  })

  useEffect(() => {
    // 检查登录状态和管理员权限
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      alert('请先登录')
      router.push('/login')
      return
    }

    const parsedUser = JSON.parse(userData)
    if (parsedUser.role !== 'ADMIN') {
      alert('无权访问此页面')
      router.push('/')
      return
    }

    fetchUserDetail()
  }, [userId, router])

  const fetchUserDetail = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/admin/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setUser(data.data)
        setEditForm({
          name: data.data.name || '',
          phone: data.data.phone || '',
          role: data.data.role,
          verified: data.data.verified,
          balance: data.data.balance
        })
      } else {
        alert(data.error || '获取用户详情失败')
        router.push('/admin/users')
      }
    } catch (error) {
      console.error('获取用户详情错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setError('')

    if (!confirm('确定要更新此用户的信息吗？')) {
      return
    }

    try {
      setSaving(true)
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editForm)
      })

      const data = await response.json()

      if (data.success) {
        setMessage('用户信息更新成功')
        fetchUserDetail()
      } else {
        setError(data.error || '更新失败')
      }
    } catch (error) {
      console.error('更新用户信息错误:', error)
      setError('网络错误，请稍后重试')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUser = async () => {
    if (!confirm('确定要删除此用户吗？此操作不可恢复！')) {
      return
    }

    if (!confirm('再次确认：真的要删除此用户吗？')) {
      return
    }

    try {
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        alert('用户删除成功')
        router.push('/admin/users')
      } else {
        alert(data.error || '删除失败')
      }
    } catch (error) {
      console.error('删除用户错误:', error)
      alert('网络错误，请稍后重试')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">用户不存在</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            FSD担保交易平台
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/admin/users">
              <Button variant="outline">用户管理</Button>
            </Link>
            <Link href="/orders">
              <Button variant="outline">订单管理</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link href="/admin/users" className="text-blue-600 hover:underline">
              ← 返回用户列表
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6">用户详情</h1>

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 基本信息 */}
            <Card>
              <CardHeader>
                <CardTitle>基本信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">用户ID:</span>
                  <span className="font-mono text-sm">{user.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">邮箱:</span>
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">姓名:</span>
                  <span>{user.name || '未设置'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">手机:</span>
                  <span>{user.phone ? maskString(user.phone, 3, 4) : '未设置'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">角色:</span>
                  <span className="font-medium">{ROLE_MAP[user.role]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">认证状态:</span>
                  <span className={user.verified ? 'text-green-600' : 'text-orange-600'}>
                    {user.verified ? '已认证' : '未认证'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">账户余额:</span>
                  <span className="font-medium">{formatPrice(user.balance)}</span>
                </div>
              </CardContent>
            </Card>

            {/* 统计信息 */}
            <Card>
              <CardHeader>
                <CardTitle>统计信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">注册时间:</span>
                  <span className="text-sm">{formatDate(user.createdAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最后更新:</span>
                  <span className="text-sm">{formatDate(user.updatedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">卖出订单:</span>
                  <span className="font-medium">{user._count.sellOrders} 笔</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">买入订单:</span>
                  <span className="font-medium">{user._count.buyOrders} 笔</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">支付记录:</span>
                  <span className="font-medium">{user._count.payments} 笔</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 编辑表单 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>编辑用户信息</CardTitle>
              <CardDescription>管理员可以修改用户的基本信息</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">姓名</Label>
                    <Input
                      id="name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      placeholder="用户姓名"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">手机号</Label>
                    <Input
                      id="phone"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      placeholder="手机号码"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">用户角色</Label>
                    <select
                      id="role"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="BUYER">买家</option>
                      <option value="SELLER">卖家</option>
                      <option value="ADMIN">管理员</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="balance">账户余额</Label>
                    <Input
                      id="balance"
                      type="number"
                      step="0.01"
                      value={editForm.balance}
                      onChange={(e) => setEditForm({ ...editForm, balance: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="verified"
                    checked={editForm.verified}
                    onChange={(e) => setEditForm({ ...editForm, verified: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="verified" className="text-sm font-medium">
                    实名认证
                  </Label>
                </div>
                <div className="flex gap-4">
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving ? '保存中...' : '保存修改'}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteUser}
                    className="flex-1"
                  >
                    删除用户
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* 卖出订单 */}
          {user.sellOrders.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>最近卖出订单（前10条）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {user.sellOrders.map((order) => (
                    <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                          {order.orderNo}
                        </Link>
                        <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[order.status]?.color}`}>
                          {STATUS_MAP[order.status]?.label}
                        </span>
                        <p className="text-sm font-medium mt-1">{formatPrice(order.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 买入订单 */}
          {user.buyOrders.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>最近买入订单（前10条）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {user.buyOrders.map((order) => (
                    <div key={order.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <Link href={`/orders/${order.id}`} className="text-blue-600 hover:underline">
                          {order.orderNo}
                        </Link>
                        <p className="text-xs text-gray-500">{formatDate(order.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[order.status]?.color}`}>
                          {STATUS_MAP[order.status]?.label}
                        </span>
                        <p className="text-sm font-medium mt-1">{formatPrice(order.price)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
