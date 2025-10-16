'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { calculatePlatformFee, formatPrice } from '@/lib/utils'

export default function CreateOrderPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)

  const [formData, setFormData] = useState({
    vehicleBrand: 'Tesla',
    vehicleModel: '',
    vehicleYear: new Date().getFullYear(),
    vin: '',
    fsdVersion: '',
    price: 0
  })

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (!token || !userData) {
      // 保存当前路径，登录后返回
      localStorage.setItem('redirectAfterLogin', '/orders/create')
      alert('请先登录后再发布订单')
      router.push('/login')
      return
    }

    setUser(JSON.parse(userData))
  }, [router])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: name === 'price' || name === 'vehicleYear' ? Number(value) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('token')

      // 验证必填字段
      if (!formData.vehicleModel || !formData.fsdVersion || !formData.price) {
        alert('请填写完整的订单信息')
        setLoading(false)
        return
      }

      if (formData.price <= 0) {
        alert('价格必须大于0')
        setLoading(false)
        return
      }

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (data.success) {
        alert('订单发布成功！')
        router.push('/orders')
      } else {
        alert(data.error || '发布失败')
      }
    } catch (error) {
      console.error('发布订单错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const platformFee = calculatePlatformFee(formData.price)
  const sellerWillReceive = formData.price - platformFee

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <nav className="bg-white border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            FSD担保交易平台
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              欢迎，{user?.name || user?.email}
            </span>
            <Link href="/profile">
              <Button variant="outline">个人中心</Button>
            </Link>
            <Link href="/orders">
              <Button variant="outline">我的订单</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <Link href="/orders" className="text-blue-600 hover:underline">
              ← 返回订单列表
            </Link>
          </div>

          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>发布FSD转让订单</CardTitle>
                <CardDescription>
                  填写以下信息发布您的FSD转让订单
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* 车辆品牌 */}
                <div>
                  <label htmlFor="vehicleBrand" className="block text-sm font-medium mb-2">
                    车辆品牌 *
                  </label>
                  <select
                    id="vehicleBrand"
                    name="vehicleBrand"
                    value={formData.vehicleBrand}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="Tesla">Tesla</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">目前仅支持Tesla车辆</p>
                </div>

                {/* 车辆型号 */}
                <div>
                  <label htmlFor="vehicleModel" className="block text-sm font-medium mb-2">
                    车辆型号 *
                  </label>
                  <select
                    id="vehicleModel"
                    name="vehicleModel"
                    value={formData.vehicleModel}
                    onChange={handleChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    <option value="">请选择车型</option>
                    <option value="Model S">Model S</option>
                    <option value="Model 3">Model 3</option>
                    <option value="Model X">Model X</option>
                    <option value="Model Y">Model Y</option>
                    <option value="Model Y L">Model Y L</option>
                  </select>
                </div>

                {/* 车辆年份 */}
                <div>
                  <label htmlFor="vehicleYear" className="block text-sm font-medium mb-2">
                    车辆年份 *
                  </label>
                  <Input
                    id="vehicleYear"
                    name="vehicleYear"
                    type="number"
                    min="2016"
                    max={new Date().getFullYear() + 1}
                    value={formData.vehicleYear}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* 车架号 */}
                <div>
                  <label htmlFor="vin" className="block text-sm font-medium mb-2">
                    车架号（VIN）
                  </label>
                  <Input
                    id="vin"
                    name="vin"
                    type="text"
                    placeholder="选填，如：5YJ3E1EA..."
                    value={formData.vin}
                    onChange={handleChange}
                    maxLength={17}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    车架号会部分隐藏显示，用于增加买家信任
                  </p>
                </div>

                {/* FSD版本 */}
                <div>
                  <label htmlFor="fsdVersion" className="block text-sm font-medium mb-2">
                    FSD版本 *
                  </label>
                  <Input
                    id="fsdVersion"
                    name="fsdVersion"
                    type="text"
                    placeholder="例如：FSD Beta 12.3、HW3.0 等"
                    value={formData.fsdVersion}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* 价格 */}
                <div>
                  <label htmlFor="price" className="block text-sm font-medium mb-2">
                    转让价格（元）*
                  </label>
                  <Input
                    id="price"
                    name="price"
                    type="number"
                    min="1"
                    step="0.01"
                    placeholder="请输入转让价格"
                    value={formData.price || ''}
                    onChange={handleChange}
                    required
                  />
                </div>

                {/* 费用明细 */}
                {formData.price > 0 && (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">费用明细</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">转让价格:</span>
                        <span className="font-medium">{formatPrice(formData.price)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">平台手续费 (3%):</span>
                        <span className="font-medium text-red-600">-{formatPrice(platformFee)}</span>
                      </div>
                      <div className="border-t border-blue-300 pt-2 flex justify-between">
                        <span className="font-semibold">您将收到:</span>
                        <span className="font-bold text-lg text-green-600">
                          {formatPrice(sellerWillReceive)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 交易说明 */}
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">⚠️ 交易说明</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-gray-700 space-y-2">
                    <p>• 发布订单后，买家可以下单并支付到平台托管</p>
                    <p>• 买家付款后，您需要在Tesla App中发起FSD权限转移</p>
                    <p>• 买家确认收到权限后，平台会将款项打给您</p>
                    <p>• 平台收取3%的手续费用于维护运营和提供担保服务</p>
                    <p>• 请确保您的车辆FSD功能正常，避免交易纠纷</p>
                  </CardContent>
                </Card>
              </CardContent>

              <CardFooter className="flex gap-4">
                <Link href="/orders" className="flex-1">
                  <Button type="button" variant="outline" className="w-full">
                    取消
                  </Button>
                </Link>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading}
                >
                  {loading ? '发布中...' : '发布订单'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  )
}
