import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TimelineEvent } from '@/types/order'
import { formatDate } from '@/lib/utils'

interface OrderTimelineProps {
  events: TimelineEvent[]
}

export function OrderTimeline({ events }: OrderTimelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>订单时间线</CardTitle>
        <CardDescription>完整记录所有交易操作和资金流转</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={index} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 ${event.color} rounded-full mt-1`}></div>
                {index < events.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-200 mt-1"></div>
                )}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium">{event.title}</span>
                  <span className="text-xs text-gray-500">
                    {formatDate(event.time)}
                  </span>
                </div>
                {event.operator && (
                  <div className="text-xs text-gray-600 mb-1">
                    操作人：{event.operator}
                  </div>
                )}
                {event.description && (
                  <div className="text-sm text-gray-600 whitespace-pre-line">
                    {event.description}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
