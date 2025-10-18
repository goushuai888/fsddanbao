import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatPrice, maskString } from '@/lib/utils'
import { Order, UserInfo } from '@/types/order'

interface OrderVehicleInfoProps {
  order: Order
}

export function OrderVehicleInfo({ order }: OrderVehicleInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>车辆信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">品牌型号:</span>
          <span className="font-medium">
            {order.vehicleBrand} {order.vehicleModel}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">年份:</span>
          <span className="font-medium">{order.vehicleYear}</span>
        </div>
        {order.vin && (
          <div className="flex justify-between">
            <span className="text-gray-600">车架号:</span>
            <span className="font-medium font-mono text-sm">
              {maskString(order.vin, 5, 4)}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-600">FSD版本:</span>
          <span className="font-medium">{order.fsdVersion}</span>
        </div>
      </CardContent>
    </Card>
  )
}

interface OrderPriceInfoProps {
  order: Order
}

export function OrderPriceInfo({ order }: OrderPriceInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>价格信息</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">转让价格:</span>
          <span className="font-bold text-lg text-blue-600">
            {formatPrice(order.price)}
          </span>
        </div>
        {order.platformFee && (
          <div className="flex justify-between">
            <span className="text-gray-600">平台手续费:</span>
            <span className="text-red-600">{formatPrice(order.platformFee)}</span>
          </div>
        )}
        {order.escrowAmount && (
          <div className="flex justify-between">
            <span className="text-gray-600">托管金额:</span>
            <span className="font-medium">{formatPrice(order.escrowAmount)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface OrderUserInfoProps {
  title: string
  user: UserInfo
}

export function OrderUserInfo({ title, user }: OrderUserInfoProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex justify-between">
          <span className="text-gray-600">姓名:</span>
          <span className="font-medium">
            {user.name || '未命名'}
            {user.verified && <span className="text-green-600 ml-1">✓已认证</span>}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">邮箱:</span>
          <span className="text-sm">{user.email}</span>
        </div>
        {user.phone && (
          <div className="flex justify-between">
            <span className="text-gray-600">手机:</span>
            <span className="text-sm">{maskString(user.phone, 3, 4)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
