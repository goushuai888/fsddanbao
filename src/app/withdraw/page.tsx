'use client'

/**
 * 用户提现页面
 *
 * 功能：
 * - 申请提现到银行卡/支付宝/微信
 * - 邮箱验证码验证（安全保护）
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Navbar } from '@/components/layout/Navbar'
import { EmailVerificationInput } from '@/components/verification/EmailVerificationInput'
import { useAuth } from '@/hooks/useAuth'
import { formatPrice } from '@/lib/utils/helpers/common'
import { toast } from 'sonner'

type WithdrawMethod = 'bank' | 'alipay' | 'wechat'

export default function WithdrawPage() {
  const router = useRouter()
  const { user, isLoading: authLoading, logout } = useAuth(true)

  const [method, setMethod] = useState<WithdrawMethod>('alipay')
  const [amount, setAmount] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [isVerified, setIsVerified] = useState(false)
  const [loading, setLoading] = useState(false)

  // 银行卡信息
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountName, setAccountName] = useState('')

  // 支付宝/微信账号
  const [alipayAccount, setAlipayAccount] = useState('')
  const [wechatAccount, setWechatAccount] = useState('')

  // 计算手续费（示例：2%）
  const fee = Number(amount) * 0.02 || 0
  const actualAmount = Number(amount) - fee

  // 权限检查
  useEffect(() => {
    if (!authLoading && !user) {
      alert('请先登录')
      router.push('/login')
    }
  }, [authLoading, user, router])

  // 提交提现申请
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // 验证余额
    if (!user?.balance || Number(amount) > Number(user.balance)) {
      toast.error('余额不足')
      return
    }

    // 验证金额
    if (!amount || Number(amount) <= 0) {
      toast.error('请输入提现金额')
      return
    }

    // 验证验证码
    if (!isVerified) {
      toast.error('请先完成邮箱验证')
      return
    }

    // 验证收款信息
    if (method === 'bank' && (!bankName || !bankAccount || !accountName)) {
      toast.error('请完整填写银行卡信息')
      return
    }
    if (method === 'alipay' && !alipayAccount) {
      toast.error('请填写支付宝账号')
      return
    }
    if (method === 'wechat' && !wechatAccount) {
      toast.error('请填写微信账号')
      return
    }

    try {
      setLoading(true)

      const response = await fetch('/api/user/withdraw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: Number(amount),
          withdrawMethod: method,
          bankName: method === 'bank' ? bankName : undefined,
          bankAccount: method === 'bank' ? bankAccount : undefined,
          accountName: method === 'bank' ? accountName : undefined,
          alipayAccount: method === 'alipay' ? alipayAccount : undefined,
          wechatAccount: method === 'wechat' ? wechatAccount : undefined,
          verificationCode // 验证码
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('提现申请已提交', {
          description: '预计1-3个工作日到账，请耐心等待'
        })
        router.push('/profile')
      } else {
        toast.error('提现申请失败', {
          description: data.error || '请稍后重试'
        })
      }
    } catch (error) {
      console.error('提现申请错误:', error)
      toast.error('网络错误', {
        description: '请检查网络连接后重试'
      })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <p className="text-gray-500">加载中...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* 导航栏 */}
      <Navbar user={user} onLogout={logout} />

      {/* 主内容 */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">申请提现</h1>

          {/* 余额信息 */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-gray-600">可提现余额</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {formatPrice(Number(user.balance || 0))}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">手续费: 2%</p>
                  <p className="text-xs text-gray-500">1-3个工作日到账</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 提现表单 */}
          <Card>
            <CardHeader>
              <CardTitle>填写提现信息</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* 提现金额 */}
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    提现金额 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.01"
                    placeholder="请输入提现金额"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                    max={Number(user.balance || 0)}
                    className="text-lg"
                  />
                  {amount && (
                    <p className="text-sm text-gray-600 mt-2">
                      手续费: ¥{fee.toFixed(2)}，实际到账: <strong className="text-blue-600">¥{actualAmount.toFixed(2)}</strong>
                    </p>
                  )}
                </div>

                {/* 提现方式 */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    提现方式 <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <Button
                      type="button"
                      variant={method === 'alipay' ? 'default' : 'outline'}
                      onClick={() => setMethod('alipay')}
                    >
                      支付宝
                    </Button>
                    <Button
                      type="button"
                      variant={method === 'wechat' ? 'default' : 'outline'}
                      onClick={() => setMethod('wechat')}
                    >
                      微信
                    </Button>
                    <Button
                      type="button"
                      variant={method === 'bank' ? 'default' : 'outline'}
                      onClick={() => setMethod('bank')}
                    >
                      银行卡
                    </Button>
                  </div>
                </div>

                {/* 银行卡信息 */}
                {method === 'bank' && (
                  <>
                    <div>
                      <label htmlFor="bankName" className="block text-sm font-medium text-gray-700 mb-2">
                        银行名称 <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="bankName"
                        placeholder="如：中国工商银行"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        required={method === 'bank'}
                      />
                    </div>
                    <div>
                      <label htmlFor="bankAccount" className="block text-sm font-medium text-gray-700 mb-2">
                        银行卡号 <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="bankAccount"
                        placeholder="请输入银行卡号"
                        value={bankAccount}
                        onChange={(e) => setBankAccount(e.target.value)}
                        required={method === 'bank'}
                      />
                    </div>
                    <div>
                      <label htmlFor="accountName" className="block text-sm font-medium text-gray-700 mb-2">
                        开户名 <span className="text-red-500">*</span>
                      </label>
                      <Input
                        id="accountName"
                        placeholder="请输入开户人姓名"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        required={method === 'bank'}
                      />
                    </div>
                  </>
                )}

                {/* 支付宝账号 */}
                {method === 'alipay' && (
                  <div>
                    <label htmlFor="alipayAccount" className="block text-sm font-medium text-gray-700 mb-2">
                      支付宝账号 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="alipayAccount"
                      placeholder="请输入支付宝账号（邮箱或手机号）"
                      value={alipayAccount}
                      onChange={(e) => setAlipayAccount(e.target.value)}
                      required={method === 'alipay'}
                    />
                  </div>
                )}

                {/* 微信账号 */}
                {method === 'wechat' && (
                  <div>
                    <label htmlFor="wechatAccount" className="block text-sm font-medium text-gray-700 mb-2">
                      微信账号 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      id="wechatAccount"
                      placeholder="请输入微信账号"
                      value={wechatAccount}
                      onChange={(e) => setWechatAccount(e.target.value)}
                      required={method === 'wechat'}
                    />
                  </div>
                )}

                {/* 邮箱验证码 */}
                <EmailVerificationInput
                  type="WITHDRAWAL"
                  value={verificationCode}
                  onChange={setVerificationCode}
                  onVerified={() => setIsVerified(true)}
                  disabled={loading}
                />

                {/* 提交按钮 */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="submit"
                    disabled={loading || !isVerified}
                    className="flex-1"
                  >
                    {loading ? '提交中...' : '提交申请'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.back()}
                    disabled={loading}
                  >
                    取消
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
