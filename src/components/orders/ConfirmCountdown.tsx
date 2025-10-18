'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getConfirmRemainingSeconds, formatConfirmRemaining } from '@/lib/constants/confirm-config'

interface ConfirmCountdownProps {
  deadline: string | Date
  autoConfirmed?: boolean  // 是否已自动确认
  onTimeout?: () => void   // 超时回调
}

export function ConfirmCountdown({
  deadline,
  autoConfirmed = false,
  onTimeout
}: ConfirmCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    getConfirmRemainingSeconds(deadline)
  )

  const [hasCalledTimeout, setHasCalledTimeout] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      const seconds = getConfirmRemainingSeconds(deadline)
      setRemainingSeconds(seconds)

      // 超时且未调用过回调
      if (seconds <= 0 && !hasCalledTimeout && onTimeout) {
        setHasCalledTimeout(true)
        onTimeout()
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [deadline, hasCalledTimeout, onTimeout])

  const isOverdue = remainingSeconds <= 0
  const displayTime = formatConfirmRemaining(remainingSeconds)

  return (
    <Card className={`border-2 ${isOverdue ? 'border-orange-300 bg-orange-50' : 'border-blue-300 bg-blue-50'}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {isOverdue ? (
            <>
              <span className="text-orange-600">⏰</span>
              <span className="text-orange-800">确认收货期限已到</span>
            </>
          ) : (
            <>
              <span className="text-blue-600">⏱️</span>
              <span className="text-blue-800">确认收货倒计时</span>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 倒计时显示 */}
        <div className={`text-center py-4 rounded-lg ${isOverdue ? 'bg-orange-100' : 'bg-blue-100'}`}>
          <div className={`text-3xl font-bold ${isOverdue ? 'text-orange-600' : 'text-blue-600'}`}>
            {displayTime}
          </div>
          {!isOverdue && (
            <div className="text-sm text-gray-600 mt-2">
              截止时间：{new Date(deadline).toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </div>
          )}
        </div>

        {/* 说明文字 */}
        <div className={`text-sm p-3 rounded ${isOverdue ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>
          {isOverdue ? (
            <>
              <p className="font-medium mb-1">⚠️ 确认期限已过</p>
              <p>
                {autoConfirmed
                  ? '订单已自动确认收货，款项已释放给卖家'
                  : '请尽快确认收货，或联系平台客服处理'}
              </p>
            </>
          ) : (
            <>
              <p className="font-medium mb-1">💡 温馨提示</p>
              <p>
                卖家已提交转移凭证，请在Tesla App中确认是否收到FSD权限。
                如果确认收到，请点击"确认收货"按钮完成交易。
              </p>
              <p className="mt-2">
                <span className="font-medium">倒计时结束后</span>，系统将自动确认收货并释放款项给卖家。
              </p>
            </>
          )}
        </div>

        {/* 买家保护提示 */}
        {!isOverdue && (
          <div className="text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            🛡️ 买家保护：如果您未收到FSD权限，可以在期限内发起申诉，平台将介入处理
          </div>
        )}
      </CardContent>
    </Card>
  )
}
