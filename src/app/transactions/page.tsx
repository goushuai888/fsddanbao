'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/layout/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatPrice } from '@/lib/utils/helpers/common'
import { sanitizeText } from '@/lib/infrastructure/security/sanitize'

interface Transaction {
  id: string
  amount: number
  type: 'ESCROW' | 'RELEASE' | 'REFUND' | 'WITHDRAW' | 'ADMIN_ADJUSTMENT'
  status: string
  note: string | null
  createdAt: string
  // ✅ 新增：审计字段
  performedBy: string | null
  metadata: any | null
  withdrawalId: string | null
  // ✅ 新增：关联对象
  order?: {
    id: string
    orderNo: string
    vehicleBrand: string
    vehicleModel: string
    status: string
  }
  withdrawal?: {
    id: string
    withdrawMethod: string
    status: string
    amount: number
    actualAmount: number
    createdAt: string
    completedAt: string | null
  }
  performedByUser?: {
    id: string
    name: string | null
    email: string
    role: string
  }
}

interface TransactionResponse {
  transactions: Transaction[]
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}

// 账务类型映射
const TRANSACTION_TYPE_MAP: Record<string, { label: string; color: string; sign: string }> = {
  ESCROW: { label: '支付购买', color: 'text-red-600', sign: '-' },
  RELEASE: { label: '收款入账', color: 'text-green-600', sign: '+' },
  REFUND: { label: '退款到账', color: 'text-green-600', sign: '+' },
  WITHDRAW: { label: '提现扣除', color: 'text-red-600', sign: '-' },
  ADMIN_ADJUSTMENT: { label: '管理员调账', color: 'text-blue-600', sign: '+' }
}

// 提现方式映射
const WITHDRAW_METHOD_MAP: Record<string, string> = {
  bank: '银行卡',
  alipay: '支付宝',
  wechat: '微信'
}

export default function TransactionsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, logout } = useAuth(true)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [currentBalance, setCurrentBalance] = useState<number>(0)  // ✅ 添加当前余额状态
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  })
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())  // 最后更新时间

  // 获取账务记录
  const fetchTransactions = async (offset = 0) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = `/api/user/transactions?limit=20&offset=${offset}`
      if (typeFilter !== 'all') {
        url += `&type=${typeFilter}`
      }

      // ✅ 添加时间戳防止缓存
      url += `&_t=${Date.now()}`

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        // ✅ 强制不使用缓存
        cache: 'no-store'
      })

      if (!response.ok) {
        if (response.status === 401) {
          alert('登录已过期，请重新登录')
          router.push('/login')
          return
        }
        throw new Error('获取账务记录失败')
      }

      const data = await response.json()

      if (data.success) {
        setTransactions(data.data.transactions)
        setPagination(data.data.pagination)

        // ✅ 从API响应中获取最新余额
        if (data.data.balance !== undefined) {
          setCurrentBalance(Number(data.data.balance))
        }

        // ✅ 更新最后刷新时间
        setLastUpdate(new Date())
      } else {
        alert(data.error || '获取账务记录失败')
      }
    } catch (error) {
      console.error('获取账务记录错误:', error)
      alert('获取账务记录失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!authLoading && user) {
      fetchTransactions()
    }
  }, [authLoading, user, typeFilter])

  // ✅ 自动刷新：每30秒刷新一次数据
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      fetchTransactions(pagination.offset)
    }, 30000) // 30秒

    return () => clearInterval(interval)
  }, [user, pagination.offset, typeFilter])

  // ✅ 页面可见性检测：用户回到页面时自动刷新
  useEffect(() => {
    if (!user) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchTransactions(pagination.offset)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, pagination.offset, typeFilter])

  // 权限检查
  useEffect(() => {
    if (!authLoading && !user) {
      alert('请先登录')
      router.push('/login')
    }
  }, [authLoading, user, router])

  // 加载下一页
  const loadMore = () => {
    if (!pagination.hasMore) return
    fetchTransactions(pagination.offset + pagination.limit)
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 导航栏 */}
      <Navbar user={user} onLogout={logout} />

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 标题和余额 */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  账务记录
                </h1>
                <p className="text-gray-600">
                  查看您的所有账户变动明细
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-600">当前余额</p>
                <p className="text-2xl font-bold text-blue-600">
                  {formatPrice(currentBalance)}
                </p>
              </div>
            </div>

            {/* 类型筛选 */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={typeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('all')}
                    size="sm"
                  >
                    全部
                  </Button>
                  <Button
                    variant={typeFilter === 'ESCROW' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('ESCROW')}
                    size="sm"
                  >
                    支付购买
                  </Button>
                  <Button
                    variant={typeFilter === 'RELEASE' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('RELEASE')}
                    size="sm"
                  >
                    收款入账
                  </Button>
                  <Button
                    variant={typeFilter === 'REFUND' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('REFUND')}
                    size="sm"
                  >
                    退款到账
                  </Button>
                  <Button
                    variant={typeFilter === 'WITHDRAW' ? 'default' : 'outline'}
                    onClick={() => setTypeFilter('WITHDRAW')}
                    size="sm"
                  >
                    提现扣除
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 账务记录列表 */}
          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-gray-500">暂无账务记录</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="space-y-4 mb-6">
                {transactions.map((transaction) => {
                  const typeInfo = TRANSACTION_TYPE_MAP[transaction.type]
                  return (
                    <Card key={transaction.id}>
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2 flex-wrap">
                              <h3 className="text-lg font-semibold">
                                {typeInfo.label}
                              </h3>
                              <span className={`text-xl font-bold ${typeInfo.color}`}>
                                {typeInfo.sign}{formatPrice(transaction.amount)}
                              </span>

                              {/* ✅ 管理员操作徽章 */}
                              {transaction.performedByUser && transaction.performedByUser.role === 'ADMIN' && (
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                  管理员操作
                                </span>
                              )}
                            </div>

                            {/* ✅ 操作人信息 */}
                            {transaction.performedByUser && (
                              <div className="text-sm text-gray-600 mb-2">
                                操作人：{transaction.performedByUser.name || transaction.performedByUser.email}
                              </div>
                            )}

                            {/* ✅ 元数据显示（调账原因等） */}
                            {transaction.metadata && transaction.metadata.reason && (
                              <div className="text-sm text-gray-700 mb-2 bg-blue-50 px-3 py-2 rounded">
                                <span className="font-medium">原因：</span>
                                {sanitizeText(transaction.metadata.reason)}
                              </div>
                            )}

                            {/* 关联订单 */}
                            {transaction.order && (
                              <div className="text-sm text-gray-600 mb-2">
                                <Link
                                  href={`/orders/${transaction.order.id}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  订单 #{transaction.order.orderNo}
                                </Link>
                                {' '} - {transaction.order.vehicleBrand} {transaction.order.vehicleModel}
                              </div>
                            )}

                            {/* ✅ 提现详情 */}
                            {transaction.withdrawal && (
                              <div className="text-sm bg-gray-50 px-3 py-2 rounded mb-2 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">提现方式：</span>
                                  <span className="font-medium">{WITHDRAW_METHOD_MAP[transaction.withdrawal.withdrawMethod] || transaction.withdrawal.withdrawMethod}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">提现状态：</span>
                                  <span className={`font-medium ${
                                    transaction.withdrawal.status === 'COMPLETED' ? 'text-green-600' :
                                    transaction.withdrawal.status === 'PENDING' ? 'text-yellow-600' :
                                    transaction.withdrawal.status === 'APPROVED' ? 'text-blue-600' :
                                    'text-red-600'
                                  }`}>
                                    {transaction.withdrawal.status === 'COMPLETED' ? '已完成' :
                                     transaction.withdrawal.status === 'PENDING' ? '待审核' :
                                     transaction.withdrawal.status === 'APPROVED' ? '已批准' :
                                     transaction.withdrawal.status === 'REJECTED' ? '已拒绝' :
                                     transaction.withdrawal.status === 'FAILED' ? '已失败' : transaction.withdrawal.status}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">申请金额：</span>
                                  <span className="font-medium">{formatPrice(transaction.withdrawal.amount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-gray-600">到账金额：</span>
                                  <span className="font-medium text-green-600">{formatPrice(transaction.withdrawal.actualAmount)}</span>
                                </div>
                                {transaction.withdrawal.completedAt && (
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-600">完成时间：</span>
                                    <span className="text-xs">{formatDate(transaction.withdrawal.completedAt)}</span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 备注 */}
                            {transaction.note && (
                              <p className="text-sm text-gray-600">
                                {sanitizeText(transaction.note)}
                              </p>
                            )}

                            {/* 时间 */}
                            <p className="text-xs text-gray-500 mt-2">
                              {formatDate(transaction.createdAt)}
                            </p>
                          </div>

                          {/* 状态 */}
                          <div className="ml-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              transaction.status === 'COMPLETED'
                                ? 'bg-green-100 text-green-800'
                                : transaction.status === 'PENDING'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}>
                              {transaction.status === 'COMPLETED' ? '已完成' :
                               transaction.status === 'PENDING' ? '处理中' : '已取消'}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>

              {/* 分页 */}
              {pagination.hasMore && (
                <div className="text-center">
                  <Button
                    onClick={loadMore}
                    variant="outline"
                    disabled={loading}
                  >
                    {loading ? '加载中...' : '加载更多'}
                  </Button>
                  <p className="text-sm text-gray-600 mt-2">
                    已显示 {transactions.length} / {pagination.total} 条记录
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
