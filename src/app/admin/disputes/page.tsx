'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate, formatPrice } from '@/lib/utils'
import { sanitizeText } from '@/lib/sanitize'
import { handleApiError } from '@/lib/error-handler'
import { toast } from 'sonner'
import { DisputeActionSchema } from '@/lib/validations/admin'

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

  const fetchDisputes = useCallback(async (signal?: AbortSignal) => {
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
        },
        signal // 传递AbortSignal
      })

      // ✅ 统一错误处理: 检查HTTP状态码
      if (!response.ok) {
        handleApiError(response, '获取申诉列表')
        return
      }

      const data = await response.json()

      if (data.success) {
        setDisputes(data.data || [])
      } else {
        handleApiError(data, '获取申诉列表')
      }
    } catch (error) {
      // 忽略AbortError（组件卸载或快速切换筛选时的正常取消）
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      console.error('获取申诉列表错误:', error)
      handleApiError(error, '获取申诉列表')
    } finally {
      setLoading(false)
    }
  }, [statusFilter]) // 添加依赖

  useEffect(() => {
    // ✅ 内存泄漏防护: 使用AbortController取消未完成的请求
    const controller = new AbortController()

    fetchDisputes(controller.signal)

    return () => {
      controller.abort()
    }
  }, [fetchDisputes]) // 使用fetchDisputes作为依赖

  const handleAction = async () => {
    if (!selectedDispute) return

    // ✅ 输入验证: 使用Zod schema验证表单数据
    const validation = DisputeActionSchema.safeParse({
      action: actionType,
      resolution
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

      const response = await fetch(`/api/admin/disputes/${selectedDispute.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(validation.data)
      })

      // ✅ 统一错误处理: 检查HTTP状态码
      if (!response.ok) {
        handleApiError(response, '处理申诉')
        return
      }

      const data = await response.json()

      if (data.success) {
        toast.success('处理成功', {
          description: data.message || `已${actionType === 'approve' ? '同意' : '拒绝'}申诉`
        })
        setShowDialog(false)
        setSelectedDispute(null)
        setResolution('')
        fetchDisputes()
      } else {
        handleApiError(data, '处理申诉')
      }
    } catch (error) {
      console.error('处理申诉错误:', error)
      handleApiError(error, '处理申诉')
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
                      {/* ✅ XSS防护: 清理用户输入数据 */}
                      {sanitizeText(dispute.initiator.name) || '未命名'} ({sanitizeText(dispute.initiator.email)})
                    </p>
                    {dispute.initiator.phone && (
                      <p className="text-sm text-gray-600">{sanitizeText(dispute.initiator.phone)}</p>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-1">申诉原因</h4>
                    <p className="text-sm text-gray-900 font-medium">
                      {/* ✅ XSS防护: 清理用户输入数据 */}
                      {sanitizeText(dispute.reason)}
                    </p>
                  </div>
                </div>

                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">详细描述</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                    {/* ✅ XSS防护: 清理用户输入数据 */}
                    {sanitizeText(dispute.description)}
                  </p>
                </div>

                {dispute.resolution && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-700 mb-1">处理结果</h4>
                    <p className="text-sm text-gray-600 bg-green-50 p-3 rounded">
                      {/* ✅ XSS防护: 清理用户输入数据 */}
                      {sanitizeText(dispute.resolution)}
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
                      disabled={actionLoading}
                    >
                      同意申诉（退款给买家）
                    </Button>
                    <Button
                      onClick={() => openDialog(dispute, 'reject')}
                      variant="outline"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                      disabled={actionLoading}
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            // 点击背景关闭对话框
            if (e.target === e.currentTarget) {
              setShowDialog(false)
              setSelectedDispute(null)
              setResolution('')
            }
          }}
          onKeyDown={(e) => {
            // ✅ 无障碍性: Esc键关闭对话框
            if (e.key === 'Escape') {
              setShowDialog(false)
              setSelectedDispute(null)
              setResolution('')
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="dialog-title"
        >
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 id="dialog-title" className="text-lg font-medium mb-4">
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
              <label htmlFor="dispute-resolution" className="block text-sm font-medium mb-2">
                处理意见<span className="text-red-500">*</span>
              </label>
              <textarea
                id="dispute-resolution"
                className="w-full border rounded-md p-2 min-h-[100px]"
                placeholder="请填写处理意见..."
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                maxLength={1000}
                aria-describedby="resolution-char-count"
                aria-required="true"
              />
              <p id="resolution-char-count" className="text-xs text-gray-500 mt-1">
                {resolution.length}/1000 字符
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleAction}
                disabled={actionLoading}
                className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : ''}
                aria-label={actionType === 'approve' ? '确认同意申诉' : '确认拒绝申诉'}
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
