import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface BaseDialogProps {
  isOpen: boolean
  onClose: () => void
  title: string
  description?: string
  placeholder: string
  submitText?: string
  cancelText?: string
  warningMessage?: string
  minLength?: number
  onSubmit: (value: string) => void | Promise<void>
  loading?: boolean
  variant?: 'default' | 'destructive'
}

export function FormDialog({
  isOpen,
  onClose,
  title,
  description,
  placeholder,
  submitText = '提交',
  cancelText = '取消',
  warningMessage,
  minLength = 5,
  onSubmit,
  loading = false,
  variant = 'default'
}: BaseDialogProps) {
  const [value, setValue] = useState('')

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!value.trim()) {
      alert('请填写必要信息')
      return
    }

    if (value.trim().length < minLength) {
      alert(`至少需要${minLength}个字符`)
      return
    }

    await onSubmit(value)
    setValue('')
  }

  const handleClose = () => {
    setValue('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg w-full max-w-md">
        <h3 className={`text-lg font-medium mb-4 ${variant === 'destructive' ? 'text-red-600' : ''}`}>
          {title}
        </h3>

        {description && (
          <p className="text-sm text-gray-600 mb-4">{description}</p>
        )}

        <div className="mb-4">
          <label className={`block text-sm font-medium mb-2 ${variant === 'destructive' ? 'text-red-600' : ''}`}>
            {title} <span className="text-red-500">*</span>
          </label>
          <textarea
            className="w-full border rounded-md p-2 min-h-[120px]"
            placeholder={placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        {warningMessage && (
          <div className="bg-yellow-50 p-3 rounded-md mb-4">
            <p className="text-sm text-yellow-800">
              ⚠️ {warningMessage}
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={handleSubmit}
            disabled={loading}
            variant={variant}
            className="flex-1"
          >
            {loading ? '处理中...' : submitText}
          </Button>
          <Button
            onClick={handleClose}
            variant="outline"
            className="flex-1"
            disabled={loading}
          >
            {cancelText}
          </Button>
        </div>
      </div>
    </div>
  )
}
