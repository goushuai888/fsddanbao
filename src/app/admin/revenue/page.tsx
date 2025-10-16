'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/utils'

interface RevenueStats {
  totalRevenue: number
  totalOrders: number
  avgOrderValue: number
  trendData: Array<{
    period: string
    revenue: number
    orders: number
  }>
  ordersByStatus: Array<{
    status: string
    count: number
  }>
}

const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  PAID: '已支付',
  TRANSFERRING: '转移中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTE: '申诉中'
}

export default function AdminRevenuePage() {
  const [stats, setStats] = useState<RevenueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('day')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchStats()
  }, [period, startDate, endDate])

  const fetchStats = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/admin/revenue'
      const params = new URLSearchParams()
      params.append('period', period)
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)
      url += `?${params.toString()}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      } else {
        alert(data.error || '获取收益统计失败')
      }
    } catch (error) {
      console.error('获取收益统计错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">收益统计</h1>
          <p className="text-gray-600 mt-2">平台收益分析和趋势报表</p>
        </div>
      </div>

      {/* 筛选 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选条件</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 时间粒度 */}
            <div>
              <label className="block text-sm font-medium mb-2">统计粒度</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="day">按天</option>
                <option value="week">按周</option>
                <option value="month">按月</option>
              </select>
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

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : stats ? (
        <>
          {/* 核心指标卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">
                  总收益
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-green-600">
                  {formatPrice(stats.totalRevenue)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  来自已完成订单的手续费
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">
                  已完成订单
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-blue-600">
                  {stats.totalOrders}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  统计期间内的完成订单数
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-gray-600">
                  平均订单价值
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-purple-600">
                  {formatPrice(stats.avgOrderValue)}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  单笔订单平均金额
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 趋势数据表格 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>收益趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.trendData.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  所选时间段内暂无数据
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          时间段
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          收益
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          订单数
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          平均收益
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.trendData.map((item) => (
                        <tr key={item.period} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {item.period}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-green-600">
                            {formatPrice(item.revenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {item.orders}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {formatPrice(item.revenue / item.orders)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 订单状态分布 */}
          <Card>
            <CardHeader>
              <CardTitle>订单状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stats.ordersByStatus.map((item) => (
                  <div key={item.status} className="border rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">
                      {STATUS_MAP[item.status] || item.status}
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {item.count}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">暂无统计数据</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
