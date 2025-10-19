import { Order, TimelineEvent } from '@/types/order'
import { formatPrice } from '@/lib/utils/helpers/common'
import { sanitizeText } from '@/lib/infrastructure/security/sanitize'

/**
 * 订单时间线生成服务
 */
export class OrderTimelineService {
  /**
   * 生成订单完整时间线
   */
  static generateTimeline(order: Order): TimelineEvent[] {
    const events: TimelineEvent[] = []

    // 1. 订单发布
    events.push({
      time: order.createdAt,
      title: '订单发布',
      description: `卖家 ${order.seller.name || order.seller.email} 发布订单`,
      color: 'bg-blue-600',
      operator: order.seller.name || order.seller.email
    })

    // 2. 买家支付
    if (order.paidAt) {
      events.push({
        time: order.paidAt,
        title: '💰 买家支付',
        description: `买家 ${order.buyer?.name || order.buyer?.email} 支付 ${formatPrice(order.price)} 到平台托管`,
        color: 'bg-green-600',
        operator: order.buyer?.name || order.buyer?.email || '未知'
      })
    }

    // 3. 申请退款
    if (order.refundRequestedAt) {
      events.push({
        time: order.refundRequestedAt,
        title: '🔄 申请退款',
        description: `买家申请退款\n原因：${sanitizeText(order.refundReason || '')}`,
        color: 'bg-orange-600',
        operator: order.buyer?.name || order.buyer?.email || '未知'
      })
    }

    // 4. 同意退款
    if (order.refundApprovedAt) {
      const refundPayment = order.payments?.find(p => p.type === 'REFUND')
      events.push({
        time: order.refundApprovedAt,
        title: '✅ 同意退款',
        description: `卖家同意退款，退还 ${formatPrice(refundPayment?.amount || order.price)} 给买家`,
        color: 'bg-green-600',
        operator: order.seller.name || order.seller.email
      })
    }

    // 5. 拒绝退款
    if (order.refundRejectedAt && order.refundStatus === 'REJECTED') {
      events.push({
        time: order.refundRejectedAt,
        title: '❌ 拒绝退款',
        description: `卖家拒绝退款\n理由：${sanitizeText(order.refundRejectedReason || '')}`,
        color: 'bg-red-600',
        operator: order.seller.name || order.seller.email
      })
    }

    // 6. 提交转移凭证
    if (order.transferredAt) {
      events.push({
        time: order.transferredAt,
        title: '🚚 发起转移',
        description: `卖家提交FSD权限转移凭证\n说明：${order.transferNote || '无'}`,
        color: 'bg-yellow-600',
        operator: order.seller.name || order.seller.email
      })
    }

    // 7. 申诉记录
    if (order.disputes && order.disputes.length > 0) {
      order.disputes.forEach((dispute) => {
        events.push({
          time: dispute.createdAt,
          title: '⚠️ 发起申诉',
          description: `申诉原因：${dispute.reason}\n详细描述：${dispute.description}\n状态：${this.getDisputeStatusLabel(dispute.status)}`,
          color: 'bg-orange-600',
          operator: order.buyer?.name || order.buyer?.email || '未知'
        })

        if (dispute.resolvedAt) {
          events.push({
            time: dispute.resolvedAt,
            title: '✅ 申诉已解决',
            description: '管理员处理完成',
            color: 'bg-green-600',
            operator: '平台管理员'
          })
        }
      })
    }

    // 8. 确认收货
    if (order.completedAt) {
      const releasePayment = order.payments?.find(p => p.type === 'RELEASE')
      const sellerReceived = releasePayment?.amount || (order.price - (order.platformFee || 0))
      events.push({
        time: order.completedAt,
        title: '✅ 交易完成',
        description: `买家确认收货，释放 ${formatPrice(sellerReceived)} 给卖家${order.platformFee ? `（扣除手续费 ${formatPrice(order.platformFee)}）` : ''}`,
        color: 'bg-gray-600',
        operator: order.buyer?.name || order.buyer?.email || '未知'
      })
    }

    // 9. 订单取消
    if (order.cancelledAt && order.status === 'CANCELLED' && !order.refundApprovedAt) {
      events.push({
        time: order.cancelledAt,
        title: '🚫 订单取消',
        description: order.refundStatus === 'APPROVED' ? '退款已处理' : '订单已取消',
        color: 'bg-red-600',
        operator: '系统'
      })
    }

    // 按时间排序
    return events.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
  }

  /**
   * 获取申诉状态标签
   */
  private static getDisputeStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: '待处理',
      PROCESSING: '处理中',
      RESOLVED: '已解决',
      CLOSED: '已关闭'
    }
    return labels[status] || status
  }
}
