'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PriceSummary } from '@/components/orders/PriceSummary'
import { TransactionGuide } from '@/components/orders/TransactionGuide'
import {
  createOrderSchema,
  type CreateOrderFormData,
  VEHICLE_BRANDS,
  VEHICLE_MODELS,
  FSD_VERSIONS,
  generateYearOptions
} from '@/lib/validations/order'

export default function CreateOrderPage() {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm<CreateOrderFormData>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      vehicleBrand: '',
      vehicleModel: '',
      vehicleYear: 0,
      vin: '',
      fsdVersion: '',
      price: 0
    }
  })

  const watchedPrice = watch('price')
  const watchedBrand = watch('vehicleBrand')

  // 检查登录状态
  useEffect(() => {
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      localStorage.setItem('redirectAfterLogin', '/orders/create')
      toast.error('请先登录后再发布订单')
      router.push('/login')
    }
  }, [router])

  // 当品牌改变时，重置型号
  useEffect(() => {
    if (watchedBrand !== selectedBrand) {
      setSelectedBrand(watchedBrand)
      setValue('vehicleModel', '')
    }
  }, [watchedBrand, selectedBrand, setValue])

  const onSubmit = async (data: CreateOrderFormData) => {
    try {
      setIsSubmitting(true)

      // ⚠️ 关键：保留价格精度处理逻辑 - 确保最多2位小数
      const priceDecimal = Math.round(data.price * 100) / 100

      const token = localStorage.getItem('token')
      if (!token) {
        toast.error('请先登录')
        router.push('/login')
        return
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...data,
          price: priceDecimal // 使用精度处理后的价格
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '创建订单失败')
      }

      toast.success('订单发布成功！', {
        description: `订单号：${result.data.orderNo}`
      })

      // 跳转到订单详情页
      router.push(`/orders/${result.data.id}`)
    } catch (error: any) {
      console.error('创建订单失败:', error)
      toast.error(error.message || '创建订单失败，请重试')
    } finally {
      setIsSubmitting(false)
    }
  }

  const yearOptions = generateYearOptions()
  const modelOptions = selectedBrand ? VEHICLE_MODELS[selectedBrand] : [{ value: '', label: '请先选择品牌' }]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 导航栏 */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              FSD担保交易平台
            </Link>
            <div className="flex items-center gap-4">
              <Link href="/orders">
                <Button variant="ghost">我的订单</Button>
              </Link>
              <Link href="/profile">
                <Button variant="outline">个人中心</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 页头 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">发布转让订单</h1>
          <p className="text-gray-600">填写车辆和FSD权限信息，发布您的转让订单</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：表单 */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* 车辆信息部分 */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  车辆信息
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 车辆品牌 */}
                  <div>
                    <Label htmlFor="vehicleBrand" className="required">车辆品牌</Label>
                    <Select
                      value={watchedBrand}
                      onValueChange={(value) => setValue('vehicleBrand', value)}
                    >
                      <SelectTrigger className={errors.vehicleBrand ? 'border-red-500' : ''}>
                        <SelectValue placeholder="请选择品牌" />
                      </SelectTrigger>
                      <SelectContent>
                        {VEHICLE_BRANDS.filter(b => b.value).map((brand) => (
                          <SelectItem key={brand.value} value={brand.value}>
                            {brand.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.vehicleBrand && (
                      <p className="text-sm text-red-500 mt-1">{errors.vehicleBrand.message}</p>
                    )}
                  </div>

                  {/* 车辆型号 */}
                  <div>
                    <Label htmlFor="vehicleModel" className="required">车辆型号</Label>
                    <Select
                      value={watch('vehicleModel')}
                      onValueChange={(value) => setValue('vehicleModel', value)}
                      disabled={!selectedBrand}
                    >
                      <SelectTrigger className={errors.vehicleModel ? 'border-red-500' : ''}>
                        <SelectValue placeholder={selectedBrand ? "请选择型号" : "请先选择品牌"} />
                      </SelectTrigger>
                      <SelectContent>
                        {modelOptions.filter(m => m.value).map((model) => (
                          <SelectItem key={model.value} value={model.value}>
                            {model.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.vehicleModel && (
                      <p className="text-sm text-red-500 mt-1">{errors.vehicleModel.message}</p>
                    )}
                  </div>

                  {/* 生产年份 */}
                  <div>
                    <Label htmlFor="vehicleYear" className="required">生产年份</Label>
                    <Select
                      value={watch('vehicleYear')?.toString() || '0'}
                      onValueChange={(value) => setValue('vehicleYear', parseInt(value))}
                    >
                      <SelectTrigger className={errors.vehicleYear ? 'border-red-500' : ''}>
                        <SelectValue placeholder="请选择年份" />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.filter(y => y.value > 0).map((year) => (
                          <SelectItem key={year.value} value={year.value.toString()}>
                            {year.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.vehicleYear && (
                      <p className="text-sm text-red-500 mt-1">{errors.vehicleYear.message}</p>
                    )}
                  </div>

                  {/* VIN码 */}
                  <div>
                    <Label htmlFor="vin" className="required">VIN码</Label>
                    <Input
                      id="vin"
                      type="text"
                      placeholder="请输入17位VIN码"
                      maxLength={17}
                      className={errors.vin ? 'border-red-500' : ''}
                      {...register('vin', {
                        onChange: (e) => {
                          // 自动转换为大写
                          e.target.value = e.target.value.toUpperCase()
                        }
                      })}
                    />
                    {errors.vin && (
                      <p className="text-sm text-red-500 mt-1">{errors.vin.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      VIN码是车辆的唯一识别码，可在行驶证或车辆铭牌上找到
                    </p>
                  </div>
                </div>
              </div>

              {/* FSD信息部分 */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  FSD权限信息
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* FSD版本 */}
                  <div>
                    <Label htmlFor="fsdVersion" className="required">FSD版本</Label>
                    <Select
                      value={watch('fsdVersion')}
                      onValueChange={(value) => setValue('fsdVersion', value)}
                    >
                      <SelectTrigger className={errors.fsdVersion ? 'border-red-500' : ''}>
                        <SelectValue placeholder="请选择FSD版本" />
                      </SelectTrigger>
                      <SelectContent>
                        {FSD_VERSIONS.filter(f => f.value).map((version) => (
                          <SelectItem key={version.value} value={version.value}>
                            {version.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.fsdVersion && (
                      <p className="text-sm text-red-500 mt-1">{errors.fsdVersion.message}</p>
                    )}
                  </div>

                  {/* 转让价格 */}
                  <div>
                    <Label htmlFor="price" className="required">转让价格（¥）</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="请输入转让价格"
                      className={`${errors.price ? 'border-red-500' : ''} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                      {...register('price', {
                        valueAsNumber: true,
                        onChange: (e) => {
                          // ⚠️ 关键：实时价格精度处理 - 确保最多2位小数
                          if (e.target.value) {
                            const value = parseFloat(e.target.value)
                            if (!isNaN(value)) {
                              const rounded = Math.round(value * 100) / 100
                              setValue('price', rounded)
                            }
                          }
                        }
                      })}
                    />
                    {errors.price && (
                      <p className="text-sm text-red-500 mt-1">{errors.price.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      支持小数金额（如 64000.50），平台将收取3%手续费
                    </p>
                  </div>
                </div>
              </div>

              {/* 提交按钮 */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      发布中...
                    </>
                  ) : (
                    '发布订单'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  disabled={isSubmitting}
                >
                  取消
                </Button>
              </div>
            </form>
          </div>

          {/* 右侧：费用明细 */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 space-y-6">
              <PriceSummary price={watchedPrice || 0} />
            </div>
          </div>
        </div>

        {/* 底部：交易说明 */}
        <div className="mt-8">
          <TransactionGuide />
        </div>
      </div>
    </div>
  )
}
