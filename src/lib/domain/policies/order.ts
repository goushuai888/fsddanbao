import { OrderStatusInfo, OrderStatus } from '@/types/order'

/**
 * 订单状态映射
 */
export const ORDER_STATUS_MAP: Record<OrderStatus, OrderStatusInfo> = {
  PUBLISHED: {
    label: '已发布',
    color: 'bg-blue-100 text-blue-800',
    description: '订单已发布，等待买家下单'
  },
  PAID: {
    label: '已支付',
    color: 'bg-green-100 text-green-800',
    description: '买家已付款到平台托管，等待卖家转移FSD权限'
  },
  TRANSFERRING: {
    label: '转移中',
    color: 'bg-yellow-100 text-yellow-800',
    description: '卖家已发起FSD权限转移，等待买家确认'
  },
  COMPLETED: {
    label: '已完成',
    color: 'bg-gray-100 text-gray-800',
    description: '交易已完成'
  },
  DISPUTE: {
    label: '申诉中',
    color: 'bg-orange-100 text-orange-800',
    description: '买家已发起申诉，平台正在处理中'
  },
  CANCELLED: {
    label: '已取消',
    color: 'bg-red-100 text-red-800',
    description: '订单已取消'
  }
}

/**
 * 操作成功消息映射
 */
export const ACTION_SUCCESS_MESSAGES: Record<string, string> = {
  pay: '支付成功！',
  transfer: '转移凭证已提交',
  confirm: '确认收货成功',
  cancel: '订单已取消',
  request_refund: '退款申请已提交，等待卖家处理',
  approve_refund: '已同意退款，款项将退还给买家',
  reject_refund: '已拒绝退款申请',
  create_dispute: '申诉已提交，平台将介入处理'
}
