import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface EmptyStateProps {
  title?: string
  description?: string
  actionLabel?: string
  actionHref?: string
  icon?: React.ReactNode
}

export function EmptyState({
  title = '暂无订单',
  description = '您还没有任何订单',
  actionLabel = '发布第一个订单',
  actionHref = '/orders/create',
  icon
}: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="py-16 text-center">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {icon || (
            <svg
              className="w-16 h-16 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          )}
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-gray-500 mb-6 max-w-sm mx-auto">
          {description}
        </p>

        {/* Action Button */}
        {actionHref && (
          <Link href={actionHref}>
            <Button size="lg" className="shadow-md hover:shadow-lg transition-shadow">
              {actionLabel}
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
