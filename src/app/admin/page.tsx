'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice } from '@/lib/utils'
import { handleApiError } from '@/lib/error-handler'

interface Stats {
  totalUsers: number
  totalOrders: number
  activeOrders: number
  completedOrders: number
  pendingDisputes: number
  totalRevenue: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalOrders: 0,
    activeOrders: 0,
    completedOrders: 0,
    pendingDisputes: 0,
    totalRevenue: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // ✅ 内存泄漏防护: 使用AbortController取消未完成的请求
    const controller = new AbortController()

    fetchStats(controller.signal)

    return () => {
      controller.abort()
    }
  }, [])

  const fetchStats = async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch('/api/admin/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal // 传递AbortSignal
      })

      // ✅ 统一错误处理: 检查HTTP状态码
      if (!response.ok) {
        handleApiError(response, '获取统计数据')
        return
      }

      const data = await response.json()

      if (data.success) {
        setStats(data.data)
      } else {
        handleApiError(data, '获取统计数据')
      }
    } catch (error) {
      // 忽略AbortError（组件卸载时的正常取消）
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('获取统计数据错误:', error)
      handleApiError(error, '获取统计数据')
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: '总用户数',
      value: stats.totalUsers,
      description: '平台注册用户总数',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: '总订单数',
      value: stats.totalOrders,
      description: '所有订单数量',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: '进行中订单',
      value: stats.activeOrders,
      description: '正在进行的订单',
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    },
    {
      title: '已完成订单',
      value: stats.completedOrders,
      description: '已成功完成的订单',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: '待处理申诉',
      value: stats.pendingDisputes,
      description: '需要处理的申诉',
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: '平台总收益',
      value: formatPrice(Number(stats.totalRevenue)),
      description: '累计手续费收入',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">加载统计数据...</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">数据面板</h1>
        <p className="text-gray-600 mt-2">平台运营数据概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="pb-3">
              <CardDescription>{stat.description}</CardDescription>
              <CardTitle className="text-2xl">{stat.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stat.color}`}>
                {stat.value}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 快捷操作 */}
      <Card>
        <CardHeader>
          <CardTitle>快捷操作</CardTitle>
          <CardDescription>常用管理功能</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/admin/users"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center transition-colors"
            >
              <div className="text-2xl mb-2">👥</div>
              <div className="font-medium">用户管理</div>
            </a>
            <a
              href="/admin/orders"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center transition-colors"
            >
              <div className="text-2xl mb-2">📦</div>
              <div className="font-medium">订单管理</div>
            </a>
            <a
              href="/admin/disputes"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center transition-colors"
            >
              <div className="text-2xl mb-2">⚠️</div>
              <div className="font-medium">申诉处理</div>
            </a>
            <a
              href="/admin/settings"
              className="p-4 border rounded-lg hover:bg-gray-50 text-center transition-colors"
            >
              <div className="text-2xl mb-2">⚙️</div>
              <div className="font-medium">系统设置</div>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
