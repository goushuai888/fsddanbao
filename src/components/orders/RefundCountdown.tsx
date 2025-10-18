'use client'

import { useEffect, useState } from 'react'
import { formatRemainingTime, getRemainingTime } from '@/lib/constants/refund-config'

interface RefundCountdownProps {
  deadline: string | Date  // 截止时间
  isExtended?: boolean     // 是否已延期
  extensionReason?: string // 延期理由
  onTimeout?: () => void   // 超时回调
  className?: string
}

/**
 * 退款响应倒计时组件
 *
 * 功能：
 * 1. 实时显示剩余时间
 * 2. 根据剩余时间显示不同警告级别
 * 3. 超时时显示红色警告并触发回调
 * 4. 显示延期信息
 */
export function RefundCountdown({
  deadline,
  isExtended = false,
  extensionReason,
  onTimeout,
  className = ''
}: RefundCountdownProps) {
  const [remaining, setRemaining] = useState<number>(0)
  const [isTimeout, setIsTimeout] = useState(false)

  useEffect(() => {
    const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline

    // 初始化
    const updateRemaining = () => {
      const remainingMs = getRemainingTime(deadlineDate)
      setRemaining(remainingMs)

      if (remainingMs === 0 && !isTimeout) {
        setIsTimeout(true)
        onTimeout?.()
      }
    }

    updateRemaining()

    // 每秒更新一次
    const timer = setInterval(updateRemaining, 1000)

    return () => clearInterval(timer)
  }, [deadline, isTimeout, onTimeout])

  // 根据剩余时间确定样式
  const getStyle = () => {
    if (isTimeout || remaining === 0) {
      return {
        bgColor: 'bg-red-50 border-red-200',
        textColor: 'text-red-700',
        iconColor: 'text-red-500',
        urgency: 'critical'
      }
    }

    const hours = remaining / (60 * 60 * 1000)

    if (hours <= 1) {
      return {
        bgColor: 'bg-red-50 border-red-200',
        textColor: 'text-red-700',
        iconColor: 'text-red-500',
        urgency: 'urgent'
      }
    } else if (hours <= 6) {
      return {
        bgColor: 'bg-orange-50 border-orange-200',
        textColor: 'text-orange-700',
        iconColor: 'text-orange-500',
        urgency: 'warning'
      }
    } else if (hours <= 24) {
      return {
        bgColor: 'bg-yellow-50 border-yellow-200',
        textColor: 'text-yellow-700',
        iconColor: 'text-yellow-500',
        urgency: 'notice'
      }
    } else {
      return {
        bgColor: 'bg-blue-50 border-blue-200',
        textColor: 'text-blue-700',
        iconColor: 'text-blue-500',
        urgency: 'normal'
      }
    }
  }

  const style = getStyle()
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline
  const formattedTime = formatRemainingTime(deadlineDate)

  return (
    <div className={`rounded-lg border-2 p-4 ${style.bgColor} ${className}`}>
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-2">
        {isTimeout ? (
          <svg className={`w-5 h-5 ${style.iconColor}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg className={`w-5 h-5 ${style.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
        <span className={`font-semibold ${style.textColor}`}>
          {isTimeout ? '处理已超时' : '卖家响应倒计时'}
        </span>
      </div>

      {/* 倒计时显示 */}
      <div className={`text-2xl font-bold ${style.textColor} mb-1`}>
        {formattedTime}
      </div>

      {/* 截止时间 */}
      <div className={`text-sm ${style.textColor} opacity-75`}>
        截止时间：{deadlineDate.toLocaleString('zh-CN', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })}
      </div>

      {/* 延期信息 */}
      {isExtended && (
        <div className="mt-3 pt-3 border-t border-current border-opacity-20">
          <div className="flex items-start gap-2">
            <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${style.iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className={`text-sm ${style.textColor}`}>
              <p className="font-medium">已申请延期 +24小时</p>
              {extensionReason && (
                <p className="mt-1 opacity-75">延期理由：{extensionReason}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 超时提示 */}
      {isTimeout && (
        <div className="mt-3 pt-3 border-t border-red-300">
          <p className={`text-sm font-medium ${style.textColor}`}>
            ⚠️ 卖家超时未处理，系统将自动同意退款申请
          </p>
        </div>
      )}

      {/* 紧急提示 */}
      {!isTimeout && style.urgency === 'urgent' && (
        <div className="mt-3 pt-3 border-t border-red-300">
          <p className={`text-sm font-medium ${style.textColor}`}>
            ⏰ 即将超时！请尽快处理退款申请
          </p>
        </div>
      )}
    </div>
  )
}
