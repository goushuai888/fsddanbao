import { formatPrice } from '@/lib/utils/helpers/common'
import { calculatePlatformFee, ORDER_RULES } from '@/lib/domain/policies/business-rules'

interface PriceSummaryProps {
  price: number
  className?: string
}

export function PriceSummary({ price, className = '' }: PriceSummaryProps) {
  const platformFee = calculatePlatformFee(price)
  const escrowAmount = price

  return (
    <div className={`bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
        <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
        费用明细
      </h3>

      <div className="space-y-3">
        {/* 转让价格 */}
        <div className="flex justify-between items-center py-2 border-b border-blue-100">
          <span className="text-gray-600 text-sm">转让价格</span>
          <span className="text-lg font-semibold text-gray-900">
            {price > 0 ? formatPrice(price) : '¥0.00'}
          </span>
        </div>

        {/* 平台手续费 */}
        <div className="flex justify-between items-center py-2 border-b border-blue-100">
          <span className="text-gray-600 text-sm flex items-center">
            平台手续费
            <span className="ml-1 text-xs text-blue-600">({(ORDER_RULES.FEES.PLATFORM_FEE_RATE * 100).toFixed(0)}%)</span>
          </span>
          <span className="text-sm font-medium text-red-600">
            -{price > 0 ? formatPrice(platformFee) : '¥0.00'}
          </span>
        </div>

        {/* 托管金额 */}
        <div className="flex justify-between items-center py-3 bg-white rounded-md px-3 shadow-sm">
          <span className="text-gray-700 font-medium">买家需支付</span>
          <span className="text-xl font-bold text-blue-600">
            {price > 0 ? formatPrice(escrowAmount) : '¥0.00'}
          </span>
        </div>

        {/* 卖家实收 */}
        <div className="flex justify-between items-center py-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-md px-3 border border-green-200">
          <span className="text-gray-700 font-medium">卖家实收</span>
          <span className="text-xl font-bold text-green-600">
            {price > 0 ? formatPrice(price - platformFee) : '¥0.00'}
          </span>
        </div>
      </div>

      {/* 提示信息 */}
      {price > 0 && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md border border-blue-200">
          <p className="text-xs text-blue-700 leading-relaxed">
            <svg className="w-4 h-4 inline mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            买家支付的款项将由平台托管，待交易完成后释放给卖家
          </p>
        </div>
      )}
    </div>
  )
}
