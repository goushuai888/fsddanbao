'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { ZodSchema } from 'zod'

/**
 * 表单字段类型定义
 */
export type FormFieldType = 'text' | 'textarea' | 'select' | 'number' | 'email'

export interface FormField {
  name: string
  label: string
  type: FormFieldType
  placeholder?: string
  required?: boolean
  maxLength?: number
  options?: Array<{ label: string; value: string }>
  rows?: number  // for textarea
  defaultValue?: string | number
  description?: string  // 字段说明
}

/**
 * 对话框按钮配置
 */
export interface DialogAction {
  label: string
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  onClick: (formData: Record<string, any>) => Promise<void> | void
  requireValidation?: boolean  // 是否需要验证表单
  disabled?: boolean
}

/**
 * 简化模式配置（用于订单操作的快捷对话框）
 */
export interface SimpleModeConfig {
  enabled: true
  placeholder: string
  minLength?: number
  submitText?: string
  cancelText?: string
  warningMessage?: string
  variant?: 'default' | 'destructive'
  onSubmit: (value: string) => Promise<void> | void
}

/**
 * FormDialog 组件属性
 */
export interface FormDialogProps {
  // 对话框状态
  open: boolean
  onOpenChange: (open: boolean) => void

  // 标题和描述
  title: string
  description?: string

  // 表单字段配置（完整模式）
  fields?: FormField[]

  // 表单验证 schema（可选）
  validationSchema?: ZodSchema

  // 自定义内容（在表单字段之前显示）
  customContent?: React.ReactNode

  // 按钮配置（完整模式）
  actions?: DialogAction[]

  // 表单初始值
  initialValues?: Record<string, any>

  // 加载状态
  loading?: boolean

  // 表单提交成功回调
  onSuccess?: () => void

  // 关闭对话框时的回调
  onClose?: () => void

  // 简化模式（用于订单操作：退款、拒绝、申诉等）
  simpleMode?: SimpleModeConfig
}

/**
 * FormDialog - 通用表单对话框组件
 *
 * 用于统一管理员操作对话框和订单操作对话框，支持：
 * - **完整模式**：配置化表单字段、Zod验证、自定义按钮（管理员使用）
 * - **简化模式**：单textarea、简单验证、固定按钮（订单操作使用）
 * - 自动加载状态
 * - 统一错误处理
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  fields,
  validationSchema,
  customContent,
  actions,
  initialValues = {},
  loading = false,
  onSuccess,
  onClose,
  simpleMode
}: FormDialogProps) {
  const [formData, setFormData] = useState<Record<string, any>>(initialValues)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [simpleValue, setSimpleValue] = useState('')

  // 判断是否为简化模式
  const isSimpleMode = simpleMode?.enabled === true

  // 重置表单
  const resetForm = () => {
    setFormData(initialValues)
    setErrors({})
    setSimpleValue('')
  }

  // 关闭对话框
  const handleClose = () => {
    if (!loading) {
      resetForm()
      onOpenChange(false)
      onClose?.()
    }
  }

  // 简化模式的提交处理
  const handleSimpleSubmit = async () => {
    if (!simpleMode) return

    const minLength = simpleMode.minLength || 5
    if (!simpleValue.trim()) {
      toast.error('输入验证失败', {
        description: '请填写必要信息'
      })
      return
    }

    if (simpleValue.trim().length < minLength) {
      toast.error('输入验证失败', {
        description: `至少需要${minLength}个字符`
      })
      return
    }

    try {
      await simpleMode.onSubmit(simpleValue)
      onSuccess?.()
      handleClose()
    } catch (error) {
      // 错误已在 onSubmit 中处理
      console.error('Simple submit error:', error)
    }
  }

  // 处理字段变化
  const handleFieldChange = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    // 清除该字段的错误
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // 验证表单
  const validateForm = (): boolean => {
    if (!validationSchema) return true

    const result = validationSchema.safeParse(formData)

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach(err => {
        const field = err.path[0] as string
        if (field) {
          fieldErrors[field] = err.message
        }
      })
      setErrors(fieldErrors)

      // 显示第一个错误
      const firstError = result.error.errors[0]
      toast.error('输入验证失败', {
        description: firstError?.message || '请检查表单输入'
      })

      return false
    }

    setErrors({})
    return true
  }

  // 处理按钮点击
  const handleAction = async (action: DialogAction) => {
    try {
      // 如果需要验证，先验证表单
      if (action.requireValidation !== false) {
        if (!validateForm()) {
          return
        }
      }

      // 执行操作
      await action.onClick(formData)

      // 成功后关闭对话框
      onSuccess?.()
      handleClose()
    } catch (error) {
      console.error('Dialog action error:', error)
      // 错误已在 onClick 中处理，这里不需要额外操作
    }
  }

  // 渲染表单字段
  const renderField = (field: FormField) => {
    const value = formData[field.name] ?? field.defaultValue ?? ''
    const error = errors[field.name]

    return (
      <div key={field.name} className="space-y-2">
        <label htmlFor={field.name} className="block text-sm font-medium">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>

        {field.description && (
          <p className="text-xs text-gray-500">{field.description}</p>
        )}

        {/* Text Input */}
        {field.type === 'text' && (
          <Input
            id={field.name}
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            disabled={loading}
            className={error ? 'border-red-500' : ''}
          />
        )}

        {/* Number Input */}
        {field.type === 'number' && (
          <Input
            id={field.name}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.name, Number(e.target.value))}
            placeholder={field.placeholder}
            disabled={loading}
            className={error ? 'border-red-500' : ''}
          />
        )}

        {/* Email Input */}
        {field.type === 'email' && (
          <Input
            id={field.name}
            type="email"
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            maxLength={field.maxLength}
            disabled={loading}
            className={error ? 'border-red-500' : ''}
          />
        )}

        {/* Textarea */}
        {field.type === 'textarea' && (
          <>
            <Textarea
              id={field.name}
              value={value}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              placeholder={field.placeholder}
              maxLength={field.maxLength}
              rows={field.rows || 3}
              disabled={loading}
              className={error ? 'border-red-500' : ''}
            />
            {field.maxLength && (
              <p className="text-xs text-gray-500 text-right">
                {(value as string).length}/{field.maxLength} 字符
              </p>
            )}
          </>
        )}

        {/* Select */}
        {field.type === 'select' && (
          <select
            id={field.name}
            value={value}
            onChange={(e) => handleFieldChange(field.name, e.target.value)}
            disabled={loading}
            className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${
              error ? 'border-red-500' : ''
            }`}
          >
            {field.placeholder && (
              <option value="">{field.placeholder}</option>
            )}
            {field.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}

        {/* Error Message */}
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className={isSimpleMode && simpleMode.variant === 'destructive' ? 'text-red-600' : ''}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 自定义内容 */}
          {customContent}

          {/* 简化模式：单个textarea */}
          {isSimpleMode && simpleMode && (
            <div className="space-y-2">
              <label
                htmlFor="simple-input"
                className={`block text-sm font-medium ${simpleMode.variant === 'destructive' ? 'text-red-600' : ''}`}
              >
                {title} <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="simple-input"
                value={simpleValue}
                onChange={(e) => setSimpleValue(e.target.value)}
                placeholder={simpleMode.placeholder}
                rows={5}
                disabled={loading}
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 text-right">
                {simpleValue.length}/1000 字符
              </p>

              {/* 警告消息 */}
              {simpleMode.warningMessage && (
                <div className="bg-yellow-50 p-3 rounded-md border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    ⚠️ {simpleMode.warningMessage}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 完整模式：多字段表单 */}
          {!isSimpleMode && fields && fields.map(renderField)}
        </div>

        <DialogFooter>
          {/* 简化模式按钮 */}
          {isSimpleMode && simpleMode && (
            <>
              <Button
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                {simpleMode.cancelText || '取消'}
              </Button>
              <Button
                variant={simpleMode.variant || 'default'}
                onClick={handleSimpleSubmit}
                disabled={loading}
              >
                {loading ? '处理中...' : (simpleMode.submitText || '提交')}
              </Button>
            </>
          )}

          {/* 完整模式按钮 */}
          {!isSimpleMode && actions && actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'default'}
              onClick={() => handleAction(action)}
              disabled={loading || action.disabled}
            >
              {loading ? '处理中...' : action.label}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
