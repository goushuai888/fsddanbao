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
  seller: UserInfo
  buyer: UserInfo | null
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
