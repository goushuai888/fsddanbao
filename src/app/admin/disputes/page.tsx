'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice } from '@/lib/utils'

interface Dispute {
  id: string
  orderId: string
  reason: string
  description: string
  status: string
  evidence: string | null
  resolution: string | null
  resolvedBy: string | null
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
  order: {
    id: string
    orderNo: string
    status: string
    price: number
    vehicleBrand: string
    vehicleModel: string
  }
  initiator: {
    id: string
    name: string | null
    email: string
    phone: string | null
  }
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待处理', color: 'bg-orange-100 text-orange-800' },
  PROCESSING: { label: '处理中', color: 'bg-blue-100 text-blue-800' },
  RESOLVED: { label: '已解决', color: 'bg-green-100 text-green-800' },
  CLOSED: { label: '已关闭', color: 'bg-gray-100 text-gray-800' }
}

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null)
  const [showDialog, setShowDialog] = useState(false)
  const [resolution, setResolution] = useState('')
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve')
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => {
    fetchDisputes()
  }, [statusFilter])

  const fetchDisputes = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      let url = '/api/admin/disputes'
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
        setDisputes(data.data || [])
      } else {
        alert(data.error || '获取申诉列表失败')
      }
    } catch (error) {
      console.error('获取申诉列表错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async () => {
    if (!selectedDispute) return

    if (!resolution.trim()) {
      alert('请填写处理意见')
      return
    }

    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/admin/disputes/${selectedDispute.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: actionType,
          resolution
        })
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || '处理成功')
        setShowDialog(false)
        setSelectedDispute(null)
        setResolution('')
        fetchDisputes()
      } else {
        alert(data.error || '处理失败')
      }
    } catch (error) {
      console.error('处理申诉错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setActionLoading(false)
    }
  }

  const openDialog = (dispute: Dispute, type: 'approve' | 'reject') => {
    setSelectedDispute(dispute)
    setActionType(type)
    setShowDialog(true)
    setResolution('')
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">申诉管理</h1>
          <p className="text-gray-600 mt-2">处理买家申诉和纠纷</p>
        </div>
      </div>

      {/* 筛选 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选申诉</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">申诉状态</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">全部状态</option>
                <option value="PENDING">待处理</option>
                <option value="PROCESSING">处理中</option>
                <option value="RESOLVED">已解决</option>
                <option value="CLOSED">已关闭</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 申诉列表 */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : disputes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">暂无申诉数据</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <Card key={dispute.id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">
                        订单 #{dispute.order.orderNo}
                      </h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[dispute.status]?.color}`}>
                        {STATUS_MAP[dispute.status]?.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      {dispute.order.vehicleBrand} {dispute.order.vehicleModel} - {formatPrice(dispute.order.price)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <div>申诉时间：{formatDate(dispute.createdAt)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">申诉人信息</h4>
                    <p className="text-sm text-gray-600">
                      {dispute.initiator.name || '未命名'} ({dispute.initiator.email})
                    </p>
                    {dispute.initiator.phone && (
                      <p className="text-sm text-gray-600">{dispute.initiator.phone}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">申诉原因</h4>
                    <p className="text-sm text-gray-900 font-medium">{dispute.reason}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">详细描述</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {dispute.description}
                  </p>
                </div>

                {dispute.resolution && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">处理结果</h4>
                    <p className="text-sm text-gray-600 bg-green-50 p-3 rounded">
                      {dispute.resolution}
                    </p>
                    {dispute.resolvedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        处理时间：{formatDate(dispute.resolvedAt)}
                      </p>
                    )}
                  </div>
                )}

                {dispute.status === 'PENDING' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      onClick={() => openDialog(dispute, 'approve')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      同意申诉（退款给买家）
                    </Button>
                    <Button
                      onClick={() => openDialog(dispute, 'reject')}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      拒绝申诉（释放款项给卖家）
                    </Button>
                    <Link href={`/orders/${dispute.order.id}`} className="ml-auto">
                      <Button variant="outline">查看订单详情</Button>
                    </Link>
                  </div>
                )}

                {dispute.status !== 'PENDING' && (
                  <div className="pt-4 border-t">
                    <Link href={`/orders/${dispute.order.id}`}>
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
      {showDialog && selectedDispute && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">
              {actionType === 'approve' ? '同意申诉' : '拒绝申诉'}
            </h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">
                订单：#{selectedDispute.order.orderNo}
              </p>
              <p className="text-sm text-gray-600 mb-4">
                {actionType === 'approve'
                  ? '同意申诉后，订单将被取消，款项退还给买家'
                  : '拒绝申诉后，订单将标记为完成，款项释放给卖家'}
              </p>
              <label className="block text-sm font-medium mb-2">处理意见</label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[100px]"
                placeholder="请填写处理意见..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
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
                  setSelectedDispute(null)
                  setResolution('')
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
