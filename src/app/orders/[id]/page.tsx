'use client'

/**
 * 订单详情页面 - 重构版
 *
 * 改进：
 * 1. 从979行减少到343行（减少65%）
 * 2. 使用自定义Hooks管理状态和业务逻辑
 * 3. 提取可复用组件，提高可维护性
 * 4. 清晰的关注点分离（UI、逻辑、数据）
 * 5. TypeScript类型安全
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ArrowLeft } from 'lucide-react'

// 重构的组件
import { OrderStatusCard } from '@/components/orders/OrderStatusCard'
import { OrderVehicleInfo, OrderPriceInfo, OrderUserInfo } from '@/components/orders/OrderInfoCards'
import { OrderTimeline } from '@/components/orders/OrderTimeline'
import { RefundDialog, RejectRefundDialog, DisputeDialog } from '@/components/orders/dialogs'
import { RefundCountdown } from '@/components/orders/RefundCountdown'

// Hooks
import { useAuth } from '@/hooks/useAuth'
import { useOrderDetail } from '@/hooks/orders/useOrderDetail'
import { useOrderActions } from '@/hooks/orders/useOrderActions'

// 服务
import { OrderTimelineService } from '@/services/orderTimelineService'

// 类型和常量
import { sanitizeText } from '@/lib/sanitize'
import { isSafeUrl, getUrlValidationError } from '@/lib/url-validator'
import { getUserRoleInOrder } from '@/constants/order-status'

export default function OrderDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orderId = params.id as string

  // 认证
  const { user, isLoading: authLoading } = useAuth()

  // 订单数据
  const { order, loading: orderLoading, refetch } = useOrderDetail(orderId)

  // 订单操作
  const { actionLoading, executeAction } = useOrderActions(orderId, refetch)

  // 表单状态
  const [transferProof, setTransferProof] = useState('')
  const [transferNote, setTransferNote] = useState('')
  const [transferProofError, setTransferProofError] = useState<string | null>(null)

  // 对话框状态
  const [showRefundDialog, setShowRefundDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [showDisputeDialog, setShowDisputeDialog] = useState(false)
  const [showExtensionDialog, setShowExtensionDialog] = useState(false)
  const [extensionReason, setExtensionReason] = useState('')

  // 权限检查
  useEffect(() => {
    let isMounted = true

    if (!authLoading && !user) {
      if (isMounted) {
        localStorage.setItem('redirectAfterLogin', `/orders/${orderId}`)
        alert('请先登录后再查看订单详情')
        router.push('/login')
      }
    }

    return () => {
      isMounted = false
    }
  }, [authLoading, user, orderId, router])

  // 加载状态
  if (authLoading || orderLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  // 无订单
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">订单不存在</p>
      </div>
    )
  }

  // 权限判断
  const isSeller = user?.id === order.seller.id
  const isBuyer = order.buyer && user?.id === order.buyer.id
  const userRole = getUserRoleInOrder(order, user?.id)

  // 生成时间线
  const timelineEvents = OrderTimelineService.generateTimeline(order)

  // 处理转移操作
  const handleTransfer = () => {
    if (!transferProof || !transferNote) {
      alert('请填写转移凭证和说明')
      return
    }

    // 验证URL安全性
    if (!isSafeUrl(transferProof)) {
      const errorMsg = getUrlValidationError(transferProof) || '无效的URL'
      setTransferProofError(errorMsg)
      alert(errorMsg)
      return
    }

    executeAction('transfer', { transferProof, transferNote })
  }

  // 处理退款申请
  const handleRefundRequest = async (reason: string) => {
    const result = await executeAction('request_refund', { reason })
    // 只有成功时才关闭对话框
    if (result?.success) {
      setShowRefundDialog(false)
    }
  }

  // 处理拒绝退款
  const handleRejectRefund = async (reason: string) => {
    const result = await executeAction('reject_refund', { reason })
    if (result?.success) {
      setShowRejectDialog(false)
    }
  }

  // 处理申诉
  const handleDispute = async (description: string) => {
    const reason = order.status === 'PAID'
      ? '退款申请被拒绝，申请平台介入'
      : '未收到FSD权限'
    const result = await executeAction('create_dispute', { reason, description })
    if (result?.success) {
      setShowDisputeDialog(false)
    }
  }

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
              <Link href="/admin">
                <Button variant="outline">管理后台</Button>
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
          {/* 返回按钮 */}
          <div className="mb-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="gap-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>返回</span>
            </Button>
          </div>

          {/* 订单状态 */}
          <div className="mb-6">
            <OrderStatusCard
              orderNo={order.orderNo}
              status={order.status}
              userRole={userRole}
              hasRefundRequest={order.refundRequested}
              confirmDeadline={order.confirmDeadline}
              autoConfirmed={order.autoConfirmed}
              onConfirmTimeout={() => {
                console.warn('确认收货期限已到，刷新订单数据')
                refetch()
              }}
            />
          </div>

          {/* 信息卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <OrderVehicleInfo order={order} />
            <OrderPriceInfo order={order} />
            <OrderUserInfo title="卖家信息" user={order.seller} />
            {order.buyer && <OrderUserInfo title="买家信息" user={order.buyer} />}
          </div>

          {/* 时间线 */}
          <div className="mb-6">
            <OrderTimeline events={timelineEvents} />
          </div>

          {/* 转移凭证 */}
          {order.transferProof && (() => {
            const isValidUrl = isSafeUrl(order.transferProof)
            return (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>转移凭证</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-2">转移说明：{order.transferNote}</p>
                  {isValidUrl ? (
                    <a
                      href={order.transferProof}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-sm"
                    >
                      查看转移凭证 →
                    </a>
                  ) : (
                    <p className="text-sm text-red-600">
                      ⚠️ 转移凭证链接无效或不安全
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })()}

          {/* 操作区域 */}
          {renderActions()}
        </div>
      </main>

      {/* 对话框 */}
      <RefundDialog
        isOpen={showRefundDialog}
        onClose={() => setShowRefundDialog(false)}
        onSubmit={handleRefundRequest}
        loading={actionLoading}
      />

      <RejectRefundDialog
        isOpen={showRejectDialog}
        onClose={() => setShowRejectDialog(false)}
        onSubmit={handleRejectRefund}
        loading={actionLoading}
      />

      <DisputeDialog
        isOpen={showDisputeDialog}
        onClose={() => setShowDisputeDialog(false)}
        onSubmit={handleDispute}
        loading={actionLoading}
        isPaidRefundRejected={order.status === 'PAID' && order.refundStatus === 'REJECTED'}
      />
    </div>
  )

  // 渲染操作按钮区域（内联函数用于访问闭包变量）
  function renderActions() {
    // Guard条件：确保order存在
    if (!order) return null

    return (
      <Card>
        <CardHeader>
          <CardTitle>订单操作</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PUBLISHED状态 - 买家购买 */}
          {order.status === 'PUBLISHED' && !isSeller && (
            <div>
              <p className="text-sm text-gray-600 mb-3">
                点击下方按钮下单并支付到平台托管账户
              </p>
              <Button
                onClick={() => executeAction('pay')}
                disabled={actionLoading}
                size="lg"
                className="w-full"
              >
                {actionLoading ? '处理中...' : '立即购买'}
              </Button>
            </div>
          )}

          {/* PAID状态 - 卖家提交转移凭证 */}
          {/* ✅ 修复: 如果买家已申请退款，禁止提交转移凭证（卖家必须先处理退款） */}
          {order.status === 'PAID' && isSeller && !order.refundRequested && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                请在Tesla App中发起FSD权限转移，然后提交转移凭证
              </p>
              <div>
                <label className="block text-sm font-medium mb-2">
                  转移凭证URL <span className="text-red-500">*</span>
                </label>
                <Input
                  type="url"
                  placeholder="请输入转移凭证图片链接（支持AWS S3、阿里云OSS等）"
                  value={transferProof}
                  onChange={(e) => {
                    const url = e.target.value
                    setTransferProof(url)
                    // 实时验证
                    if (url.trim()) {
                      const error = getUrlValidationError(url)
                      setTransferProofError(error)
                    } else {
                      setTransferProofError(null)
                    }
                  }}
                  className={transferProofError ? 'border-red-500' : ''}
                />
                {transferProofError && (
                  <p className="text-sm text-red-600 mt-1">⚠️ {transferProofError}</p>
                )}
                {transferProof && !transferProofError && (
                  <p className="text-sm text-green-600 mt-1">✓ URL格式正确</p>
                )}
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium">转移说明</label>
                  <span className="text-xs text-gray-500">
                    {transferNote.length}/200
                  </span>
                </div>
                <Input
                  type="text"
                  placeholder="请简要说明转移情况"
                  value={transferNote}
                  onChange={(e) => {
                    const value = e.target.value
                    if (value.length <= 200) {
                      setTransferNote(value)
                    }
                  }}
                  maxLength={200}
                />
              </div>
              <Button
                onClick={handleTransfer}
                disabled={actionLoading || !!transferProofError}
                size="lg"
                className="w-full"
              >
                {actionLoading ? '提交中...' : '提交转移凭证'}
              </Button>
            </div>
          )}

          {/* TRANSFERRING状态 - 买家确认或申诉 */}
          {order.status === 'TRANSFERRING' && isBuyer && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                请确认您已在Tesla App中收到FSD权限
              </p>
              <Button
                onClick={() => executeAction('confirm')}
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

          {/* PAID状态 - 买家申请退款 */}
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

          {/* PAID状态 - 显示退款申请状态 */}
          {order.status === 'PAID' && order.refundRequested && (
            <div className="pt-4 border-t space-y-4">
              {/* 倒计时组件 - PENDING状态显示 */}
              {order.refundStatus === 'PENDING' && order.refundResponseDeadline && (
                <RefundCountdown
                  deadline={order.refundResponseDeadline}
                  isExtended={order.refundExtensionRequested}
                  extensionReason={order.refundExtensionReason || undefined}
                  onTimeout={() => {
                    // 超时后刷新订单数据
                    console.warn('退款申请已超时，刷新订单数据')
                    refetch()
                  }}
                />
              )}

              {/* 退款申请信息 */}
              <div className="bg-yellow-50 p-4 rounded-md">
                <h4 className="font-medium text-yellow-800 mb-2">退款申请中</h4>
                {order.refundRequestedAt && (
                  <p className="text-sm text-gray-600">
                    申请时间：{new Date(order.refundRequestedAt).toLocaleString()}
                  </p>
                )}
                <p className="text-sm text-gray-600">
                  退款原因：{sanitizeText(order.refundReason || '')}
                </p>
                <p className="text-sm text-gray-600">
                  状态：
                  <span className={
                    order.refundStatus === 'PENDING' ? 'text-orange-600' :
                    order.refundStatus === 'APPROVED' ? 'text-green-600' : 'text-red-600'
                  }>
                    {order.refundStatus === 'PENDING' ? '待卖家处理' :
                     order.refundStatus === 'APPROVED' ? '已同意' : '已拒绝'}
                  </span>
                </p>

                {/* 拒绝理由 */}
                {order.refundStatus === 'REJECTED' && order.refundRejectedReason && (
                  <>
                    {order.refundRejectedAt && (
                      <p className="text-sm text-red-600 mt-2">
                        拒绝时间：{new Date(order.refundRejectedAt).toLocaleString()}
                      </p>
                    )}
                    <p className="text-sm text-red-600">
                      拒绝理由：{sanitizeText(order.refundRejectedReason)}
                    </p>
                  </>
                )}

                {/* 买家申请平台介入 */}
                {order.refundStatus === 'REJECTED' && isBuyer && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-2">
                      对拒绝结果不满意？您可以申请平台介入处理
                    </p>
                    <Button
                      onClick={() => setShowDisputeDialog(true)}
                      variant="default"
                      className="w-full bg-orange-600 hover:bg-orange-700"
                      size="sm"
                    >
                      申请平台介入
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PAID状态 - 卖家处理退款 */}
          {order.status === 'PAID' && isSeller && order.refundRequested && order.refundStatus === 'PENDING' && (
            <div className="pt-4 border-t space-y-2">
              <Button
                onClick={() => executeAction('approve_refund')}
                disabled={actionLoading}
                variant="default"
                className="w-full"
              >
                {actionLoading ? '处理中...' : '同意退款'}
              </Button>
              <Button
                onClick={() => setShowRejectDialog(true)}
                disabled={actionLoading}
                variant="outline"
                className="w-full"
              >
                拒绝退款
              </Button>

              {/* 申请延期按钮 - 仅显示一次 */}
              {!order.refundExtensionRequested && (
                <Button
                  onClick={() => setShowExtensionDialog(true)}
                  disabled={actionLoading}
                  variant="outline"
                  className="w-full text-blue-600 border-blue-300 hover:bg-blue-50"
                >
                  申请延期 +24小时
                </Button>
              )}

              {/* 已申请延期提示 */}
              {order.refundExtensionRequested && (
                <div className="text-sm text-gray-600 text-center p-2 bg-blue-50 rounded border border-blue-200">
                  ✓ 已申请延期，截止时间已延长24小时
                </div>
              )}
            </div>
          )}

          {/* 取消订单 - 只允许PUBLISHED状态的卖家取消 */}
          {order.status === 'PUBLISHED' && isSeller && (
            <div className="pt-4 border-t">
              <Button
                onClick={() => executeAction('cancel')}
                disabled={actionLoading}
                variant="destructive"
                className="w-full"
              >
                取消订单
              </Button>
            </div>
          )}

          {/* ✅ 已移除: PAID状态卖家的"取消订单"按钮（修复严重业务逻辑漏洞）
              原代码允许卖家在收款后直接取消订单，违反担保交易原则
              正确流程: PAID状态下，买家申请退款 → 卖家同意/拒绝退款
          */}

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
    )
  }
}
