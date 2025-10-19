'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Navbar } from '@/components/layout/Navbar'
import { formatDate, formatPrice } from '@/lib/utils/helpers/common'
import { ArrowLeft } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Withdrawal {
  id: string
  amount: number
  fee: number
  actualAmount: number
  withdrawMethod: string
  bankName: string | null
  bankAccount: string | null
  accountName: string | null
  alipayAccount: string | null
  wechatAccount: string | null
  status: string
  reviewNote: string | null
  rejectReason: string | null
  createdAt: string
  reviewedAt: string | null
  completedAt: string | null
}

interface User {
  id: string
  name: string | null
  email: string
  role: string
  verified: boolean
  balance: number
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING: { label: '待审核', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: '已批准', color: 'bg-blue-100 text-blue-800' },
  REJECTED: { label: '已拒绝', color: 'bg-red-100 text-red-800' },
  PROCESSING: { label: '处理中', color: 'bg-purple-100 text-purple-800' },
  COMPLETED: { label: '已完成', color: 'bg-green-100 text-green-800' },
  FAILED: { label: '失败', color: 'bg-gray-100 text-gray-800' }
}

export default function WithdrawalsPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)

  // 申请对话框
  const [applyDialog, setApplyDialog] = useState(false)
  const [amount, setAmount] = useState('')
  const [withdrawMethod, setWithdrawMethod] = useState('bank')
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [alipayAccount, setAlipayAccount] = useState('')
  const [wechatAccount, setWechatAccount] = useState('')
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchUser()
    fetchWithdrawals()
  }, [])

  const fetchUser = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setUser(data.data)
      } else {
        router.push('/login')
      }
    } catch (error) {
      console.error('获取用户信息错误:', error)
      router.push('/login')
    }
  }

  const fetchWithdrawals = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token')

      const response = await fetch('/api/withdrawals', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        setWithdrawals(data.data || [])
      } else {
        alert(data.error || '获取提现记录失败')
      }
    } catch (error) {
      console.error('获取提现记录错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleApply = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('请输入有效的提现金额')
      return
    }

    if (!user || parseFloat(amount) > user.balance) {
      alert('提现金额不能超过账户余额')
      return
    }

    // 验证收款信息
    if (withdrawMethod === 'bank') {
      if (!bankName || !bankAccount || !accountName) {
        alert('请填写完整的银行信息')
        return
      }
    } else if (withdrawMethod === 'alipay') {
      if (!alipayAccount) {
        alert('请填写支付宝账号')
        return
      }
    } else if (withdrawMethod === 'wechat') {
      if (!wechatAccount) {
        alert('请填写微信账号')
        return
      }
    }

    try {
      setProcessing(true)
      const token = localStorage.getItem('token')

      const body: any = {
        amount: parseFloat(amount),
        withdrawMethod,
      }

      if (withdrawMethod === 'bank') {
        body.bankName = bankName
        body.bankAccount = bankAccount
        body.accountName = accountName
      } else if (withdrawMethod === 'alipay') {
        body.alipayAccount = alipayAccount
      } else if (withdrawMethod === 'wechat') {
        body.wechatAccount = wechatAccount
      }

      const response = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (data.success) {
        alert(data.message || '提现申请已提交')
        setApplyDialog(false)
        resetForm()
        fetchUser()
        fetchWithdrawals()
      } else {
        alert(data.error || '提现申请失败')
      }
    } catch (error) {
      console.error('申请提现错误:', error)
      alert('网络错误，请稍后重试')
    } finally {
      setProcessing(false)
    }
  }

  const resetForm = () => {
    setAmount('')
    setWithdrawMethod('bank')
    setBankName('')
    setBankAccount('')
    setAccountName('')
    setAlipayAccount('')
    setWechatAccount('')
  }

  const calculateFee = (amount: string) => {
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) return 0
    return num * 0.01 // 1% 手续费
  }

  const calculateActual = (amount: string) => {
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) return 0
    return num - calculateFee(amount)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 导航栏 */}
      <Navbar user={user} onLogout={handleLogout} />

      <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* 返回按钮行 */}
        <div className="mb-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="gap-2 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回</span>
          </Button>
        </div>

        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">我的提现</h1>
            <p className="text-gray-600 mt-2">申请提现和查看提现记录</p>
          </div>
          <Button onClick={() => setApplyDialog(true)}>
            申请提现
          </Button>
        </div>

        {/* 余额卡片 */}
        {user && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">账户余额</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {formatPrice(Number(user.balance))}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>提现手续费: 1%</p>
                  <p className="mt-1">最低提现金额: ¥1.00</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 提现记录 */}
        <Card>
          <CardHeader>
            <CardTitle>提现记录</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">加载中...</p>
              </div>
            ) : withdrawals.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">暂无提现记录</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        申请时间
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        提现金额
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        手续费
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        到账金额
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        提现方式
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        状态
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {withdrawals.map((withdrawal) => (
                      <tr key={withdrawal.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(withdrawal.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {formatPrice(withdrawal.amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatPrice(withdrawal.fee)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {formatPrice(withdrawal.actualAmount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {withdrawal.withdrawMethod === 'bank' && '银行转账'}
                          {withdrawal.withdrawMethod === 'alipay' && '支付宝'}
                          {withdrawal.withdrawMethod === 'wechat' && '微信'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_MAP[withdrawal.status]?.color}`}>
                            {STATUS_MAP[withdrawal.status]?.label}
                          </span>
                          {withdrawal.rejectReason && (
                            <p className="text-xs text-red-600 mt-1">
                              {withdrawal.rejectReason}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 申请提现对话框 */}
        <Dialog open={applyDialog} onOpenChange={setApplyDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>申请提现</DialogTitle>
              <DialogDescription>
                填写提现信息，提交后等待管理员审核
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* 提现金额 */}
              <div>
                <label className="block text-sm font-medium mb-2">提现金额</label>
                <Input
                  type="number"
                  step="0.01"
                  min="1"
                  max={user?.balance || 0}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="请输入提现金额"
                />
                {amount && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>手续费(1%): {formatPrice(calculateFee(amount))}</p>
                    <p className="text-green-600 font-medium">
                      实际到账: {formatPrice(calculateActual(amount))}
                    </p>
                  </div>
                )}
              </div>

              {/* 提现方式 */}
              <div>
                <label className="block text-sm font-medium mb-2">提现方式</label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="bank">银行转账</option>
                  <option value="alipay">支付宝</option>
                  <option value="wechat">微信</option>
                </select>
              </div>

              {/* 银行信息 */}
              {withdrawMethod === 'bank' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2">银行名称</label>
                    <Input
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="例如: 中国工商银行"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">银行账号</label>
                    <Input
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      placeholder="请输入银行卡号"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">账户名称</label>
                    <Input
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="请输入开户人姓名"
                    />
                  </div>
                </>
              )}

              {/* 支付宝 */}
              {withdrawMethod === 'alipay' && (
                <div>
                  <label className="block text-sm font-medium mb-2">支付宝账号</label>
                  <Input
                    value={alipayAccount}
                    onChange={(e) => setAlipayAccount(e.target.value)}
                    placeholder="请输入支付宝账号"
                  />
                </div>
              )}

              {/* 微信 */}
              {withdrawMethod === 'wechat' && (
                <div>
                  <label className="block text-sm font-medium mb-2">微信账号</label>
                  <Input
                    value={wechatAccount}
                    onChange={(e) => setWechatAccount(e.target.value)}
                    placeholder="请输入微信账号"
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setApplyDialog(false)
                  resetForm()
                }}
              >
                取消
              </Button>
              <Button onClick={handleApply} disabled={processing}>
                {processing ? '提交中...' : '提交申请'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      </div>
    </div>
  )
}
