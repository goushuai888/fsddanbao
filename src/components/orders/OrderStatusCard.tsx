import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ORDER_STATUS_MAP } from '@/constants/order'
import { OrderStatus } from '@/types/order'

interface OrderStatusCardProps {
  orderNo: string
  status: OrderStatus
}

export function OrderStatusCard({ orderNo, status }: OrderStatusCardProps) {
  const statusInfo = ORDER_STATUS_MAP[status]

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>订单详情</CardTitle>
            <CardDescription>订单号: {orderNo}</CardDescription>
          </div>
          <span className={`px-3 py-1 rounded text-sm font-medium ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600">{statusInfo.description}</p>
      </CardContent>
    </Card>
  )
}
