'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatPrice, formatDate, maskString } from '@/lib/utils'

interface Order {
  id: string
  orderNo: string
  status: string
  vehicleBrand: string
  vehicleModel: string
  vehicleYear: number
  vin: string | null
  fsdVersion: string
  price: number
  escrowAmount: number | null
  platformFee: number | null
  transferProof: string | null
  transferNote: string | null
  createdAt: string
  paidAt: string | null
  transferredAt: string | null
  completedAt: string | null
  refundRequested: boolean
  refundReason: string | null
  refundRequestedAt: string | null
  refundStatus: string | null
  seller: {
    id: string
    name: string
    email: string
    phone: string
    verified: boolean
  }
  buyer: {
    id: string
    name: string
    email: string
    phone: string
    verified: boolean
  } | null
  disputes?: Array<{
    id: string
    reason: string
    description: string
    status: string
    createdAt: string
    resolvedAt: string | null
  }>
}

const STATUS_MAP: Record<string, { label: string; color: string; description: string }> = {
  PUBLISHED: {
    label: '已发布',
    color: 'bg-blue-100 text-blue-800',
    description: '订单已发布，等待买家下单'
  },
  PAID: {
    label: '已支付',
    color: 'bg-green-100 text-green-800',
    description: '买家已付款到平台托管，等待卖家转移FSD权限'
  },
  TRANSFERRING: {
    label: '转移中',
    color: 'bg-yellow-100 text-yellow-800',
    description: '卖家已发起FSD权限转移，等待买家确认'
  },
  COMPLETED: {
    label: '已完成',
    color: 'bg-gray-100 text-gray-800',
    description: '交易已完成'
  },
  DISPUTE: {
    label: '申诉中',
    color: 'bg-orange-100 text-orange-800',
    description: '买家已发起申诉，平台正在处理中'
  },
  CANCELLED: {
    label: '已取消',
    color: 'bg-red-100 text-red-800',
    description: '订单已取消'
  }
}

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [transferProof, setTransferProof] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [refundReason, setRefundReason] = useState('')
  const [showDisputeDialog, setShowDisputeDialog] = useState(false)
  const [disputeDescription, setDisputeDescription] = useState('')

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      // 保存当前路径，登录后返回
      localStorage.setItem('redirectAfterLogin', `/orders/${orderId}`)
      alert('请先登录后再查看订单详情')
      router.push('/login')
      return
    }

    setUser(JSON.parse(userData))
    fetchOrderDetail()
  }, [orderId, router])

  const fetchOrderDetail = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch(`/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setOrder(data.data)
      } else {
        alert(data.error || '获取订单详情失败')
        router.push('/orders')
      }
    } catch (error) {
      console.error('获取订单详情错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (action: string, extraData?: any) => {
    // 退款申请和申诉不需要二次确认
    if (action !== 'request_refund' && action !== 'create_dispute') {
      if (!confirm(`确定要执行此操作吗？`)) {
        return
      }
    }

    try {
      setActionLoading(true)
      const token = localStorage.getItem('token')

      const body: any = { action, ...extraData }

      if (action === 'transfer') {
        if (!transferProof || !transferNote) {
          alert('请填写转移凭证和说明')
          setActionLoading(false)
          return
        }
        body.transferProof = transferProof
        body.transferNote = transferNote
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        const message = action === 'request_refund' ? '退款申请已提交，等待卖家处理' :
                       action === 'approve_refund' ? '已同意退款，款项将退还给买家' :
                       action === 'reject_refund' ? '已拒绝退款申请' :
                       action === 'create_dispute' ? '申诉已提交，平台将介入处理' : '操作成功！'
        alert(message)
        fetchOrderDetail()
      } else {
        alert(data.error || '操作失败')
      }
    } catch (error) {
      console.error('操作错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">订单不存在</p>
      </div>
    )
  }

  const isSeller = user?.id === order.seller.id
  const isBuyer = order.buyer && user?.id === order.buyer.id

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            FSD担保交易平台
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              欢迎，{user?.name || user?.email}
            </span>
            {user?.role === 'ADMIN' && (
              <Link href="/admin/users">
                <Button variant="outline">用户管理</Button>
              </Link>
            )}
            <Link href="/orders">
              <Button variant="outline">我的订单</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Link href="/orders" className="text-blue-600 hover:underline">
              ← 返回订单列表
            </Link>
          </div>

          {/* 订单状态 */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>订单详情</CardTitle>
                  <CardDescription>订单号: {order.orderNo}</CardDescription>
                </div>
                <span className={`px-3 py-1 rounded text-sm font-medium ${STATUS_MAP[order.status]?.color}`}>
                  {STATUS_MAP[order.status]?.label}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{STATUS_MAP[order.status]?.description}</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 车辆信息 */}
            <Card>
              <CardHeader>
                <CardTitle>车辆信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">品牌型号:</span>
                  <span className="font-medium">
                    {order.vehicleBrand} {order.vehicleModel}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">年份:</span>
                  <span className="font-medium">{order.vehicleYear}</span>
                </div>
                {order.vin && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">车架号:</span>
                    <span className="font-medium font-mono text-sm">
                      {maskString(order.vin, 5, 4)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">FSD版本:</span>
                  <span className="font-medium">{order.fsdVersion}</span>
                </div>
              </CardContent>
            </Card>

            {/* 价格信息 */}
            <Card>
              <CardHeader>
                <CardTitle>价格信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">转让价格:</span>
                  <span className="font-bold text-lg text-blue-600">
                    {formatPrice(order.price)}
                  </span>
                </div>
                {order.platformFee && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">平台手续费:</span>
                    <span className="text-red-600">{formatPrice(order.platformFee)}</span>
                  </div>
                )}
                {order.escrowAmount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">托管金额:</span>
                    <span className="font-medium">{formatPrice(order.escrowAmount)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 卖家信息 */}
            <Card>
              <CardHeader>
                <CardTitle>卖家信息</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">姓名:</span>
                  <span className="font-medium">
                    {order.seller.name || '未命名'}
                    {order.seller.verified && <span className="text-green-600 ml-1">✓已认证</span>}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">邮箱:</span>
                  <span className="text-sm">{order.seller.email}</span>
                </div>
                {order.seller.phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">手机:</span>
                    <span className="text-sm">{maskString(order.seller.phone, 3, 4)}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 买家信息 */}
            {order.buyer && (
              <Card>
                <CardHeader>
                  <CardTitle>买家信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">姓名:</span>
                    <span className="font-medium">
                      {order.buyer.name || '未命名'}
                      {order.buyer.verified && <span className="text-green-600 ml-1">✓已认证</span>}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">邮箱:</span>
                    <span className="text-sm">{order.buyer.email}</span>
                  </div>
                  {order.buyer.phone && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">手机:</span>
                      <span className="text-sm">{maskString(order.buyer.phone, 3, 4)}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* 时间线 */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>订单时间线</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  <div>
                    <span className="font-medium">订单发布</span>
                    <span className="text-sm text-gray-500 ml-2">
                      {formatDate(order.createdAt)}
                    </span>
                  </div>
                </div>
                {order.paidAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                    <div>
                      <span className="font-medium">买家付款</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {formatDate(order.paidAt)}
                      </span>
                    </div>
                  </div>
                )}
                {order.refundRequestedAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                    <div>
                      <span className="font-medium">申请退款</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {formatDate(order.refundRequestedAt)}
                      </span>
                      {order.refundReason && (
                        <span className="block text-xs text-gray-500 mt-1">
                          原因：{order.refundReason}
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {order.transferredAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                    <div>
                      <span className="font-medium">发起转移</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {formatDate(order.transferredAt)}
                      </span>
                    </div>
                  </div>
                )}
                {order.completedAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-gray-600 rounded-full"></div>
                    <div>
                      <span className="font-medium">交易完成</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {formatDate(order.completedAt)}
                      </span>
                    </div>
                  </div>
                )}
                {order.disputes && order.disputes.length > 0 && order.disputes.map((dispute) => (
                  <div key={dispute.id} className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-orange-600 rounded-full"></div>
                    <div>
                      <span className="font-medium text-orange-600">发起申诉</span>
                      <span className="text-sm text-gray-500 ml-2">
                        {formatDate(dispute.createdAt)}
                      </span>
                      <span className="block text-xs text-gray-600 mt-1">
                        原因：{dispute.reason}
                      </span>
                      <span className="block text-xs text-gray-500 mt-1">
                        {dispute.description}
                      </span>
                      {dispute.status === 'PENDING' && (
                        <span className="block text-xs text-orange-600 mt-1">
                          状态：待平台处理
                        </span>
                      )}
                      {dispute.status === 'PROCESSING' && (
                        <span className="block text-xs text-blue-600 mt-1">
                          状态：平台处理中
                        </span>
                      )}
                      {dispute.status === 'RESOLVED' && dispute.resolvedAt && (
                        <span className="block text-xs text-green-600 mt-1">
                          状态：已解决 - {formatDate(dispute.resolvedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {order.cancelledAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                    <div>
                      <span className="font-medium">
                        {order.refundStatus === 'APPROVED' ? '同意退款' :
                         order.refundStatus === 'REJECTED' ? '拒绝退款' : '订单取消'}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        {formatDate(order.cancelledAt)}
                      </span>
                      {order.refundStatus === 'APPROVED' && (
                        <span className="block text-xs text-green-600 mt-1">
                          退款已处理，款项已退还给买家
                        </span>
                      )}
                      {order.refundStatus === 'REJECTED' && order.refundReason && (
                        <span className="block text-xs text-gray-500 mt-1">
                          退款申请被拒绝
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 转移凭证 */}
          {order.transferProof && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>转移凭证</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">转移说明：{order.transferNote}</p>
                <a
                  href={order.transferProof}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline text-sm"
                >
                  查看转移凭证 →
                </a>
              </CardContent>
            </Card>
          )}

          {/* 操作区域 */}
          <Card>
            <CardHeader>
              <CardTitle>订单操作</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 买家下单支付 */}
              {order.status === 'PUBLISHED' && !isSeller && (
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    点击下方按钮下单并支付到平台托管账户
                  </p>
                  <Button
                    onClick={() => handleAction('pay')}
                    disabled={actionLoading}
                    size="lg"
                    className="w-full"
                  >
                    {actionLoading ? '处理中...' : '立即购买'}
                  </Button>
                </div>
              )}

              {/* 卖家提交转移凭证 */}
              {order.status === 'PAID' && isSeller && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    请在Tesla App中发起FSD权限转移，然后提交转移凭证
                  </p>
                  <div>
                    <label className="block text-sm font-medium mb-2">转移凭证URL</label>
                    <Input
                      type="url"
                      placeholder="请输入转移凭证图片链接"
                      value={transferProof}
                      onChange={(e) => setTransferProof(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">转移说明</label>
                    <Input
                      type="text"
                      placeholder="请简要说明转移情况"
                      value={transferNote}
                      onChange={(e) => setTransferNote(e.target.value)}
                    />
                  </div>
                  <Button
                    onClick={() => handleAction('transfer')}
                    disabled={actionLoading}
                    size="lg"
                    className="w-full"
                  >
                    {actionLoading ? '提交中...' : '提交转移凭证'}
                  </Button>
                </div>
              )}

              {/* 买家确认收货或申诉 */}
              {order.status === 'TRANSFERRING' && isBuyer && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">
                    请确认您已在Tesla App中收到FSD权限
                  </p>
                  <Button
                    onClick={() => handleAction('confirm')}
                    disabled={actionLoading}
                    size="lg"
                    className="w-full"
                  >
                    {actionLoading ? '确认中...' : '确认收货'}
                  </Button>
                  <Button
                    onClick={() => setShowDisputeDialog(true)}
                    disabled={actionLoading}
                    variant="outline"
                    size="lg"
                    className="w-full border-red-300 text-red-600 hover:bg-red-50"
                  >
                    未收到货，申诉
                  </Button>
                </div>
              )}

              {/* 取消订单 */}
              {/* PUBLISHED状态：卖家和买家都可以取消 */}
              {order.status === 'PUBLISHED' && (isSeller || (isBuyer && order.buyer)) && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => handleAction('cancel')}
                    disabled={actionLoading}
                    variant="destructive"
                    className="w-full"
                  >
                    取消订单
                  </Button>
                </div>
              )}

              {/* PAID状态：买家可以申请退款 */}
              {order.status === 'PAID' && isBuyer && !order.refundRequested && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => setShowRefundDialog(true)}
                    disabled={actionLoading}
                    variant="outline"
                    className="w-full"
                  >
                    申请退款
                  </Button>
                </div>
              )}

              {/* PAID状态：显示退款申请状态 */}
              {order.status === 'PAID' && order.refundRequested && (
                <div className="pt-4 border-t bg-yellow-50 p-4 rounded-md">
                  <h4 className="font-medium text-yellow-800 mb-2">退款申请中</h4>
                  <p className="text-sm text-gray-600">申请时间：{formatDate(order.refundRequestedAt!)}</p>
                  <p className="text-sm text-gray-600">退款原因：{order.refundReason}</p>
                  <p className="text-sm text-gray-600">
                    状态：
                    <span className={order.refundStatus === 'PENDING' ? 'text-orange-600' : order.refundStatus === 'APPROVED' ? 'text-green-600' : 'text-red-600'}>
                      {order.refundStatus === 'PENDING' ? '待卖家处理' : order.refundStatus === 'APPROVED' ? '已同意' : '已拒绝'}
                    </span>
                  </p>
                </div>
              )}

              {/* PAID状态：卖家处理退款申请 */}
              {order.status === 'PAID' && isSeller && order.refundRequested && order.refundStatus === 'PENDING' && (
                <div className="pt-4 border-t space-y-2">
                  <Button
                    onClick={() => handleAction('approve_refund')}
                    disabled={actionLoading}
                    variant="default"
                    className="w-full"
                  >
                    {actionLoading ? '处理中...' : '同意退款'}
                  </Button>
                  <Button
                    onClick={() => handleAction('reject_refund')}
                    disabled={actionLoading}
                    variant="outline"
                    className="w-full"
                  >
                    {actionLoading ? '处理中...' : '拒绝退款'}
                  </Button>
                </div>
              )}

              {/* PAID状态：卖家可以直接取消（仅在没有退款申请时） */}
              {order.status === 'PAID' && isSeller && !order.refundRequested && (
                <div className="pt-4 border-t">
                  <Button
                    onClick={() => handleAction('cancel')}
                    disabled={actionLoading}
                    variant="destructive"
                    className="w-full"
                  >
                    取消订单（退款给买家）
                  </Button>
                </div>
              )}

              {/* 已完成 */}
              {order.status === 'COMPLETED' && (
                <div className="text-center py-4">
                  <p className="text-green-600 font-medium">✓ 交易已完成</p>
                  <p className="text-sm text-gray-600 mt-2">感谢使用FSD担保交易平台</p>
                </div>
              )}

              {/* 已取消 */}
              {order.status === 'CANCELLED' && (
                <div className="text-center py-4">
                  <p className="text-red-600 font-medium">订单已取消</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 退款申请对话框 */}
      {showRefundDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4">申请退款</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">退款原因</label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[100px]"
                placeholder="请说明退款原因..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!refundReason.trim()) {
                    alert('请填写退款原因')
                    return
                  }
                  handleAction('request_refund', { reason: refundReason })
                  setShowRefundDialog(false)
                  setRefundReason('')
                }}
                disabled={actionLoading}
                className="flex-1"
              >
                提交申请
              </Button>
              <Button
                onClick={() => {
                  setShowRefundDialog(false)
                  setRefundReason('')
                }}
                variant="outline"
                className="flex-1"
              >
                取消
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 申诉对话框 */}
      {showDisputeDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md">
            <h3 className="text-lg font-medium mb-4 text-red-600">未收到货申诉</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">申诉理由</label>
              <textarea
                className="w-full border rounded-md p-2 min-h-[120px]"
                placeholder="请详细说明情况，例如：&#10;- 未在Tesla App中收到FSD权限&#10;- 卖家提供的凭证与实际不符&#10;- 其他问题..."
                value={disputeDescription}
                onChange={(e) => setDisputeDescription(e.target.value)}
              />
            </div>
            <div className="bg-yellow-50 p-3 rounded-md mb-4">
              <p className="text-sm text-yellow-800">
                ⚠️ 提交申诉后，订单将进入平台仲裁流程，管理员将介入处理。
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  if (!disputeDescription.trim()) {
                    alert('请填写申诉理由')
                    return
                  }
                  handleAction('create_dispute', {
                    reason: '未收到FSD权限',
                    description: disputeDescription
                  })
                  setShowDisputeDialog(false)
                  setDisputeDescription('')
                }}
                disabled={actionLoading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                提交申诉
              </Button>
              <Button
                onClick={() => {
                  setShowDisputeDialog(false)
                  setDisputeDescription('')
                }}
                variant="outline"
                className="flex-1"
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
