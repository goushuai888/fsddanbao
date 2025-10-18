import { toast } from 'sonner'

/**
 * ✅ 安全增强: 统一错误处理
 *
 * 提供统一的API错误处理机制,替换原始alert()弹窗
 * 自动处理401/403/500等常见HTTP错误
 */

export interface ApiError {
  success: false
  error: string
  statusCode?: number
}

/**
 * 统一处理API错误
 *
 * 自动识别不同类型的错误并显示友好的Toast提示:
 * - 401: 跳转登录页
 * - 403: 显示权限不足
 * - 500: 显示服务器错误
 * - 网络错误: 显示网络异常
 *
 * @param error - 错误对象 (Response | ApiError | Error | unknown)
 * @param operation - 操作名称 (用于错误提示), 默认"操作"
 *
 * @example
 * ```typescript
 * try {
 *   const response = await fetch('/api/admin/refunds')
 *   if (!response.ok) {
 *     handleApiError(response, '获取退款列表')
 *     return
 *   }
 *   const data = await response.json()
 *   if (!data.success) {
 *     handleApiError(data, '获取退款列表')
 *   }
 * } catch (error) {
 *   handleApiError(error, '获取退款列表')
 * }
 * ```
 */
export function handleApiError(error: unknown, operation: string = '操作'): void {
  // 网络错误 (fetch failed)
  if (error instanceof TypeError && error.message.includes('fetch')) {
    toast.error('网络错误', {
      description: '请检查网络连接后重试'
    })
    return
  }

  // HTTP错误 (response.ok === false)
  if (error instanceof Response) {
    switch (error.status) {
      case 401:
        toast.error('登录已过期', {
          description: '请重新登录'
        })
        // 1.5秒后跳转登录页
        setTimeout(() => {
          window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
        }, 1500)
        break

      case 403:
        toast.error('权限不足', {
          description: '您没有权限执行此操作'
        })
        break

      case 500:
        toast.error('服务器错误', {
          description: '服务器遇到问题,请稍后重试'
        })
        break

      default:
        toast.error(`${operation}失败`, {
          description: `HTTP ${error.status}: ${error.statusText || '未知错误'}`
        })
    }
    return
  }

  // API错误响应 ({ success: false, error: string })
  if (typeof error === 'object' && error !== null && 'error' in error) {
    const apiError = error as ApiError
    toast.error(`${operation}失败`, {
      description: apiError.error || '未知错误'
    })
    return
  }

  // Error对象
  if (error instanceof Error) {
    toast.error(`${operation}失败`, {
      description: error.message
    })
    return
  }

  // 未知错误
  console.error('Unhandled error:', error)
  toast.error('未知错误', {
    description: '请联系技术支持'
  })
}

/**
 * 提取错误消息
 *
 * 从各种错误类型中提取可读的错误消息字符串
 *
 * @param error - 任意类型的错误
 * @returns 错误消息字符串
 */
export function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null && 'error' in error) {
    return (error as ApiError).error || '未知错误'
  }
  return '未知错误'
}

/**
 * 处理异步操作的工具函数
 *
 * 自动包装try-catch,并处理错误
 *
 * @param fn - 异步函数
 * @param operation - 操作名称
 * @returns 成功时返回结果,失败时返回null
 *
 * @example
 * ```typescript
 * const data = await safeAsync(
 *   async () => {
 *     const res = await fetch('/api/data')
 *     return res.json()
 *   },
 *   '获取数据'
 * )
 *
 * if (data) {
 *   // 处理数据
 * }
 * ```
 */
export async function safeAsync<T>(
  fn: () => Promise<T>,
  operation: string
): Promise<T | null> {
  try {
    return await fn()
  } catch (error) {
    handleApiError(error, operation)
    return null
  }
}
