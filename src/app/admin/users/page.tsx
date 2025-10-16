'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

interface User {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  verified: boolean
  balance: number
  createdAt: string
  updatedAt: string
  _count: {
    sellOrders: number
    buyOrders: number
  }
}

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  ADMIN: { label: '管理员', color: 'bg-purple-100 text-purple-800' },
  SELLER: { label: '卖家', color: 'bg-blue-100 text-blue-800' },
  BUYER: { label: '买家', color: 'bg-green-100 text-green-800' }
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [roleFilter, setRoleFilter] = useState('all')
  const [verifiedFilter, setVerifiedFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

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

    setUser(parsedUser)
    fetchUsers()
  }, [roleFilter, verifiedFilter, searchQuery, router])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/admin/users'
      const params = new URLSearchParams()
      if (roleFilter !== 'all') params.append('role', roleFilter)
      if (verifiedFilter !== 'all') params.append('verified', verifiedFilter)
      if (searchQuery) params.append('search', searchQuery)
      if (params.toString()) url += `?${params.toString()}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setUsers(data.data || [])
      } else {
        alert(data.error || '获取用户列表失败')
      }
    } catch (error) {
      console.error('获取用户列表错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/')
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchUsers()
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
            <span className="text-sm text-gray-600">
              管理员：{user?.name || user?.email}
            </span>
            <Link href="/admin/users">
              <Button variant="outline">用户管理</Button>
            </Link>
            <Link href="/orders">
              <Button variant="outline">订单管理</Button>
            </Link>
            <Link href="/profile">
              <Button variant="outline">个人中心</Button>
            </Link>
            <Button onClick={handleLogout} variant="ghost">退出</Button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">用户管理</h1>
        </div>

        {/* 筛选和搜索 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>筛选用户</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 角色筛选 */}
              <div>
                <label className="block text-sm font-medium mb-2">用户角色</label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">全部角色</option>
                  <option value="BUYER">买家</option>
                  <option value="SELLER">卖家</option>
                  <option value="ADMIN">管理员</option>
                </select>
              </div>

              {/* 认证状态筛选 */}
              <div>
                <label className="block text-sm font-medium mb-2">认证状态</label>
                <select
                  value={verifiedFilter}
                  onChange={(e) => setVerifiedFilter(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="all">全部状态</option>
                  <option value="true">已认证</option>
                  <option value="false">未认证</option>
                </select>
              </div>

              {/* 搜索 */}
              <div>
                <label className="block text-sm font-medium mb-2">搜索用户</label>
                <form onSubmit={handleSearch} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="邮箱、姓名或手机号"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Button type="submit">搜索</Button>
                </form>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 用户列表 */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : users.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500">暂无用户数据</p>
            </CardContent>
          </Card>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    用户信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    角色
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    认证状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    订单统计
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    余额
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    注册时间
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {u.name || '未命名'}
                        </div>
                        <div className="text-sm text-gray-500">{u.email}</div>
                        {u.phone && (
                          <div className="text-xs text-gray-400">{u.phone}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${ROLE_MAP[u.role]?.color}`}>
                        {ROLE_MAP[u.role]?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        u.verified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {u.verified ? '已认证' : '未认证'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>卖出: {u._count.sellOrders}</div>
                      <div>买入: {u._count.buyOrders}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      ¥{u.balance.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(u.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link href={`/admin/users/${u.id}`}>
                        <Button variant="outline" size="sm">
                          查看详情
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  )
}
