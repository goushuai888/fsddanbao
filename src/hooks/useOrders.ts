import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

// 扩展订单类型以包含列表中需要的字段
export interface Order {
  id: string
  orderNo: string
  status: string
  vehicleBrand: string
  vehicleModel: string
  vehicleYear: number
  fsdVersion: string
  price: number
  createdAt: string
  sellerId: string  // 添加 sellerId
  buyerId: string | null  // 添加 buyerId
  refundRequested: boolean  // 添加 refundRequested
  seller?: {
    id: string
    name: string
    verified: boolean
  }
  buyer?: {
    id: string
    name: string
    verified: boolean
  }
}

export type OrderFilterType = 'all' | 'sell' | 'buy' | 'market'
export type OrderStatusFilter = 'active' | 'all' | 'PUBLISHED' | 'PAID' | 'TRANSFERRING' | 'COMPLETED' | 'CANCELLED' | 'DISPUTE'

interface UseOrdersOptions {
  initialFilterType?: OrderFilterType
  initialStatusFilter?: OrderStatusFilter
  autoFetch?: boolean
}

interface UseOrdersReturn {
  orders: Order[]
  isLoading: boolean
  error: string | null
  filterType: OrderFilterType
  statusFilter: OrderStatusFilter
  setFilterType: (type: OrderFilterType) => void
  setStatusFilter: (status: OrderStatusFilter) => void
  refetch: () => Promise<void>
}

export function useOrders(options: UseOrdersOptions = {}): UseOrdersReturn {
  const {
    initialFilterType = 'market',
    initialStatusFilter = 'active',
    autoFetch = true
  } = options

  const [orders, setOrders] = useState<Order[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterType, setFilterType] = useState<OrderFilterType>(initialFilterType)
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>(initialStatusFilter)

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('未登录')
      }

      let url = '/api/orders'
      const params = new URLSearchParams()

      if (filterType !== 'all') {
        params.append('type', filterType)
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter)
      }

      if (params.toString()) {
        url += `?${params.toString()}`
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.success) {
        setOrders(data.data || [])
      } else {
        throw new Error(data.error || '获取订单列表失败')
      }
    } catch (err: any) {
      const errorMessage = err.message || '网络错误，请稍后重试'
      setError(errorMessage)
      toast.error(errorMessage)
      console.error('获取订单列表错误:', err)
    } finally {
      setIsLoading(false)
    }
  }, [filterType, statusFilter])

  useEffect(() => {
    if (autoFetch) {
      fetchOrders()
    }
  }, [fetchOrders, autoFetch])

  return {
    orders,
    isLoading,
    error,
    filterType,
    statusFilter,
    setFilterType,
    setStatusFilter,
    refetch: fetchOrders
  }
}
