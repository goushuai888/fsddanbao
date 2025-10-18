import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Order } from '@/types/order'

export function useOrderDetail(orderId: string) {
  const router = useRouter()
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrderDetail = async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('未登录')
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setOrder(data.data)
      } else {
        setError(data.error || '获取订单详情失败')
        // 如果是403或404错误，返回订单列表
        if (response.status === 403 || response.status === 404) {
          router.push('/orders')
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '网络错误，请稍后重试'
      setError(message)
      console.error('获取订单详情错误:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail()
    }
  }, [orderId])

  return {
    order,
    loading,
    error,
    refetch: fetchOrderDetail
  }
}
