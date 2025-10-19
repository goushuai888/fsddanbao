import { useState } from 'react'
import { OrderAction } from '@/types/order'
import { ACTION_SUCCESS_MESSAGES } from '@/lib/domain/policies/order'

export function useOrderActions(orderId: string, onSuccess?: () => void) {
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const executeAction = async (action: OrderAction, extraData?: Record<string, any>) => {
    // 退款申请和申诉不需要二次确认
    if (action !== 'request_refund' && action !== 'create_dispute') {
      if (!confirm('确定要执行此操作吗？')) {
        return { success: false }
      }
    }

    try {
      setActionLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('未登录')
      }

      const body = { action, ...extraData }

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      // ✅ 并发冲突处理：409状态码表示订单状态已变更
      if (response.status === 409) {
        const conflictMessage = data.error || '订单状态已变更，正在刷新...'
        alert(conflictMessage)

        // 自动刷新订单数据
        if (onSuccess) {
          onSuccess()
        }

        return { success: false, error: conflictMessage, shouldRefresh: true }
      }

      if (data.success) {
        const message = ACTION_SUCCESS_MESSAGES[action] || '操作成功！'
        alert(message)
        onSuccess?.()
        return { success: true, data: data.data }
      } else {
        setError(data.error || '操作失败')
        alert(data.error || '操作失败')
        return { success: false, error: data.error }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误，请稍后重试'
      setError(message)
      alert(message)
      console.error('操作错误:', err)
      return { success: false, error: message }
    } finally {
      setActionLoading(false)
    }
  }

  return {
    actionLoading,
    error,
    executeAction
  }
}
