'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate, formatPrice } from '@/lib/utils'

interface Payment {
  id: string
  amount: number
  type: string
  status: string
  paymentMethod: string | null
  transactionId: string | null
  note: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    phone: string | null
  }
  order: {
    id: string
    orderNo: string
    vehicleBrand: string
    vehicleModel: string
    status: string
  }
}

const TYPE_MAP: Record<string, { label: string; color: string }> = {
  ESCROW: { label: '托管', color: 'bg-blue-100 text-blue-800' },
  RELEASE: { label: '释放', color: 'bg-green-100 text-green-800' },
  REFUND: { label: '退款', color: 'bg-orange-100 text-orange-800' },
  WITHDRAWAL: { label: '提现', color: 'bg-purple-100 text-purple-800' }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'bg-yellow-100 text-yellow-800' },
  PROCESSING: { label: '处理中', color: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  FAILED: { label: '失败', color: 'bg-red-100 text-red-800' }
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchPayments()
  }, [typeFilter, statusFilter, searchQuery, startDate, endDate])

  const fetchPayments = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/admin/payments'
      const params = new URLSearchParams()
      if (typeFilter !== 'all') params.append('type', typeFilter)
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
        setPayments(data.data || [])
      } else {
        alert(data.error || '获取支付记录失败')
      }
    } catch (error) {
      console.error('获取支付记录错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  // 计算总额
  const totalAmount = payments.reduce((sum, payment) => {
    if (payment.status === 'COMPLETED') {
      return sum + payment.amount
    }
    return sum
  }, 0)

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">支付记录</h1>
          <p className="text-gray-600 mt-2">查看所有支付、退款、释放款项记录</p>
        </div>
      </div>

      {/* 筛选和搜索 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选支付记录</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 类型筛选 */}
            <div>
              <label className="block text-sm font-medium mb-2">支付类型</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">全部类型</option>
                <option value="ESCROW">托管</option>
                <option value="RELEASE">释放</option>
                <option value="REFUND">退款</option>
                <option value="WITHDRAWAL">提现</option>
              </select>
            </div>

            {/* 状态筛选 */}
            <div>
              <label className="block text-sm font-medium mb-2">支付状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="PENDING">待处理</option>
                <option value="PROCESSING">处理中</option>
                <option value="COMPLETED">已完成</option>
                <option value="FAILED">失败</option>
              </select>
            </div>

            {/* 搜索 */}
            <div>
              <label className="block text-sm font-medium mb-2">搜索</label>
              <Input
                type="text"
                placeholder="用户邮箱/订单号/交易ID"
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

      {/* 统计卡片 */}
      {!loading && payments.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">总记录数</div>
              <div className="text-2xl font-bold text-gray-900">{payments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">已完成记录</div>
              <div className="text-2xl font-bold text-green-600">
                {payments.filter(p => p.status === 'COMPLETED').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">已完成总额</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPrice(totalAmount)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 支付记录列表 */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">暂无支付记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  用户
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  订单
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  类型
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  金额
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状态
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  备注
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {payments.map((payment) => (
                <tr key={payment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(payment.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {payment.user.name || '未命名'}
                    </div>
                    <div className="text-xs text-gray-500">{payment.user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">#{payment.order.orderNo}</div>
                    <div className="text-xs text-gray-500">
                      {payment.order.vehicleBrand} {payment.order.vehicleModel}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${TYPE_MAP[payment.type]?.color}`}>
                      {TYPE_MAP[payment.type]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    {formatPrice(payment.amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[payment.status]?.color}`}>
                      {STATUS_MAP[payment.status]?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                    {payment.note || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <Link href={`/orders/${payment.order.id}`}>
                      <Button variant="outline" size="sm">
                        查看订单
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
