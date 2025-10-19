'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatPrice } from '@/lib/utils/helpers/common'
import { AdminFilters, FilterField } from '@/components/admin/AdminFilters'
import { useApiData } from '@/hooks/useApiData'

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
  // 筛选状态
  const [filters, setFilters] = useState({
    type: 'all',
    status: 'all',
    search: '',
    startDate: '',
    endDate: ''
  })

  // 使用通用数据获取 Hook
  const { data: payments, loading } = useApiData<Payment>({
    url: '/api/admin/payments',
    params: filters
  })

  // 计算总额
  const totalAmount = payments.reduce((sum, payment) => {
    if (payment.status === 'COMPLETED') {
      return sum + payment.amount
    }
    return sum
  }, 0)

  // 筛选字段配置
  const filterFields: FilterField[] = [
    {
      name: 'type',
      label: '支付类型',
      type: 'select',
      options: [
        { label: '全部类型', value: 'all' },
        { label: '托管', value: 'ESCROW' },
        { label: '释放', value: 'RELEASE' },
        { label: '退款', value: 'REFUND' },
        { label: '提现', value: 'WITHDRAWAL' }
      ]
    },
    {
      name: 'status',
      label: '支付状态',
      type: 'select',
      options: [
        { label: '全部状态', value: 'all' },
        { label: '待处理', value: 'PENDING' },
        { label: '处理中', value: 'PROCESSING' },
        { label: '已完成', value: 'COMPLETED' },
        { label: '失败', value: 'FAILED' }
      ]
    },
    {
      name: 'search',
      label: '搜索',
      type: 'text',
      placeholder: '用户邮箱/订单号/交易ID'
    },
    {
      name: 'dateRange',
      label: '日期范围',
      type: 'dateRange',
      startDateName: 'startDate',
      endDateName: 'endDate'
    }
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">支付记录</h1>
          <p className="text-gray-600 mt-2">查看所有支付、退款、释放款项记录</p>
        </div>
      </div>

      {/* 使用通用筛选组件 */}
      <AdminFilters
        title="筛选支付记录"
        fields={filterFields}
        values={filters}
        onChange={setFilters}
        className="mb-6"
      />

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
