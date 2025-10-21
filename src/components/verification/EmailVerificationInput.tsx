'use client'

/**
 * 邮箱验证码输入组件
 *
 * 用于敏感操作的邮箱验证
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

export type VerificationType =
  | 'WITHDRAWAL'
  | 'CHANGE_EMAIL'
  | 'LARGE_PAYMENT'
  | 'CHANGE_PASSWORD'
  | 'REGISTER'
  | 'LOGIN'

interface EmailVerificationInputProps {
  type: VerificationType
  value: string
  onChange: (value: string) => void
  onVerified?: () => void
  disabled?: boolean
  className?: string
}

export function EmailVerificationInput({
  type,
  value,
  onChange,
  onVerified,
  disabled = false,
  className = ''
}: EmailVerificationInputProps) {
  const [sending, setSending] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [maskedEmail, setMaskedEmail] = useState('')

  // 倒计时效果
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [countdown])

  // 发送验证码
  const handleSendCode = async () => {
    try {
      setSending(true)

      const response = await fetch('/api/verification/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('验证码已发送', {
          description: `请查收邮箱 ${data.data.email}`
        })
        setMaskedEmail(data.data.email)
        setCountdown(60) // 60秒倒计时
      } else {
        toast.error('发送失败', {
          description: data.error || '请稍后重试'
        })
      }
    } catch (error) {
      console.error('发送验证码错误:', error)
      toast.error('网络错误', {
        description: '请检查网络连接后重试'
      })
    } finally {
      setSending(false)
    }
  }

  // 验证验证码
  const handleVerify = async () => {
    if (!value || value.length !== 6) {
      toast.error('请输入6位验证码')
      return
    }

    try {
      const response = await fetch('/api/verification/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          code: value,
          type
        })
      })

      const data = await response.json()

      if (data.success) {
        toast.success('验证成功')
        onVerified?.()
      } else {
        toast.error('验证失败', {
          description: data.error || '请重试'
        })
      }
    } catch (error) {
      console.error('验证验证码错误:', error)
      toast.error('网络错误', {
        description: '请检查网络连接后重试'
      })
    }
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        邮箱验证码 <span className="text-red-500">*</span>
      </label>

      <div className="flex gap-2">
        {/* 验证码输入框 */}
        <Input
          type="text"
          placeholder="请输入6位验证码"
          value={value}
          onChange={(e) => {
            // 只允许输入数字，最多6位
            const val = e.target.value.replace(/\D/g, '').slice(0, 6)
            onChange(val)
          }}
          disabled={disabled}
          maxLength={6}
          className="flex-1 font-mono text-lg tracking-widest"
          aria-label="验证码输入"
        />

        {/* 发送验证码按钮 */}
        <Button
          type="button"
          variant="outline"
          onClick={handleSendCode}
          disabled={countdown > 0 || sending || disabled}
          className="whitespace-nowrap"
          aria-label={countdown > 0 ? `${countdown}秒后重试` : '发送验证码'}
        >
          {countdown > 0 ? `${countdown}秒` : sending ? '发送中...' : '发送验证码'}
        </Button>
      </div>

      {/* 提示信息 */}
      {maskedEmail && (
        <p className="text-xs text-gray-500 mt-2">
          验证码已发送至 {maskedEmail}，有效期10分钟
        </p>
      )}

      {/* 使用说明 */}
      <div className="mt-2 text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded p-2">
        <p className="flex items-center gap-1">
          <span className="text-blue-600">ℹ️</span>
          <span>为保障账户安全，敏感操作需要邮箱验证</span>
        </p>
      </div>
    </div>
  )
}
