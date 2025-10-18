import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import type { OrderFilterType, OrderStatusFilter } from '@/hooks/useOrders'

interface OrderFiltersProps {
  filterType: OrderFilterType
  statusFilter: OrderStatusFilter
  onFilterTypeChange: (type: OrderFilterType) => void
  onStatusFilterChange: (status: OrderStatusFilter) => void
}

const FILTER_TYPES: Array<{ value: OrderFilterType; label: string }> = [
  { value: 'market', label: '市场浏览' },
  { value: 'all', label: '我的全部' },
  { value: 'sell', label: '我卖出的' },
  { value: 'buy', label: '我买入的' }
]

const STATUS_OPTIONS: Array<{ value: OrderStatusFilter; label: string }> = [
  { value: 'active', label: '进行中' },
  { value: 'all', label: '全部状态' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'PAID', label: '已支付' },
  { value: 'TRANSFERRING', label: '转移中' },
  { value: 'COMPLETED', label: '已完成' },
  { value: 'CANCELLED', label: '已取消' }
]

export function OrderFilters({
  filterType,
  statusFilter,
  onFilterTypeChange,
  onStatusFilterChange
}: OrderFiltersProps) {
  const isMarketView = filterType === 'market'

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          筛选订单
        </CardTitle>
      </CardHeader>

      <CardContent>
        <div className="flex gap-6 flex-wrap">
          {/* Order Type Filter */}
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700">
              订单类型
            </label>
            <div className="flex gap-2 flex-wrap">
              {FILTER_TYPES.map((type) => (
                <Button
                  key={type.value}
                  variant={filterType === type.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onFilterTypeChange(type.value)}
                  className="transition-all"
                >
                  {type.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Status Filter - 只在非市场浏览模式显示 */}
          {!isMarketView && (
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                订单状态
              </label>
              <select
                value={statusFilter}
                onChange={(e) => onStatusFilterChange(e.target.value as OrderStatusFilter)}
                className="flex h-9 w-full min-w-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
