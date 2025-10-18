import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { formatPrice, formatDate, maskString } from '@/lib/utils'
import type { Order } from '@/hooks/useOrders'

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PUBLISHED: { label: '已发布', color: 'bg-blue-100 text-blue-800' },
  PAID: { label: '已支付', color: 'bg-green-100 text-green-800' },
  TRANSFERRING: { label: '转移中', color: 'bg-yellow-100 text-yellow-800' },
  CONFIRMING: { label: '待确认', color: 'bg-orange-100 text-orange-800' },
  COMPLETED: { label: '已完成', color: 'bg-gray-100 text-gray-800' },
  CANCELLED: { label: '已取消', color: 'bg-red-100 text-red-800' },
  DISPUTE: { label: '申诉中', color: 'bg-purple-100 text-purple-800' }
}

export interface OrderCardProps {
  order: Order
  className?: string
  hideStatus?: boolean  // 是否隐藏状态标签（市场浏览时使用）
}

export function OrderCard({ order, className = '', hideStatus = false }: OrderCardProps) {
  const statusInfo = STATUS_MAP[order.status] || {
    label: order.status,
    color: 'bg-gray-100 text-gray-800'
  }

  return (
    <Card className={`hover:shadow-lg transition-all duration-200 ${className}`}>
      <CardHeader>
        <div className="flex justify-between items-start gap-2">
          <CardTitle className="text-lg font-semibold">
            {order.vehicleBrand} {order.vehicleModel}
          </CardTitle>
          {!hideStatus && (
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${statusInfo.color}`}
            >
              {statusInfo.label}
            </span>
          )}
        </div>
        <CardDescription className="flex items-center gap-1">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          订单号: {maskString(order.orderNo, 6, 4)}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="space-y-2 text-sm">
          {/* Year */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">年份:</span>
            <span className="font-medium">{order.vehicleYear}</span>
          </div>

          {/* FSD Version */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">FSD版本:</span>
            <span className="font-medium">{order.fsdVersion}</span>
          </div>

          {/* Price */}
          <div className="flex justify-between items-center">
            <span className="text-gray-600">价格:</span>
            <span className="font-bold text-lg text-blue-600">
              {formatPrice(order.price)}
            </span>
          </div>

          {/* Seller */}
          {order.seller && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">卖家:</span>
              <span className="flex items-center gap-1">
                {order.seller.name || '未命名'}
                {order.seller.verified && (
                  <span className="text-green-600" title="已认证">
                    ✓
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Buyer */}
          {order.buyer && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">买家:</span>
              <span className="flex items-center gap-1">
                {order.buyer.name || '未命名'}
                {order.buyer.verified && (
                  <span className="text-green-600" title="已认证">
                    ✓
                  </span>
                )}
              </span>
            </div>
          )}

          {/* Created At */}
          <div className="flex justify-between items-center text-xs text-gray-500 pt-2 border-t">
            <span>发布时间:</span>
            <span>{formatDate(order.createdAt)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter>
        <Link href={`/orders/${order.id}`} className="w-full">
          <Button variant="outline" className="w-full hover:bg-blue-50 hover:text-blue-600 transition-colors">
            查看详情
          </Button>
        </Link>
      </CardFooter>
    </Card>
  )
}
