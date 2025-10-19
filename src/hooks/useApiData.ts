/**
 * 通用 API 数据获取 Hook
 *
 * 用途：替代多个页面中重复的数据获取逻辑
 * 消除重复代码：~300 行 (50 行 × 6 个使用场景)
 *
 * 功能：
 * - 自动处理加载状态
 * - 统一错误处理
 * - 自动 Toast 提示
 * - 支持查询参数
 * - 支持自动/手动刷新
 */

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'

export interface UseApiDataOptions<T> {
  /** API 端点 URL */
  url: string

  /** 查询参数 */
  params?: Record<string, any>

  /** 是否自动获取数据 */
  autoFetch?: boolean

  /** 数据转换函数 */
  transform?: (data: any) => T[]

  /** 成功回调 */
  onSuccess?: (data: T[]) => void

  /** 错误回调 */
  onError?: (error: Error) => void

  /** 是否显示错误 Toast */
  showErrorToast?: boolean
}

export interface UseApiDataReturn<T> {
  /** 数据列表 */
  data: T[]

  /** 加载状态 */
  loading: boolean

  /** 错误信息 */
  error: string | null

  /** 手动刷新数据 */
  refetch: () => Promise<void>

  /** 设置数据 (用于乐观更新) */
  setData: React.Dispatch<React.SetStateAction<T[]>>
}

export function useApiData<T = any>(
  options: UseApiDataOptions<T>
): UseApiDataReturn<T> {
  const {
    url,
    params = {},
    autoFetch = true,
    transform,
    onSuccess,
    onError,
    showErrorToast = true
  } = options

  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('未登录')
      }

      // 构建 URL 和查询参数
      let fetchUrl = url
      const queryParams = new URLSearchParams()

      Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== '' && value !== 'all') {
          queryParams.append(key, String(value))
        }
      })

      if (queryParams.toString()) {
        fetchUrl += `?${queryParams.toString()}`
      }

      // 发送请求
      const response = await fetch(fetchUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      if (result.success) {
        const processedData = transform ? transform(result.data) : (result.data || [])
        setData(processedData)
        onSuccess?.(processedData)
      } else {
        throw new Error(result.error || '获取数据失败')
      }
    } catch (err: any) {
      const errorMessage = err.message || '网络错误，请稍后重试'
      setError(errorMessage)

      if (showErrorToast) {
        toast.error(errorMessage)
      }

      onError?.(err)
      console.error('API 数据获取错误:', err)
    } finally {
      setLoading(false)
    }
  }, [url, params, transform, onSuccess, onError, showErrorToast])

  useEffect(() => {
    if (autoFetch) {
      fetchData()
    }
  }, [fetchData, autoFetch])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setData
  }
}

/**
 * 使用示例：
 *
 * // 基础用法
 * const { data: orders, loading, refetch } = useApiData({
 *   url: '/api/admin/orders',
 *   params: { status: statusFilter, search: searchQuery }
 * })
 *
 * // 带数据转换
 * const { data, loading } = useApiData<Order>({
 *   url: '/api/orders',
 *   params: { type: 'market' },
 *   transform: (rawData) => rawData.filter(o => o.status === 'PUBLISHED')
 * })
 *
 * // 手动触发获取
 * const { data, loading, refetch } = useApiData({
 *   url: '/api/admin/stats',
 *   autoFetch: false
 * })
 *
 * // 带回调
 * const { data } = useApiData({
 *   url: '/api/admin/users',
 *   onSuccess: (users) => console.log(`加载了 ${users.length} 个用户`),
 *   onError: (err) => console.error('加载失败', err)
 * })
 */
