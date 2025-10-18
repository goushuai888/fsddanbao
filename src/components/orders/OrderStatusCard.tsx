'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getOrderStatusDisplay, UserRole, OrderStatus as OrderStatusType } from '@/constants/order-status'
import { getConfirmRemainingSeconds, formatConfirmRemaining } from '@/lib/constants/confirm-config'

interface OrderStatusCardProps {
  orderNo: string
  status: OrderStatusType
  userRole: UserRole
  hasRefundRequest?: boolean
  // 确认收货倒计时相关
  confirmDeadline?: string | Date | null
  autoConfirmed?: boolean
  onConfirmTimeout?: () => void
}

export function OrderStatusCard({
  orderNo,
  status,
  userRole,
  hasRefundRequest = false,
  confirmDeadline,
  autoConfirmed = false,
  onConfirmTimeout
}: OrderStatusCardProps) {
  const statusInfo = getOrderStatusDisplay(status, userRole, hasRefundRequest)

  // 倒计时状态
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    confirmDeadline ? getConfirmRemainingSeconds(confirmDeadline) : 0
  )
  const [hasCalledTimeout, setHasCalledTimeout] = useState(false)

  // 倒计时更新
  useEffect(() => {
    if (!confirmDeadline) return

    const timer = setInterval(() => {
      const seconds = getConfirmRemainingSeconds(confirmDeadline)
      setRemainingSeconds(seconds)

      if (seconds <= 0 && !hasCalledTimeout && onConfirmTimeout) {
        setHasCalledTimeout(true)
        onConfirmTimeout()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [confirmDeadline, hasCalledTimeout, onConfirmTimeout])

  const showCountdown = status === 'TRANSFERRING' && confirmDeadline
  const isOverdue = remainingSeconds <= 0
  const displayTime = formatConfirmRemaining(remainingSeconds)
  const isBuyer = userRole === 'buyer'

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>订单详情</CardTitle>
            <CardDescription>订单号: {orderNo}</CardDescription>
          </div>
          <span className={`px-3 py-1.5 rounded-md text-sm font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}>
            {statusInfo.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-gray-700 font-medium">{statusInfo.description}</p>
        {statusInfo.actionHint && (
          <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            💡 {statusInfo.actionHint}
          </p>
        )}

        {/* 整合的倒计时显示 - 仅在TRANSFERRING状态显示 */}
        {showCountdown && (
          <div className={`mt-3 p-3 rounded-lg border-2 ${
            isOverdue
              ? 'bg-orange-50 border-orange-300'
              : isBuyer
                ? 'bg-blue-50 border-blue-300'
                : 'bg-green-50 border-green-300'
          }`}>
            {/* 倒计时标题和时间 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={isOverdue ? 'text-orange-600' : isBuyer ? 'text-blue-600' : 'text-green-600'}>
                  {isOverdue ? '⏰' : '⏱️'}
                </span>
                <span className={`text-sm font-semibold ${
                  isOverdue ? 'text-orange-800' : isBuyer ? 'text-blue-800' : 'text-green-800'
                }`}>
                  {isOverdue
                    ? (isBuyer ? '确认期限已过' : '等待确认期限已过')
                    : (isBuyer ? '确认收货倒计时' : '等待买家确认')
                  }
                </span>
              </div>
              <span className={`text-lg font-bold ${
                isOverdue ? 'text-orange-600' : isBuyer ? 'text-blue-600' : 'text-green-600'
              }`}>
                {displayTime}
              </span>
            </div>

            {/* 简洁提示 */}
            {!isOverdue && (
              <div className={`text-xs ${isBuyer ? 'text-blue-700' : 'text-green-700'}`}>
                {isBuyer ? (
                  <>
                    <p>📌 请在Tesla App中确认是否收到FSD权限，确认后点击下方"<span className="font-semibold">确认收货</span>"按钮</p>
                    <p className="mt-1 text-orange-600 font-medium">⚠️ 倒计时结束后将自动确认收货并释放款项</p>
                  </>
                ) : (
                  <>
                    <p>📌 等待买家确认收货，倒计时结束后自动确认并释放款项至您的账户</p>
                    <p className="mt-1">💡 如买家反馈未收到，请及时核实</p>
                  </>
                )}
              </div>
            )}

            {isOverdue && (
              <p className={`text-xs ${isOverdue ? 'text-orange-700' : ''} font-medium`}>
                {autoConfirmed
                  ? (isBuyer ? '订单已自动确认，款项已释放' : '订单已自动确认，款项已到账')
                  : '等待系统处理...'}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
