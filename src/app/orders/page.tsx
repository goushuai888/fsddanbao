'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Navbar } from '@/components/layout/Navbar'
import { OrderCard } from '@/components/orders/OrderCard'
import { OrderFilters } from '@/components/orders/OrderFilters'
import { EmptyState } from '@/components/orders/EmptyState'
import { OrderListSkeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useOrders } from '@/hooks/useOrders'
import { getViewConfig } from '@/lib/domain/policies/order-views'

export default function OrdersPage() {
  // Authentication
  const { user, isLoading: authLoading, logout } = useAuth(true)

  // Orders data and filters
  const {
    orders,
    isLoading: ordersLoading,
    filterType,
    statusFilter,
    setFilterType,
    setStatusFilter
  } = useOrders({
    initialFilterType: 'market',  // 默认显示市场浏览
    initialStatusFilter: 'all',  // 默认显示全部状态的订单
    autoFetch: true
  })

  // 获取当前视图配置
  const viewConfig = getViewConfig(filterType)

  // 处理订单类型切换
  const handleFilterTypeChange = (type: typeof filterType) => {
    setFilterType(type)
    // 根据视图配置自动切换默认状态
    const newConfig = getViewConfig(type)
    setStatusFilter(newConfig.defaultStatus)
    // ✅ 状态自动保存到 localStorage（在 useOrders hook 中）
  }

  // 处理状态筛选切换
  const handleStatusFilterChange = (status: typeof statusFilter) => {
    setStatusFilter(status)
    // ✅ 状态自动保存到 localStorage（在 useOrders hook 中）
  }

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Navigation */}
      <Navbar user={user} onLogout={logout} />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              订单管理
            </h1>
            <p className="text-gray-600">
              管理您的FSD权限转让订单
            </p>
          </div>
          <Link href="/orders/create">
            <Button size="lg" className="shadow-md hover:shadow-lg transition-shadow">
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              发布FSD转让
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <OrderFilters
            filterType={filterType}
            statusFilter={statusFilter}
            onFilterTypeChange={handleFilterTypeChange}
            onStatusFilterChange={handleStatusFilterChange}
          />
        </div>

        {/* 市场浏览视觉提示 */}
        {filterType === 'market' && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <div>
                <span className="font-medium">浏览在售订单</span>
                <p className="text-sm text-green-600 mt-0.5">
                  所有显示的订单均为可购买状态
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Orders List */}
        {ordersLoading ? (
          <div className="mb-8">
            <OrderListSkeleton count={6} />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title={viewConfig.emptyMessage}
            description={viewConfig.emptyDescription}
            actionLabel={filterType === 'market' || filterType === 'all' ? '发布第一个订单' : undefined}
            actionHref={filterType === 'market' || filterType === 'all' ? '/orders/create' : undefined}
          />
        ) : (
          <>
            {/* Orders Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {orders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  currentUserId={user?.id}  // 传递当前用户ID以计算角色
                  hideStatus={viewConfig.hideStatus}  // 使用配置决定是否隐藏状态
                />
              ))}
            </div>

            {/* Results Summary */}
            <div className="text-center text-sm text-gray-600">
              共找到 <span className="font-semibold text-blue-600">{orders.length}</span> 个订单
            </div>
          </>
        )}
      </main>
    </div>
  )
}
