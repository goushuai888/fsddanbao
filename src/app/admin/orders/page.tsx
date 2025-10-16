'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate, formatPrice } from '@/lib/utils'

interface Order {
  id: string
  orderNo: string
  status: string
  price: number
  platformFee: number
  escrowAmount: number | null
  vehicleBrand: string
  vehicleModel: string
  vehicleYear: number | null
  vehicleVin: string | null
  fsdVersion: string | null
  description: string | null
  // 退款申请
  refundRequested: boolean
  refundReason: string | null
  refundRequestedAt: string | null
  refundStatus: string | null
  createdAt: string
  publishedAt: string | null
  paidAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  seller: {
    id: string
    name: string | null
    email: string
    phone: string | null
  }
  buyer: {
    id: string
    name: string | null
    email: string
    phone: string | null
  } | null
  _count: {
    disputes: number
  }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  DRAFT: { label: '草稿', color: 'bg-gray-100 text-gray-800' },
  PUBLISHED: { label: '已发布', color: 'bg-blue-100 text-blue-800' },
  PAID: { label: '已支付', color: 'bg-green-100 text-green-800' },
  TRANSFERRING: { label: '转移中', color: 'bg-yellow-100 text-yellow-800' },
  COMPLETED: { label: '已完成', color: 'bg-green-600 text-white' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-800' },
  DISPUTE: { label: '申诉中', color: 'bg-orange-100 text-orange-800' }
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchOrders()
  }, [statusFilter, searchQuery, startDate, endDate])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/admin/orders'
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (searchQuery) params.append('search', searchQuery)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchOrders()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">订单管理</h1>
          <p className="text-gray-600 mt-2">查看和管理所有平台订单</p>
        </div>
      </div>

      {/* 筛选和搜索 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选订单</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 状态筛选 */}
            <div>
              <label className="block text-sm font-medium mb-2">订单状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="DRAFT">草稿</option>
                <option value="PUBLISHED">已发布</option>
                <option value="PAID">已支付</option>
                <option value="TRANSFERRING">转移中</option>
                <option value="COMPLETED">已完成</option>
                <option value="CANCELLED">已取消</option>
                <option value="DISPUTE">申诉中</option>
              </select>
            </div>

            {/* 搜索 */}
            <div>
              <label className="block text-sm font-medium mb-2">搜索</label>
              <Input
                type="text"
                placeholder="订单号/用户邮箱/车辆信息"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* 开始日期 */}
            <div>
              <label className="block text-sm font-medium mb-2">开始日期</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            {/* 结束日期 */}
            <div>
              <label className="block text-sm font-medium mb-2">结束日期</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
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
            <p className="text-gray-500">暂无订单数据</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        订单 #{order.orderNo}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[order.status]?.color}`}>
                        {STATUS_MAP[order.status]?.label}
                      </span>
                      {order._count.disputes > 0 && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800">
                          {order._count.disputes} 个申诉
                        </span>
                      )}
                      {order.refundRequested && (
                        <span className="px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          退款申请
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {order.vehicleBrand} {order.vehicleModel}
                      {order.vehicleYear && ` (${order.vehicleYear}年)`}
                      {order.fsdVersion && ` - ${order.fsdVersion}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {formatPrice(order.price)}
                    </div>
                    <div className="text-xs text-gray-500">
                      手续费: {formatPrice(order.platformFee)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* 卖家信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">卖家</h4>
                    <p className="text-sm text-gray-600">
                      {order.seller.name || '未命名'} ({order.seller.email})
                    </p>
                    {order.seller.phone && (
                      <p className="text-xs text-gray-500">{order.seller.phone}</p>
                    )}
                  </div>

                  {/* 买家信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">买家</h4>
                    {order.buyer ? (
                      <>
                        <p className="text-sm text-gray-600">
                          {order.buyer.name || '未命名'} ({order.buyer.email})
                        </p>
                        {order.buyer.phone && (
                          <p className="text-xs text-gray-500">{order.buyer.phone}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">暂无买家</p>
                    )}
                  </div>
                </div>

                {/* 时间信息 */}
                <div className="border-t pt-3 mb-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">创建时间：</span>
                      <span className="text-gray-900">{formatDate(order.createdAt)}</span>
                    </div>
                    {order.publishedAt && (
                      <div>
                        <span className="text-gray-500">发布时间：</span>
                        <span className="text-gray-900">{formatDate(order.publishedAt)}</span>
                      </div>
                    )}
                    {order.paidAt && (
                      <div>
                        <span className="text-gray-500">支付时间：</span>
                        <span className="text-gray-900">{formatDate(order.paidAt)}</span>
                      </div>
                    )}
                    {order.completedAt && (
                      <div>
                        <span className="text-gray-500">完成时间：</span>
                        <span className="text-gray-900">{formatDate(order.completedAt)}</span>
                      </div>
                    )}
                    {order.cancelledAt && (
                      <div>
                        <span className="text-gray-500">取消时间：</span>
                        <span className="text-gray-900">{formatDate(order.cancelledAt)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-3 border-t">
                  <Link href={`/orders/${order.id}`}>
                    <Button variant="outline">查看详情</Button>
                  </Link>
                  {order._count.disputes > 0 && (
                    <Link href="/admin/disputes">
                      <Button variant="outline" className="border-orange-300 text-orange-600">
                        查看申诉
                      </Button>
                    </Link>
                  )}
                  {order.refundRequested && (
                    <Link href="/admin/refunds">
                      <Button variant="outline" className="border-yellow-600 text-yellow-700">
                        查看退款申请
                      </Button>
                    </Link>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 订单统计 */}
      {!loading && orders.length > 0 && (
        <Card className="mt-6">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-gray-600">
              共找到 <span className="font-semibold text-gray-900">{orders.length}</span> 个订单
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
