'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/layout/Navbar'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, formatPrice } from '@/lib/utils'
import { sanitizeText } from '@/lib/sanitize'

interface Transaction {
  id: string
  amount: number
  type: 'ESCROW' | 'RELEASE' | 'REFUND' | 'WITHDRAW'
  status: string
  note: string | null
  createdAt: string
  order?: {
    id: string
    orderNo: string
    vehicleBrand: string
    vehicleModel: string
    status: string
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
  WITHDRAW: { label: '提现扣除', color: 'text-red-600', sign: '-' }
}

export default function TransactionsPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, logout } = useAuth(true)

  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [pagination, setPagination] = useState({
    total: 0,
    limit: 20,
    offset: 0,
    hasMore: false
  })

  // 获取账务记录
  const fetchTransactions = async (offset = 0) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = `/api/user/transactions?limit=20&offset=${offset}`
      if (typeFilter !== 'all') {
        url += `&type=${typeFilter}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
                  ¥{Number(user?.balance || 0).toFixed(2)}
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
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">
                                {typeInfo.label}
                              </h3>
                              <span className={`text-xl font-bold ${typeInfo.color}`}>
                                {typeInfo.sign}{formatPrice(transaction.amount)}
                              </span>
                            </div>

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
