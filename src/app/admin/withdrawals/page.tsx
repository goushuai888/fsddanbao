'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatDate, formatPrice } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'

interface Withdrawal {
  id: string
  amount: number
  fee: number
  actualAmount: number
  withdrawMethod: string
  bankName: string | null
  bankAccount: string | null
  accountName: string | null
  alipayAccount: string | null
  wechatAccount: string | null
  status: string
  reviewedBy: string | null
  reviewNote: string | null
  rejectReason: string | null
  reviewedAt: string | null
  transactionId: string | null
  completedAt: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    email: string
    phone: string | null
    balance: number
  }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '已批准', color: 'bg-blue-100 text-blue-800' },
  REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  PROCESSING: { label: '处理中', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  FAILED: { label: '失败', color: 'bg-gray-100 text-gray-800' }
}

const METHOD_MAP: Record<string, string> = {
  bank: '银行转账',
  alipay: '支付宝',
  wechat: '微信'
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  // 审核对话框状态
  const [reviewDialog, setReviewDialog] = useState(false)
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null)
  const [reviewNote, setReviewNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchWithdrawals()
  }, [statusFilter, searchQuery, startDate, endDate])

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/admin/withdrawals'
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
        setWithdrawals(data.data || [])
      } else {
        alert(data.error || '获取提现申请失败')
      }
    } catch (error) {
      console.error('获取提现申请错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleReview = async (action: string) => {
    if (!selectedWithdrawal) return

    try {
      setProcessing(true)
      const token = localStorage.getItem('token')

      const body: any = { action }
      if (reviewNote) body.reviewNote = reviewNote
      if (action === 'reject' && !rejectReason) {
        alert('请填写拒绝原因')
        return
      }
      if (action === 'reject') body.rejectReason = rejectReason
      if (action === 'complete' && !transactionId) {
        alert('请填写交易ID')
        return
      }
      if (action === 'complete') body.transactionId = transactionId

      const response = await fetch(`/api/admin/withdrawals/${selectedWithdrawal.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message)
        setReviewDialog(false)
        setSelectedWithdrawal(null)
        setReviewNote('')
        setRejectReason('')
        setTransactionId('')
        fetchWithdrawals()
      } else {
        alert(data.error || '操作失败')
      }
    } catch (error) {
      console.error('审核提现申请错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setProcessing(false)
    }
  }

  const openReviewDialog = (withdrawal: Withdrawal) => {
    setSelectedWithdrawal(withdrawal)
    setReviewDialog(true)
    setReviewNote('')
    setRejectReason('')
    setTransactionId('')
  }

  // 计算统计数据
  const stats = {
    total: withdrawals.length,
    pending: withdrawals.filter(w => w.status === 'PENDING').length,
    approved: withdrawals.filter(w => w.status === 'APPROVED').length,
    completed: withdrawals.filter(w => w.status === 'COMPLETED').length,
    totalAmount: withdrawals.reduce((sum, w) => {
      if (w.status === 'COMPLETED') return sum + w.amount
      return sum
    }, 0)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">提现审核</h1>
          <p className="text-gray-600 mt-2">审核和处理用户提现申请</p>
        </div>
      </div>

      {/* 筛选和搜索 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选提现申请</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 状态筛选 */}
            <div>
              <label className="block text-sm font-medium mb-2">申请状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="PENDING">待审核</option>
                <option value="APPROVED">已批准</option>
                <option value="PROCESSING">处理中</option>
                <option value="COMPLETED">已完成</option>
                <option value="REJECTED">已拒绝</option>
                <option value="FAILED">失败</option>
              </select>
            </div>

            {/* 搜索 */}
            <div>
              <label className="block text-sm font-medium mb-2">搜索</label>
              <Input
                type="text"
                placeholder="用户邮箱/交易ID"
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
      {!loading && withdrawals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">总申请数</div>
              <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">待审核</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">已批准</div>
              <div className="text-2xl font-bold text-blue-600">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">已完成</div>
              <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-gray-600">已完成总额</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatPrice(stats.totalAmount)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 提现申请列表 */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : withdrawals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">暂无提现申请</p>
          </CardContent>
        </Card>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  申请时间
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  用户
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  提现信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  收款信息
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状态
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {withdrawals.map((withdrawal) => (
                <tr key={withdrawal.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(withdrawal.createdAt)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {withdrawal.user.name || '未命名'}
                    </div>
                    <div className="text-xs text-gray-500">{withdrawal.user.email}</div>
                    <div className="text-xs text-gray-500">
                      余额: {formatPrice(withdrawal.user.balance)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {formatPrice(withdrawal.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      手续费: {formatPrice(withdrawal.fee)}
                    </div>
                    <div className="text-xs text-green-600">
                      到账: {formatPrice(withdrawal.actualAmount)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">
                      {METHOD_MAP[withdrawal.withdrawMethod] || withdrawal.withdrawMethod}
                    </div>
                    {withdrawal.withdrawMethod === 'bank' && (
                      <div className="text-xs text-gray-500">
                        <div>{withdrawal.bankName}</div>
                        <div>{withdrawal.bankAccount}</div>
                        <div>{withdrawal.accountName}</div>
                      </div>
                    )}
                    {withdrawal.withdrawMethod === 'alipay' && (
                      <div className="text-xs text-gray-500">
                        {withdrawal.alipayAccount}
                      </div>
                    )}
                    {withdrawal.withdrawMethod === 'wechat' && (
                      <div className="text-xs text-gray-500">
                        {withdrawal.wechatAccount}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[withdrawal.status]?.color}`}>
                      {STATUS_MAP[withdrawal.status]?.label}
                    </span>
                    {withdrawal.rejectReason && (
                      <div className="text-xs text-red-600 mt-1">
                        {withdrawal.rejectReason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    {withdrawal.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(withdrawal)}
                      >
                        审核
                      </Button>
                    )}
                    {withdrawal.status === 'APPROVED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(withdrawal)}
                      >
                        处理
                      </Button>
                    )}
                    {withdrawal.status === 'PROCESSING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(withdrawal)}
                      >
                        处理
                      </Button>
                    )}
                    {(withdrawal.status === 'COMPLETED' || withdrawal.status === 'FAILED' || withdrawal.status === 'REJECTED') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openReviewDialog(withdrawal)}
                      >
                        查看详情
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 审核对话框 */}
      <Dialog open={reviewDialog} onOpenChange={setReviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>审核提现申请</DialogTitle>
            <DialogDescription>
              请仔细核对提现信息后进行审核操作
            </DialogDescription>
          </DialogHeader>

          {selectedWithdrawal && (
            <div className="space-y-4">
              {/* 用户信息 */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">用户信息</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>姓名: {selectedWithdrawal.user.name || '未命名'}</div>
                  <div>邮箱: {selectedWithdrawal.user.email}</div>
                  <div>电话: {selectedWithdrawal.user.phone || '未设置'}</div>
                  <div>余额: {formatPrice(selectedWithdrawal.user.balance)}</div>
                </div>
              </div>

              {/* 提现信息 */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">提现信息</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>提现金额: {formatPrice(selectedWithdrawal.amount)}</div>
                  <div>手续费: {formatPrice(selectedWithdrawal.fee)}</div>
                  <div className="text-green-600">
                    到账金额: {formatPrice(selectedWithdrawal.actualAmount)}
                  </div>
                  <div>
                    提现方式: {METHOD_MAP[selectedWithdrawal.withdrawMethod]}
                  </div>
                </div>
              </div>

              {/* 收款信息 */}
              <div className="border rounded-lg p-4">
                <h3 className="font-medium mb-2">收款信息</h3>
                <div className="text-sm space-y-1">
                  {selectedWithdrawal.withdrawMethod === 'bank' && (
                    <>
                      <div>银行: {selectedWithdrawal.bankName}</div>
                      <div>账号: {selectedWithdrawal.bankAccount}</div>
                      <div>户名: {selectedWithdrawal.accountName}</div>
                    </>
                  )}
                  {selectedWithdrawal.withdrawMethod === 'alipay' && (
                    <div>支付宝: {selectedWithdrawal.alipayAccount}</div>
                  )}
                  {selectedWithdrawal.withdrawMethod === 'wechat' && (
                    <div>微信: {selectedWithdrawal.wechatAccount}</div>
                  )}
                </div>
              </div>

              {/* 审核备注 */}
              <div>
                <label className="block text-sm font-medium mb-2">审核备注</label>
                <Textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="填写审核备注（可选）"
                  rows={3}
                />
              </div>

              {/* 根据状态显示不同的操作 */}
              {selectedWithdrawal.status === 'PENDING' && (
                <>
                  {/* 拒绝原因 */}
                  <div>
                    <label className="block text-sm font-medium mb-2">拒绝原因（拒绝时必填）</label>
                    <Textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="填写拒绝原因"
                      rows={2}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => handleReview('reject')}
                      disabled={processing}
                    >
                      拒绝
                    </Button>
                    <Button
                      onClick={() => handleReview('approve')}
                      disabled={processing}
                    >
                      批准
                    </Button>
                  </DialogFooter>
                </>
              )}

              {selectedWithdrawal.status === 'APPROVED' && (
                <>
                  {/* 交易ID */}
                  <div>
                    <label className="block text-sm font-medium mb-2">交易ID（完成时必填）</label>
                    <Input
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="填写支付平台的交易ID"
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => handleReview('processing')}
                      disabled={processing}
                    >
                      标记处理中
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleReview('fail')}
                      disabled={processing}
                    >
                      标记失败
                    </Button>
                    <Button
                      onClick={() => handleReview('complete')}
                      disabled={processing}
                    >
                      完成提现
                    </Button>
                  </DialogFooter>
                </>
              )}

              {selectedWithdrawal.status === 'PROCESSING' && (
                <>
                  {/* 交易ID */}
                  <div>
                    <label className="block text-sm font-medium mb-2">交易ID（完成时必填）</label>
                    <Input
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="填写支付平台的交易ID"
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      variant="destructive"
                      onClick={() => handleReview('fail')}
                      disabled={processing}
                    >
                      标记失败
                    </Button>
                    <Button
                      onClick={() => handleReview('complete')}
                      disabled={processing}
                    >
                      完成提现
                    </Button>
                  </DialogFooter>
                </>
              )}

              {/* 查看详情（终态状态：COMPLETED、FAILED、REJECTED） */}
              {(selectedWithdrawal.status === 'COMPLETED' ||
                selectedWithdrawal.status === 'FAILED' ||
                selectedWithdrawal.status === 'REJECTED') && (
                <>
                  <div className="space-y-4 text-sm">
                    {/* 交易ID - 只在已完成时显示 */}
                    {selectedWithdrawal.status === 'COMPLETED' && selectedWithdrawal.transactionId && (
                      <div className="bg-green-50 border border-green-200 rounded p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-green-900">交易ID</span>
                        </div>
                        <div className="text-green-800 font-mono text-base">
                          {selectedWithdrawal.transactionId}
                        </div>
                      </div>
                    )}

                    {/* 拒绝原因 - 只在已拒绝时显示 */}
                    {selectedWithdrawal.status === 'REJECTED' && selectedWithdrawal.rejectReason && (
                      <div className="bg-red-50 border border-red-200 rounded p-3">
                        <div className="font-medium text-red-900 mb-1">拒绝原因</div>
                        <div className="text-red-800">{selectedWithdrawal.rejectReason}</div>
                      </div>
                    )}

                    {/* 审核备注 */}
                    {selectedWithdrawal.reviewNote && (
                      <div className="bg-gray-50 border border-gray-200 rounded p-3">
                        <div className="font-medium text-gray-900 mb-1">审核备注</div>
                        <div className="text-gray-700">{selectedWithdrawal.reviewNote}</div>
                      </div>
                    )}

                    {/* 时间信息 */}
                    <div className="border-t pt-3 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">申请时间</span>
                        <span className="text-gray-900">{formatDate(selectedWithdrawal.createdAt)}</span>
                      </div>
                      {selectedWithdrawal.reviewedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">审核时间</span>
                          <span className="text-gray-900">{formatDate(selectedWithdrawal.reviewedAt)}</span>
                        </div>
                      )}
                      {selectedWithdrawal.completedAt && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">完成时间</span>
                          <span className="text-gray-900">{formatDate(selectedWithdrawal.completedAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setReviewDialog(false)}
                    >
                      关闭
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
