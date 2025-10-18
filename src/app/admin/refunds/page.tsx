'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice } from '@/lib/utils'
import { sanitizeText } from '@/lib/sanitize'
import { handleApiError } from '@/lib/error-handler'
import { toast } from 'sonner'
import { RefundActionSchema } from '@/lib/validations/admin'

interface RefundRequest {
  id: string
  orderNo: string
  status: string
  price: number
  escrowAmount: number | null
  vehicleBrand: string
  vehicleModel: string
  refundReason: string | null
  refundRequestedAt: string | null
  refundStatus: string | null
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
}

const REFUND_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'bg-orange-100 text-orange-800' },
  APPROVED: { label: '已同意', color: 'bg-green-100 text-green-800' },
  REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-800' }
}

export default function AdminRefundsPage() {
  const [refunds, setRefunds] = useState<RefundRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedRefund, setSelectedRefund] = useState<RefundRequest | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [note, setNote] = useState('')
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchRefunds = useCallback(async (signal?: AbortSignal) => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/admin/refunds'
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        signal // 传递AbortSignal
      })

      // ✅ 统一错误处理: 检查HTTP状态码
      if (!response.ok) {
        handleApiError(response, '获取退款申请列表')
        return
      }

      const data = await response.json()

      if (data.success) {
        setRefunds(data.data || [])
      } else {
        handleApiError(data, '获取退款申请列表')
      }
    } catch (error) {
      // 忽略AbortError（组件卸载或快速切换筛选时的正常取消）
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('获取退款申请列表错误:', error)
      handleApiError(error, '获取退款申请列表')
    } finally {
      setLoading(false)
    }
  }, [statusFilter]) // 添加依赖

  useEffect(() => {
    // ✅ 内存泄漏防护: 使用AbortController取消未完成的请求
    const controller = new AbortController()

    fetchRefunds(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchRefunds]) // 使用fetchRefunds作为依赖

  const handleAction = async () => {
    if (!selectedRefund) return

    // ✅ 输入验证: 使用Zod schema验证表单数据
    const validation = RefundActionSchema.safeParse({
      action: actionType,
      note
    })

    if (!validation.success) {
      const errorMessage = validation.error.errors[0]?.message || '输入验证失败'
      toast.error('输入错误', {
        description: errorMessage
      })
      return
    }

    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/admin/refunds/${selectedRefund.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(validation.data)
      })

      // ✅ 统一错误处理: 检查HTTP状态码
      if (!response.ok) {
        handleApiError(response, '处理退款申请')
        return
      }

      const data = await response.json()

      if (data.success) {
        toast.success('处理成功', {
          description: data.message || `已${actionType === 'approve' ? '同意' : '拒绝'}退款申请`
        })
        setShowDialog(false)
        setSelectedRefund(null)
        setNote('')
        fetchRefunds()
      } else {
        handleApiError(data, '处理退款申请')
      }
    } catch (error) {
      console.error('处理退款申请错误:', error)
      handleApiError(error, '处理退款申请')
    } finally {
      setActionLoading(false)
    }
  }

  const openDialog = (refund: RefundRequest, type: 'approve' | 'reject') => {
    setSelectedRefund(refund)
    setActionType(type)
    setShowDialog(true)
    setNote('')
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">退款管理</h1>
          <p className="text-gray-600 mt-2">审核和处理买家退款申请</p>
        </div>
      </div>

      {/* 筛选 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选退款申请</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">退款状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="PENDING">待处理</option>
                <option value="APPROVED">已同意</option>
                <option value="REJECTED">已拒绝</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 退款申请列表 */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : refunds.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">暂无退款申请</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {refunds.map((refund) => (
            <Card key={refund.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        订单 #{refund.orderNo}
                      </h3>
                      {refund.refundStatus && (
                        <span className={`px-2 py-1 rounded text-xs font-medium ${REFUND_STATUS_MAP[refund.refundStatus]?.color}`}>
                          {REFUND_STATUS_MAP[refund.refundStatus]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {refund.vehicleBrand} {refund.vehicleModel} - {formatPrice(refund.price)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {refund.refundRequestedAt && (
                      <div>申请时间：{formatDate(refund.refundRequestedAt)}</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  {/* 卖家信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">卖家</h4>
                    <p className="text-sm text-gray-600">
                      {/* ✅ XSS防护: 清理用户输入数据 */}
                      {sanitizeText(refund.seller.name) || '未命名'} ({sanitizeText(refund.seller.email)})
                    </p>
                    {refund.seller.phone && (
                      <p className="text-xs text-gray-500">{sanitizeText(refund.seller.phone)}</p>
                    )}
                  </div>

                  {/* 买家信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">买家（申请人）</h4>
                    {refund.buyer ? (
                      <>
                        <p className="text-sm text-gray-600">
                          {/* ✅ XSS防护: 清理用户输入数据 */}
                          {sanitizeText(refund.buyer.name) || '未命名'} ({sanitizeText(refund.buyer.email)})
                        </p>
                        {refund.buyer.phone && (
                          <p className="text-xs text-gray-500">{sanitizeText(refund.buyer.phone)}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-400">暂无买家信息</p>
                    )}
                  </div>
                </div>

                {/* 退款原因 */}
                {refund.refundReason && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">退款原因</h4>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                      {/* ✅ XSS防护: 清理用户输入数据 */}
                      {sanitizeText(refund.refundReason)}
                    </p>
                  </div>
                )}

                {/* 操作按钮 */}
                {refund.refundStatus === 'PENDING' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => openDialog(refund, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                      disabled={actionLoading}
                    >
                      同意退款
                    </Button>
                    <Button
                      onClick={() => openDialog(refund, 'reject')}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      disabled={actionLoading}
                    >
                      拒绝退款
                    </Button>
                    <Link href={`/orders/${refund.id}`} className="ml-auto">
                      <Button variant="outline">查看订单详情</Button>
                    </Link>
                  </div>
                )}

                {refund.refundStatus !== 'PENDING' && (
                  <div className="pt-4 border-t">
                    <Link href={`/orders/${refund.id}`}>
                      <Button variant="outline">查看订单详情</Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 处理对话框 */}
      {showDialog && selectedRefund && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            // 点击背景关闭对话框
            if (e.target === e.currentTarget) {
              setShowDialog(false)
              setSelectedRefund(null)
              setNote('')
            }
          }}
          onKeyDown={(e) => {
            // ✅ 无障碍性: Esc键关闭对话框
            if (e.key === 'Escape') {
              setShowDialog(false)
              setSelectedRefund(null)
              setNote('')
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 id="dialog-title" className="text-lg font-medium mb-4">
              {actionType === 'approve' ? '同意退款' : '拒绝退款'}
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                订单：#{selectedRefund.orderNo}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {actionType === 'approve'
                  ? '同意退款后，订单将被取消，款项退还给买家'
                  : '拒绝退款后，订单将保持已支付状态'}
              </p>
              <label htmlFor="refund-note" className="block text-sm font-medium mb-2">
                备注（可选）
              </label>
              <textarea
                id="refund-note"
                className="w-full border rounded-md p-2 min-h-[100px]"
                placeholder="请填写处理说明..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                aria-describedby="note-char-count"
              />
              <p id="note-char-count" className="text-xs text-gray-500 mt-1">
                {note.length}/500 字符
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAction}
                disabled={actionLoading}
                className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                aria-label={actionType === 'approve' ? '确认同意退款' : '确认拒绝退款'}
              >
                {actionLoading ? '处理中...' : '确认'}
              </Button>
              <Button
                onClick={() => {
                  setShowDialog(false)
                  setSelectedRefund(null)
                  setNote('')
                }}
                variant="outline"
                disabled={actionLoading}
                aria-label="取消操作"
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
