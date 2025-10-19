'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/layout/Navbar'

export default function HomePage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [latestOrders, setLatestOrders] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState(true)

  useEffect(() => {
    // 检查登录状态
    const token = localStorage.getItem('token')
    const userData = localStorage.getItem('user')

    if (token && userData) {
      setIsLoggedIn(true)
      setUser(JSON.parse(userData))
    }

    // 加载最新市场订单
    fetchLatestOrders(token)
  }, [])

  const fetchLatestOrders = async (token: string | null) => {
    try {
      setLoadingOrders(true)
      const headers: any = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/orders?type=market', { headers })
      const data = await response.json()

      if (data.success) {
        setLatestOrders(data.data.slice(0, 6)) // 只显示前6个
      }
    } catch (error) {
      console.error('获取最新订单错误:', error)
    } finally {
      setLoadingOrders(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setIsLoggedIn(false)
    setUser(null)
    router.refresh()
  }

  const handleProtectedAction = (path: string) => {
    if (!isLoggedIn) {
      // 保存目标路径，登录后跳转
      localStorage.setItem('redirectAfterLogin', path)
      router.push('/login')
    } else {
      router.push(path)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <Navbar user={isLoggedIn ? user : null} onLogout={handleLogout} />

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        {/* 顶部横幅 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg p-8 mb-8">
          <h1 className="text-4xl font-bold mb-4">Tesla FSD 安全交易平台</h1>
          <p className="text-xl mb-6">
            专业的FSD自动驾驶权限转移担保服务
            {!isLoggedIn && <span className="text-sm ml-3 opacity-80">💡 需先登录账户</span>}
          </p>
          <div className="flex gap-4">
            <Button
              size="lg"
              variant="secondary"
              onClick={() => handleProtectedAction('/orders/create')}
            >
              {isLoggedIn ? '发布转让' : '登录后发布'}
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-white border-white bg-transparent hover:bg-white hover:text-blue-600"
              onClick={() => handleProtectedAction('/orders')}
            >
              {isLoggedIn ? '浏览订单' : '登录后浏览'}
            </Button>
          </div>
        </div>

        {/* 功能特色 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>💰 资金担保</CardTitle>
              <CardDescription>
                买家付款到平台托管，确认收货后释放给卖家
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>🔒 实名认证</CardTitle>
              <CardDescription>
                所有用户必须完成实名认证，保障交易安全
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>⚖️ 申诉保障</CardTitle>
              <CardDescription>
                遇到纠纷可提交申诉，平台介入公正处理
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* 交易流程 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>交易流程</CardTitle>
            <CardDescription>安全、简单、快捷的FSD权限转移流程</CardDescription>
          </CardHeader>
          <CardContent>
            {/* 移动端：横向滚动 */}
            <div className="md:hidden overflow-x-auto pb-4">
              <div className="flex gap-4 min-w-max">
                <div className="text-center w-32 flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold">
                    1
                  </div>
                  <h3 className="font-semibold mb-1 text-sm">发布转让</h3>
                  <p className="text-xs text-gray-600">卖家发布信息</p>
                </div>

                <div className="flex items-center text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                <div className="text-center w-32 flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold">
                    2
                  </div>
                  <h3 className="font-semibold mb-1 text-sm">买家下单</h3>
                  <p className="text-xs text-gray-600">付款到托管</p>
                </div>

                <div className="flex items-center text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                <div className="text-center w-32 flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold">
                    3
                  </div>
                  <h3 className="font-semibold mb-1 text-sm">权限转移</h3>
                  <p className="text-xs text-gray-600">卖家发起转移</p>
                </div>

                <div className="flex items-center text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                <div className="text-center w-32 flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold">
                    4
                  </div>
                  <h3 className="font-semibold mb-1 text-sm">确认收货</h3>
                  <p className="text-xs text-gray-600">买家确认权限</p>
                </div>

                <div className="flex items-center text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                <div className="text-center w-32 flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-lg font-bold">
                    5
                  </div>
                  <h3 className="font-semibold mb-1 text-sm">完成交易</h3>
                  <p className="text-xs text-gray-600">平台释放款项</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-2 text-center">👈 左右滑动查看完整流程</p>
            </div>

            {/* 平板及以上：网格布局 */}
            <div className="hidden md:grid grid-cols-5 gap-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  1
                </div>
                <h3 className="font-semibold mb-1">发布转让</h3>
                <p className="text-sm text-gray-600">卖家发布FSD转让信息</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  2
                </div>
                <h3 className="font-semibold mb-1">买家下单</h3>
                <p className="text-sm text-gray-600">买家付款到平台托管</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  3
                </div>
                <h3 className="font-semibold mb-1">权限转移</h3>
                <p className="text-sm text-gray-600">卖家发起FSD权限转移</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  4
                </div>
                <h3 className="font-semibold mb-1">确认收货</h3>
                <p className="text-sm text-gray-600">买家确认收到权限</p>
              </div>

              <div className="text-center">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">
                  5
                </div>
                <h3 className="font-semibold mb-1">完成交易</h3>
                <p className="text-sm text-gray-600">平台释放款项给卖家</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 最新订单 */}
        <Card>
          <CardHeader>
            <CardTitle>最新订单</CardTitle>
            <CardDescription>查看最新发布的FSD转让订单</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="text-center py-8 text-gray-500">
                <p>加载中...</p>
              </div>
            ) : latestOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>暂无订单数据</p>
                <p className="text-sm mt-2">
                  {isLoggedIn ? '还没有订单，去发布第一个吧' : '请先登录后查看订单列表'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {latestOrders.map((order) => (
                  <Card key={order.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">
                        {order.vehicleBrand} {order.vehicleModel}
                      </CardTitle>
                      <CardDescription>
                        {order.vehicleYear} 年 · {order.fsdVersion}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">价格:</span>
                          <span className="font-bold text-lg text-blue-600">
                            ¥{order.price.toLocaleString()}
                          </span>
                        </div>
                        {order.seller && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">卖家:</span>
                            <span>
                              {order.seller.name || '未命名'}
                              {order.seller.verified && <span className="text-green-600 ml-1">✓</span>}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter>
                      <Link href={`/orders/${order.id}`} className="w-full">
                        <Button variant="outline" className="w-full">
                          {isLoggedIn ? '查看详情' : '登录后查看'}
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleProtectedAction('/orders')}
            >
              {isLoggedIn ? '查看全部订单' : '登录后查看'}
            </Button>
          </CardFooter>
        </Card>
      </main>

      {/* 页脚 */}
      <footer className="bg-white border-t mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-gray-600">
            <p>© 2024 FSD担保交易平台. All rights reserved.</p>
            <p className="text-sm mt-2">安全、透明、可信赖的FSD权限转移服务</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
