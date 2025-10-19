/**
 * 订单状态映射 - 根据用户角色显示不同的状态文案
 *
 * 设计原则：
 * 1. 卖家视角：关注发货、收款状态
 * 2. 买家视角：关注付款、收货状态
 * 3. 访客视角：显示通用状态
 */

export type OrderStatus = 'PUBLISHED' | 'PAID' | 'TRANSFERRING' | 'COMPLETED' | 'CANCELLED' | 'DISPUTE'
export type UserRole = 'seller' | 'buyer' | 'visitor'

export interface StatusDisplay {
  label: string              // 状态标签
  description: string        // 状态描述
  color: string             // 颜色样式类
  bgColor: string           // 背景色样式类
  icon?: string             // 图标（可选）
  actionHint?: string       // 操作提示
}

/**
 * 获取订单状态显示信息
 * @param status 订单状态
 * @param role 用户角色
 * @param hasRefundRequest 是否有退款申请
 * @returns 状态显示信息
 */
export function getOrderStatusDisplay(
  status: OrderStatus,
  role: UserRole,
  hasRefundRequest: boolean = false
): StatusDisplay {
  // PUBLISHED状态
  if (status === 'PUBLISHED') {
    if (role === 'seller') {
      return {
        label: '已发布',
        description: '订单已发布，等待买家购买',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        actionHint: '等待买家下单'
      }
    }
    if (role === 'buyer') {
      return {
        label: '可购买',
        description: '您可以购买此订单',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        actionHint: '点击"立即购买"下单'
      }
    }
    return {
      label: '销售中',
      description: '该订单正在销售中',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100'
    }
  }

  // PAID状态
  if (status === 'PAID') {
    // 有退款申请时的特殊显示
    if (hasRefundRequest) {
      if (role === 'seller') {
        return {
          label: '退款待处理',
          description: '买家已申请退款，请尽快处理',
          color: 'text-orange-700',
          bgColor: 'bg-orange-100',
          actionHint: '请同意或拒绝退款申请'
        }
      }
      if (role === 'buyer') {
        return {
          label: '退款申请中',
          description: '您的退款申请已提交，等待卖家处理',
          color: 'text-orange-700',
          bgColor: 'bg-orange-100',
          actionHint: '等待卖家响应'
        }
      }
    }

    // 正常PAID状态
    if (role === 'seller') {
      return {
        label: '待发货',
        description: '买家已付款，请尽快转移FSD权限',
        color: 'text-purple-700',
        bgColor: 'bg-purple-100',
        actionHint: '请在Tesla App中转移权限并提交凭证'
      }
    }
    if (role === 'buyer') {
      return {
        label: '已支付',
        description: '您已支付，等待卖家转移FSD权限',
        color: 'text-blue-700',
        bgColor: 'bg-blue-100',
        actionHint: '等待卖家发货'
      }
    }
    return {
      label: '已支付',
      description: '买家已支付，等待卖家发货',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100'
    }
  }

  // TRANSFERRING状态
  if (status === 'TRANSFERRING') {
    if (role === 'seller') {
      return {
        label: '已发货',
        description: '您已提交转移凭证，等待买家确认收货',
        color: 'text-indigo-700',
        bgColor: 'bg-indigo-100',
        actionHint: '等待买家确认收货'
      }
    }
    if (role === 'buyer') {
      return {
        label: '待确认收货',
        description: '卖家已转移权限，请在Tesla App中确认后点击"确认收货"',
        color: 'text-yellow-700',
        bgColor: 'bg-yellow-100',
        actionHint: '请确认是否收到FSD权限'
      }
    }
    return {
      label: '转移中',
      description: '卖家已发货，等待买家确认',
      color: 'text-indigo-700',
      bgColor: 'bg-indigo-100'
    }
  }

  // COMPLETED状态
  if (status === 'COMPLETED') {
    if (role === 'seller') {
      return {
        label: '交易完成',
        description: '买家已确认收货，款项已到账',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        actionHint: '交易成功，感谢使用'
      }
    }
    if (role === 'buyer') {
      return {
        label: '交易完成',
        description: '您已确认收货，交易完成',
        color: 'text-green-700',
        bgColor: 'bg-green-100',
        actionHint: '感谢购买'
      }
    }
    return {
      label: '已完成',
      description: '交易已完成',
      color: 'text-green-700',
      bgColor: 'bg-green-100'
    }
  }

  // CANCELLED状态
  if (status === 'CANCELLED') {
    if (role === 'seller') {
      return {
        label: '已取消',
        description: '订单已取消',
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
        actionHint: '订单已关闭'
      }
    }
    if (role === 'buyer') {
      return {
        label: '已取消',
        description: '订单已取消，款项已退还',
        color: 'text-gray-700',
        bgColor: 'bg-gray-100',
        actionHint: '订单已关闭'
      }
    }
    return {
      label: '已取消',
      description: '订单已取消',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100'
    }
  }

  // DISPUTE状态
  if (status === 'DISPUTE') {
    if (role === 'seller') {
      return {
        label: '申诉处理中',
        description: '买家已发起申诉，平台客服正在介入处理',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        actionHint: '请等待平台客服联系'
      }
    }
    if (role === 'buyer') {
      return {
        label: '申诉处理中',
        description: '您的申诉已提交，平台客服正在处理中',
        color: 'text-red-700',
        bgColor: 'bg-red-100',
        actionHint: '请等待平台客服联系'
      }
    }
    return {
      label: '申诉中',
      description: '订单存在争议，平台正在处理',
      color: 'text-red-700',
      bgColor: 'bg-red-100'
    }
  }

  // 默认返回（理论上不应该到达这里）
  return {
    label: '未知状态',
    description: '订单状态异常',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100'
  }
}

/**
 * 获取用户在订单中的角色
 * @param order 订单对象
 * @param userId 当前用户ID
 * @returns 用户角色
 */
export function getUserRoleInOrder(
  order: { sellerId: string; buyerId: string | null },
  userId: string | null | undefined
): UserRole {
  if (!userId) return 'visitor'
  if (order.sellerId === userId) return 'seller'
  if (order.buyerId === userId) return 'buyer'
  return 'visitor'
}

/**
 * 订单状态优先级（用于排序）
 */
export const ORDER_STATUS_PRIORITY: Record<OrderStatus, number> = {
  DISPUTE: 1,        // 最高优先级：申诉中
  PAID: 2,           // 待发货/待处理
  TRANSFERRING: 3,   // 转移中
  PUBLISHED: 4,      // 已发布
  COMPLETED: 5,      // 已完成
  CANCELLED: 6       // 已取消
}

/**
 * 状态简短标签（用于列表展示）
 */
export const ORDER_STATUS_SHORT_LABELS: Record<OrderStatus, string> = {
  PUBLISHED: '销售中',
  PAID: '已支付',
  TRANSFERRING: '转移中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  DISPUTE: '申诉中'
}
