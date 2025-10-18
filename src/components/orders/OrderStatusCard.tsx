import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getOrderStatusDisplay, UserRole, OrderStatus as OrderStatusType } from '@/constants/order-status'

interface OrderStatusCardProps {
  orderNo: string
  status: OrderStatusType
  userRole: UserRole
  hasRefundRequest?: boolean
}

export function OrderStatusCard({
  orderNo,
  status,
  userRole,
  hasRefundRequest = false
}: OrderStatusCardProps) {
  const statusInfo = getOrderStatusDisplay(status, userRole, hasRefundRequest)

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>订单详情</CardTitle>
            <CardDescription>订单号: {orderNo}</CardDescription>
          </div>
          <span className={`px-3 py-1.5 rounded-md text-sm font-semibold ${statusInfo.color} ${statusInfo.bgColor}`}>
            {statusInfo.label}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm text-gray-700 font-medium">{statusInfo.description}</p>
        {statusInfo.actionHint && (
          <p className="text-xs text-gray-500 bg-gray-50 px-3 py-2 rounded border border-gray-200">
            💡 {statusInfo.actionHint}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
