import { z } from 'zod'

/**
 * 订单相关输入验证Schema
 *
 * 安全修复: CVSS 6.8
 * 统一输入验证，防止SQL注入、XSS和无效数据
 */

// 订单创建表单验证schema
export const createOrderSchema = z.object({
  vehicleBrand: z.string().min(1, '请选择车辆品牌'),
  vehicleModel: z.string().min(1, '请选择车辆型号'),
  vehicleYear: z.number({
    required_error: '请选择生产年份',
    invalid_type_error: '生产年份必须是数字'
  }).int('生产年份必须是整数').min(2016, '仅支持2016年及以后的车型').max(new Date().getFullYear() + 1, '生产年份不能超过明年'),
  vin: z.string()
    .min(17, 'VIN码必须是17位')
    .max(17, 'VIN码必须是17位')
    .regex(/^[A-HJ-NPR-Z0-9]{17}$/i, 'VIN码格式不正确（仅支持数字和字母，不包含I/O/Q）'),
  fsdVersion: z.string().min(1, '请选择FSD版本'),
  price: z.number({
    required_error: '请输入转让价格',
    invalid_type_error: '转让价格必须是数字'
  })
    .positive('转让价格必须大于0')
    .max(999999.99, '转让价格不能超过999,999.99')
    .refine(
      (val) => {
        // 确保最多2位小数
        const str = val.toString()
        const decimalIndex = str.indexOf('.')
        if (decimalIndex === -1) return true
        return str.length - decimalIndex - 1 <= 2
      },
      { message: '转让价格最多支持2位小数' }
    )
})

export type CreateOrderFormData = z.infer<typeof createOrderSchema>

/**
 * 订单操作验证Schema
 */
export const orderActionSchema = z.discriminatedUnion('action', [
  // 支付操作
  z.object({
    action: z.literal('pay')
  }),
  // 转移操作
  z.object({
    action: z.literal('transfer'),
    transferProof: z.string().optional(),
    transferNote: z.string().max(500, '备注最多500字').optional()
  }),
  // 确认收货
  z.object({
    action: z.literal('confirm')
  }),
  // 取消订单
  z.object({
    action: z.literal('cancel')
  }),
  // 申请退款
  z.object({
    action: z.literal('request_refund'),
    reason: z.string().min(5, '退款原因至少5个字').max(500, '退款原因最多500字')
  }),
  // 同意退款
  z.object({
    action: z.literal('approve_refund')
  }),
  // 拒绝退款
  z.object({
    action: z.literal('reject_refund'),
    reason: z.string().min(5, '拒绝理由至少5个字').max(500, '拒绝理由最多500字')
  }),
  // 申请退款延期
  z.object({
    action: z.literal('request_refund_extension'),
    reason: z.string().min(5, '延期理由至少5个字').max(500, '延期理由最多500字')
  }),
  // 创建申诉
  z.object({
    action: z.literal('create_dispute'),
    reason: z.string().min(5, '申诉原因至少5个字').max(200, '申诉原因最多200字').optional(),
    description: z.string().min(10, '申诉详情至少10个字').max(1000, '申诉详情最多1000字')
  })
])

export type OrderActionInput = z.infer<typeof orderActionSchema>

// 车辆品牌选项
export const VEHICLE_BRANDS = [
  { value: '', label: '请选择品牌' },
  { value: 'Tesla Model 3', label: 'Tesla Model 3' },
  { value: 'Tesla Model Y', label: 'Tesla Model Y' },
  { value: 'Tesla Model S', label: 'Tesla Model S' },
  { value: 'Tesla Model X', label: 'Tesla Model X' }
] as const

// 车辆型号选项（根据品牌动态生成）
export const VEHICLE_MODELS: Record<string, readonly { value: string; label: string }[]> = {
  'Tesla Model 3': [
    { value: '', label: '请选择型号' },
    { value: '标准续航版', label: '标准续航版' },
    { value: '长续航版', label: '长续航版' },
    { value: 'Performance高性能版', label: 'Performance高性能版' }
  ],
  'Tesla Model Y': [
    { value: '', label: '请选择型号' },
    { value: '标准续航版', label: '标准续航版' },
    { value: '长续航版', label: '长续航版' },
    { value: 'Performance高性能版', label: 'Performance高性能版' }
  ],
  'Tesla Model S': [
    { value: '', label: '请选择型号' },
    { value: '长续航版', label: '长续航版' },
    { value: 'Plaid版', label: 'Plaid版' }
  ],
  'Tesla Model X': [
    { value: '', label: '请选择型号' },
    { value: '长续航版', label: '长续航版' },
    { value: 'Plaid版', label: 'Plaid版' }
  ]
} as const

// FSD版本选项
export const FSD_VERSIONS = [
  { value: '', label: '请选择FSD版本' },
  { value: 'FSD V11', label: 'FSD V11' },
  { value: 'FSD V12', label: 'FSD V12' },
  { value: 'FSD V13', label: 'FSD V13' }
] as const

// 生成年份选项（2016年至明年）
export const generateYearOptions = () => {
  const currentYear = new Date().getFullYear()
  const years = []

  years.push({ value: 0, label: '请选择年份' })

  for (let year = currentYear + 1; year >= 2016; year--) {
    years.push({ value: year, label: `${year}年` })
  }

  return years
}

// 平台费率
export const PLATFORM_FEE_RATE = 0.03

// 计算平台手续费
export const calculatePlatformFee = (price: number): number => {
  return Math.round(price * PLATFORM_FEE_RATE * 100) / 100
}

// 计算托管金额
export const calculateEscrowAmount = (price: number): number => {
  return price
}
