'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice, formatDate, maskString } from '@/lib/utils'

interface Order {
  id: string
  orderNo: string
  status: string
  vehicleBrand: string
  vehicleModel: string
  vehicleYear: number
  fsdVersion: string
  price: number
  createdAt: string
  seller?: {
    id: string
    name: string
    verified: boolean
  }
  buyer?: {
    id: string
    name: string
    verified: boolean
  }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: '已发布', color: 'bg-blue-100 text-blue-800' },
  PAID: { label: '已支付', color: 'bg-green-100 text-green-800' },
  TRANSFERRING: { label: '转移中', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMING: { label: '待确认', color: 'bg-orange-100 text-orange-800' },
  COMPLETED: { label: '已完成', color: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-800' },
  DISPUTE: { label: '申诉中', color: 'bg-purple-100 text-purple-800' }
}

export default function OrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sell' | 'buy' | 'market'>('market')  // 默认显示市场订单
  const [statusFilter, setStatusFilter] = useState<string>('active')  // 默认显示进行中的订单
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      // 保存当前路径，登录后返回
      localStorage.setItem('redirectAfterLogin', '/orders')
      alert('请先登录后再访问订单列表')
      router.push('/login')
      return
    }

    setUser(JSON.parse(userData))
    fetchOrders(filter, statusFilter)
  }, [filter, statusFilter, router])

  const fetchOrders = async (type: string, status: string) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/orders'
      const params = new URLSearchParams()
      if (type !== 'all') params.append('type', type)
      if (status !== 'all') params.append('status', status)
      if (params.toString()) url += `?${params.toString()}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setOrders(data.data || [])
      } else {
        alert(data.error || '获取订单列表失败')
      }
    } catch (error) {
      console.error('获取订单列表错误:', error)
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
              欢迎，{user?.name || user?.email}
              {user?.verified && <span className="ml-1 text-green-600">✓</span>}
            </span>
            {user?.role === 'ADMIN' && (
              <Link href="/admin/users">
                <Button variant="outline">用户管理</Button>
              </Link>
            )}
            <Link href="/profile">
              <Button variant="outline">个人中心</Button>
            </Link>
            <Link href="/orders">
              <Button variant="outline">我的订单</Button>
            </Link>
            <Button onClick={handleLogout} variant="ghost">退出</Button>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">订单管理</h1>
          <Link href="/orders/create">
            <Button size="lg">发布FSD转让</Button>
          </Link>
        </div>

        {/* 筛选器 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>筛选订单</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 flex-wrap">
              <div>
                <label className="block text-sm font-medium mb-2">订单类型</label>
                <div className="flex gap-2">
                  <Button
                    variant={filter === 'market' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('market')}
                  >
                    市场浏览
                  </Button>
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('all')}
                  >
                    我的全部
                  </Button>
                  <Button
                    variant={filter === 'sell' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('sell')}
                  >
                    我卖出的
                  </Button>
                  <Button
                    variant={filter === 'buy' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilter('buy')}
                  >
                    我买入的
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">订单状态</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  disabled={filter === 'market'}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="active">进行中</option>
                  <option value="all">全部状态</option>
                  <option value="PUBLISHED">已发布</option>
                  <option value="PAID">已支付</option>
                  <option value="TRANSFERRING">转移中</option>
                  <option value="COMPLETED">已完成</option>
                  <option value="CANCELLED">已取消</option>
                </select>
                {filter === 'market' && (
                  <p className="text-xs text-gray-500 mt-1">市场只显示在售订单</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 订单列表 */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">加载中...</p>
          </div>
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-gray-500 mb-4">暂无订单</p>
              <Link href="/orders/create">
                <Button>发布第一个订单</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {orders.map((order) => (
              <Card key={order.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">
                      {order.vehicleBrand} {order.vehicleModel}
                    </CardTitle>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[order.status]?.color}`}>
                      {STATUS_MAP[order.status]?.label || order.status}
                    </span>
                  </div>
                  <CardDescription>
                    订单号: {maskString(order.orderNo, 6, 4)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">年份:</span>
                      <span className="font-medium">{order.vehicleYear}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">FSD版本:</span>
                      <span className="font-medium">{order.fsdVersion}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">价格:</span>
                      <span className="font-bold text-lg text-blue-600">
                        {formatPrice(order.price)}
                      </span>
                    </div>
                    {order.seller && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">卖家:</span>
                        <span>
                          {order.seller.name || '未命名'}
                          {order.seller.verified && <span className="text-green-600 ml-1">✓</span>}
                        </span>
                      </div>
                    )}
                    {order.buyer && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">买家:</span>
                        <span>
                          {order.buyer.name || '未命名'}
                          {order.buyer.verified && <span className="text-green-600 ml-1">✓</span>}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>发布时间:</span>
                      <span>{formatDate(order.createdAt)}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Link href={`/orders/${order.id}`} className="w-full">
                    <Button variant="outline" className="w-full">
                      查看详情
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
