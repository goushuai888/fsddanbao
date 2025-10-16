'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice } from '@/lib/utils'

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

  useEffect(() => {
    fetchRefunds()
  }, [statusFilter])

  const fetchRefunds = async () => {
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
        }
      })

      const data = await response.json()

      if (data.success) {
        setRefunds(data.data || [])
      } else {
        alert(data.error || '获取退款申请列表失败')
      }
    } catch (error) {
      console.error('获取退款申请列表错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!selectedRefund) return

    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/admin/refunds/${selectedRefund.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: actionType,
          note
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || '处理成功')
        setShowDialog(false)
        setSelectedRefund(null)
        setNote('')
        fetchRefunds()
      } else {
        alert(data.error || '处理失败')
      }
    } catch (error) {
      console.error('处理退款申请错误:', error)
      alert('网络错误，请稍后重试')
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
                      {refund.seller.name || '未命名'} ({refund.seller.email})
                    </p>
                    {refund.seller.phone && (
                      <p className="text-xs text-gray-500">{refund.seller.phone}</p>
                    )}
                  </div>

                  {/* 买家信息 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">买家（申请人）</h4>
                    {refund.buyer ? (
                      <>
                        <p className="text-sm text-gray-600">
                          {refund.buyer.name || '未命名'} ({refund.buyer.email})
                        </p>
                        {refund.buyer.phone && (
                          <p className="text-xs text-gray-500">{refund.buyer.phone}</p>
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
                      {refund.refundReason}
                    </p>
                  </div>
                )}

                {/* 操作按钮 */}
                {refund.refundStatus === 'PENDING' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => openDialog(refund, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      同意退款
                    </Button>
                    <Button
                      onClick={() => openDialog(refund, 'reject')}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
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
              <label className="block text-sm font-medium mb-2">备注（可选）</label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[100px]"
                placeholder="请填写处理说明..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAction}
                disabled={actionLoading}
                className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
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
