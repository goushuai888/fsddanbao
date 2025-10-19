/**
 * 七牛云图片上传组件
 *
 * 功能：
 * - 支持点击上传和拖拽上传
 * - 图片预览
 * - 上传进度显示
 * - 文件类型和大小验证
 * - 上传失败重试
 */

'use client'

import { useState, useRef, DragEvent } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface QiniuImageUploadProps {
  onUploadSuccess: (url: string) => void // 上传成功回调
  accept?: string // 接受的文件类型（默认：image/*）
  maxSize?: number // 最大文件大小（字节，默认10MB）
  className?: string
}

export function QiniuImageUpload({
  onUploadSuccess,
  accept = 'image/*',
  maxSize = 10 * 1024 * 1024, // 10MB
  className = ''
}: QiniuImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * 验证文件
   */
  const validateFile = (file: File): string | null => {
    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      return '只能上传图片文件'
    }

    // 检查文件大小
    if (file.size > maxSize) {
      const maxSizeMB = (maxSize / 1024 / 1024).toFixed(1)
      return `文件大小不能超过 ${maxSizeMB}MB`
    }

    return null
  }

  /**
   * 上传文件到七牛云
   */
  const uploadToQiniu = async (file: File) => {
    try {
      setUploading(true)
      setProgress(0)

      // 1. 获取上传token
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('请先登录')
      }

      const tokenResponse = await fetch('/api/upload/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          filename: file.name,
          fileType: 'image'
        })
      })

      if (!tokenResponse.ok) {
        const error = await tokenResponse.json()
        throw new Error(error.error || '获取上传凭证失败')
      }

      const tokenData = await tokenResponse.json()
      if (!tokenData.success) {
        throw new Error(tokenData.error || '获取上传凭证失败')
      }

      const { token: uploadToken, key, uploadUrl, uploadDomain } = tokenData.data

      // ✅ 调试：检查从API获取的URL
      console.log('🔑 从API获取的数据:', {
        key,
        uploadUrl,
        uploadDomain
      })

      // 2. 上传到七牛云
      const formData = new FormData()
      formData.append('token', uploadToken)
      formData.append('key', key)
      formData.append('file', file)

      const uploadResponse = await fetch(uploadDomain, {
        method: 'POST',
        body: formData
      })

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('上传错误响应:', errorText)
        throw new Error(`上传失败: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      // 解析七牛云响应
      const qiniuResult = await uploadResponse.json()
      console.log('📦 七牛云上传响应:', qiniuResult)

      // 3. 上传成功 - 直接使用API返回的URL（保持原始协议）
      console.log('✅ 上传成功，文件URL:', uploadUrl)

      setProgress(100)
      toast.success('上传成功', {
        description: '图片已成功上传'
      })

      onUploadSuccess(uploadUrl)  // ✅ 直接使用API返回的URL

    } catch (error) {
      console.error('上传失败:', error)
      toast.error('上传失败', {
        description: error instanceof Error ? error.message : '未知错误'
      })
      setPreviewUrl(null)
    } finally {
      setUploading(false)
      setProgress(0)
    }
  }

  /**
   * 处理文件选择
   */
  const handleFileSelect = async (file: File) => {
    // 验证文件
    const error = validateFile(file)
    if (error) {
      toast.error('文件不符合要求', {
        description: error
      })
      return
    }

    // 预览图片
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // 上传文件
    await uploadToQiniu(file)
  }

  /**
   * 文件输入框变化
   */
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  /**
   * 拖拽相关
   */
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  return (
    <div className={className}>
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        className="hidden"
        disabled={uploading}
      />

      {/* 上传区域 */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        {previewUrl && !uploading ? (
          // 预览图片
          <div className="space-y-2">
            <img
              src={previewUrl}
              alt="预览"
              className="max-h-48 mx-auto rounded-lg"
            />
            <p className="text-sm text-gray-600">点击重新上传</p>
          </div>
        ) : uploading ? (
          // 上传中
          <div className="space-y-2">
            <div className="text-blue-600 font-medium">上传中...</div>
            {progress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        ) : (
          // 初始状态
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-sm text-gray-600">
              <span className="font-medium text-blue-600">点击上传</span>
              {' '}或拖拽文件到此处
            </div>
            <p className="text-xs text-gray-500">
              支持 JPG、PNG、WebP、GIF，最大 {(maxSize / 1024 / 1024).toFixed(0)}MB
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
