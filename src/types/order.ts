/**
 * 订单相关类型定义
 */

export interface Order {
  id: string
  orderNo: string
  status: OrderStatus
  vehicleBrand: string
  vehicleModel: string
  vehicleYear: number
  vin: string | null
  fsdVersion: string
  price: number
  escrowAmount: number | null
  platformFee: number | null
  transferProof: string | null
  transferNote: string | null
  createdAt: string
  paidAt: string | null
  transferredAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  refundRequested: boolean
  refundReason: string | null
  refundRequestedAt: string | null
  refundStatus: RefundStatus | null
  refundApprovedAt: string | null
  refundRejectedReason: string | null
  refundRejectedAt: string | null
  refundResponseDeadline: string | null  // 退款响应截止时间
  refundExtensionRequested: boolean      // 是否申请延期
  refundExtensionReason: string | null   // 延期理由
  refundExtensionGrantedAt: string | null  // 延期批准时间
  confirmDeadline: string | null         // 确认收货截止时间
  autoConfirmed: boolean                 // 是否自动确认收货
  seller: UserInfo
  sellerId: string  // 添加 sellerId 字段
  buyer: UserInfo | null
  buyerId: string | null  // 添加 buyerId 字段
  payments?: Payment[]
  disputes?: Dispute[]
}

export interface UserInfo {
  id: string
  name: string
  email: string
  phone: string
  verified: boolean
}

export interface Payment {
  id: string
  amount: number
  type: PaymentType
  status: string
  note: string | null
  createdAt: string
  user: {
    name: string
    email: string
  }
}

export interface Dispute {
  id: string
  reason: string
  description: string
  status: DisputeStatus
  createdAt: string
  resolvedAt: string | null
}

export type OrderStatus =
  | 'PUBLISHED'
  | 'PAID'
  | 'TRANSFERRING'
  | 'COMPLETED'
  | 'DISPUTE'
  | 'CANCELLED'

export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type PaymentType = 'ESCROW' | 'RELEASE' | 'REFUND'

export type DisputeStatus = 'PENDING' | 'PROCESSING' | 'RESOLVED' | 'CLOSED'

export type OrderAction =
  | 'pay'
  | 'transfer'
  | 'confirm'
  | 'cancel'
  | 'request_refund'
  | 'approve_refund'
  | 'reject_refund'
  | 'request_refund_extension'  // 添加延期申请操作
  | 'create_dispute'

export interface TimelineEvent {
  time: string
  title: string
  description?: string
  color: string
  icon?: string
  operator?: string
}

export interface OrderStatusInfo {
  label: string
  color: string
  description: string
}
