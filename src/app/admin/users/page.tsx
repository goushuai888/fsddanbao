'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatDate, formatPrice } from '@/lib/utils/helpers/common'
import { sanitizeText } from '@/lib/infrastructure/security/sanitize'
import { AdminFilters, FilterField } from '@/components/admin/AdminFilters'
import { useApiData } from '@/hooks/useApiData'

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
  // 筛选状态
  const [filters, setFilters] = useState({
    role: 'all',
    verified: 'all',
    search: ''
  })

  // 使用通用数据获取 Hook
  const { data: users, loading } = useApiData<User>({
    url: '/api/admin/users',
    params: filters
  })

  // 筛选字段配置
  const filterFields: FilterField[] = [
    {
      name: 'role',
      label: '用户角色',
      type: 'select',
      options: [
        { label: '全部角色', value: 'all' },
        { label: '买家', value: 'BUYER' },
        { label: '卖家', value: 'SELLER' },
        { label: '管理员', value: 'ADMIN' }
      ]
    },
    {
      name: 'verified',
      label: '认证状态',
      type: 'select',
      options: [
        { label: '全部状态', value: 'all' },
        { label: '已认证', value: 'true' },
        { label: '未认证', value: 'false' }
      ]
    },
    {
      name: 'search',
      label: '搜索用户',
      type: 'text',
      placeholder: '邮箱、姓名或手机号'
    }
  ]

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">用户管理</h1>
          <p className="text-gray-600 mt-2">管理平台用户信息</p>
        </div>
      </div>

      {/* 使用通用筛选组件 */}
      <AdminFilters
        title="筛选用户"
        fields={filterFields}
        values={filters}
        onChange={setFilters}
        className="mb-6"
      />

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
                        {sanitizeText(u.name || '未命名')}
                      </div>
                      <div className="text-sm text-gray-500">{sanitizeText(u.email)}</div>
                      {u.phone && (
                        <div className="text-xs text-gray-400">{sanitizeText(u.phone)}</div>
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
                    {formatPrice(Number(u.balance))}
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
    </div>
  )
}
