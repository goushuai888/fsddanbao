// 用户相关类型
export interface User {
  id: string
  email: string
  name: string | null
  phone: string | null
  avatar: string | null
  role: 'BUYER' | 'SELLER' | 'ADMIN'
  verified: boolean
  balance: number
  createdAt: Date
  updatedAt: Date
}

// 订单相关类型
export interface Order {
  id: string
  orderNo: string
  sellerId: string
  buyerId: string | null
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
  // 退款申请
  refundRequested: boolean
  refundReason: string | null
  refundRequestedAt: Date | null
  refundStatus: RefundStatus | null
  createdAt: Date
  updatedAt: Date
  paidAt: Date | null
  transferredAt: Date | null
  completedAt: Date | null
  cancelledAt: Date | null
}

export type OrderStatus =
  | 'PUBLISHED'
  | 'PAID'
  | 'TRANSFERRING'
  | 'CONFIRMING'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTE'

export type RefundStatus =
  | 'PENDING'    // 待处理
  | 'APPROVED'   // 已同意
  | 'REJECTED'   // 已拒绝
  | 'COMPLETED'  // 已完成

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 订单创建请求
export interface CreateOrderRequest {
  vehicleBrand: string
  vehicleModel: string
  vehicleYear: number
  vin?: string
  fsdVersion: string
  price: number
}

// 支付请求
export interface PaymentRequest {
  orderId: string
  amount: number
  paymentMethod: 'alipay' | 'wechat' | 'bank'
}
