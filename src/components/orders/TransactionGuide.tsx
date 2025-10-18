export function TransactionGuide() {
  const steps = [
    {
      number: 1,
      title: '发布订单',
      description: '卖家填写车辆信息和转让价格，发布订单',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      ),
      color: 'from-blue-500 to-blue-600'
    },
    {
      number: 2,
      title: '买家支付',
      description: '买家支付款项，由平台托管保障双方权益',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'from-green-500 to-green-600'
    },
    {
      number: 3,
      title: '权限转移',
      description: '卖家提交FSD权限转移凭证，买家核对确认',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      ),
      color: 'from-purple-500 to-purple-600'
    },
    {
      number: 4,
      title: '交易完成',
      description: '买家确认收货后，平台释放款项给卖家（扣除3%手续费）',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'from-emerald-500 to-emerald-600'
    }
  ]

  const protections = [
    {
      title: '平台托管保护',
      description: '买家支付的款项由平台托管，确保卖家完成转移后才能收到款项',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: '申诉退款机制',
      description: '如遇纠纷，买家可申请平台介入仲裁，保障权益',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
      )
    },
    {
      title: '完整操作记录',
      description: '所有交易操作都有完整的时间线记录，可追溯可查证',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
        </svg>
      )
    }
  ]

  return (
    <div className="space-y-6">
      {/* 交易流程 */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center">
          <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          交易流程
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                {/* 步骤图标 */}
                <div className={`w-12 h-12 bg-gradient-to-br ${step.color} rounded-lg flex items-center justify-center text-white mb-3 shadow-md`}>
                  {step.icon}
                </div>

                {/* 步骤标题 */}
                <div className="flex items-center mb-2">
                  <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br ${step.color} text-white text-xs font-bold mr-2`}>
                    {step.number}
                  </span>
                  <h4 className="font-semibold text-gray-900">{step.title}</h4>
                </div>

                {/* 步骤描述 */}
                <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
              </div>

              {/* 连接箭头（最后一个不显示） */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                  <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 安全保障 */}
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <svg className="w-5 h-5 mr-2 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          安全保障
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {protections.map((protection, index) => (
            <div key={index} className="bg-white rounded-lg p-4 border border-green-200">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mr-3">
                  {protection.icon}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">{protection.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{protection.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 重要提示 */}
      <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-amber-600 mr-3 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <div>
            <h4 className="font-semibold text-amber-900 mb-1">重要提示</h4>
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li>请确保车辆信息真实准确，特别是VIN码和FSD版本</li>
              <li>转让价格一经设定，订单发布后不可修改</li>
              <li>平台收取3%手续费，从卖家实收金额中扣除</li>
              <li>如有疑问，请联系客服或查看帮助文档</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
