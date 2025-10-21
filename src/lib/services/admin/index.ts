/**
 * 管理员服务层
 * 封装管理员操作的API调用，提供统一的错误处理和类型安全
 */

import { toast } from 'sonner'

// ===== 类型定义 =====

export interface RefundRequest {
  id: string
  orderNo: string
  vehicleBrand: string
  vehicleModel: string
  price: number
  escrowAmount?: number | null
  refundStatus?: string | null
  refundReason?: string | null
  refundRequestedAt?: Date | string | null
  refundApprovedAt?: Date | string | null
  seller: {
    id: string
    name: string | null
    email: string
    phone: string | null
  }
  buyer: {
    id: string
    name: string | null
    email: string
    phone: string | null
  } | null
}

export interface Dispute {
  id: string
  reason: string
  description: string
  status: string
  resolution?: string | null
  createdAt: Date | string
  resolvedAt?: Date | string | null
  order: {
    id: string
    orderNo: string
    status: string
    price: number
    vehicleBrand: string
    vehicleModel: string
  }
  initiator: {
    id: string
    name: string | null
    email: string
    phone: string | null
  }
}

// ===== 辅助函数 =====

/**
 * 获取存储的认证Token
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('token')
}

/**
 * 统一的API调用处理
 */
async function apiCall<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  const token = getAuthToken()

  if (!token) {
    toast.error('认证失败', {
      description: '请重新登录'
    })
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
    throw new Error('未授权')
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  })

  // 处理HTTP错误
  if (response.status === 401) {
    toast.error('认证失败', {
      description: '登录已过期，请重新登录'
    })
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
    throw new Error('未授权')
  }

  if (response.status === 403) {
    toast.error('权限不足', {
      description: '您没有执行此操作的权限'
    })
    throw new Error('权限不足')
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: '网络错误' }))
    toast.error('操作失败', {
      description: errorData.error || `请求失败 (${response.status})`
    })
    throw new Error(errorData.error || '请求失败')
  }

  const data = await response.json()

  if (!data.success) {
    toast.error('操作失败', {
      description: data.error || '未知错误'
    })
    throw new Error(data.error || '操作失败')
  }

  return data.data as T
}

// ===== 退款服务 =====

export const refundService = {
  /**
   * 批准退款申请
   */
  async approveRefund(orderId: string, note?: string): Promise<any> {
    return apiCall(`/api/admin/refunds/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'approve',
        note
      })
    })
  },

  /**
   * 拒绝退款申请
   */
  async rejectRefund(orderId: string, note?: string): Promise<any> {
    return apiCall(`/api/admin/refunds/${orderId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'reject',
        note
      })
    })
  }
}

// ===== 申诉服务 =====

export const disputeService = {
  /**
   * 批准申诉（退款给买家）
   */
  async approveDispute(disputeId: string, resolution: string): Promise<any> {
    return apiCall(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'approve',
        resolution
      })
    })
  },

  /**
   * 拒绝申诉（释放款项给卖家）
   */
  async rejectDispute(disputeId: string, resolution: string): Promise<any> {
    return apiCall(`/api/admin/disputes/${disputeId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        action: 'reject',
        resolution
      })
    })
  }
}
