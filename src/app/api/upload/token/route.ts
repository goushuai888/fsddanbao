/**
 * 获取上传Token API
 *
 * POST /api/upload/token
 *
 * 用途：生成七牛云上传凭证
 * 认证：需要登录
 * 限流：30次/分钟
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/lib/infrastructure/auth/jwt'
import { apiLimiter, checkRateLimit } from '@/lib/infrastructure/security/ratelimit'
import { getUploadConfig } from '@/lib/infrastructure/storage/qiniu'
import { ApiResponse } from '@/types'

/**
 * 请求体接口
 */
interface UploadTokenRequest {
  filename: string // 原始文件名
  fileType?: 'image' | 'video' // 文件类型（默认image）
}

/**
 * 响应体接口
 */
interface UploadTokenResponse {
  token: string // 七牛云上传token
  key: string // 文件存储key
  domain: string // CDN域名（文件访问域名）
  uploadDomain: string // 上传域名（根据Zone自动选择）
  uploadUrl: string // 完整文件访问URL
}

/**
 * POST - 获取上传Token
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 认证检查
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '未授权'
      }, { status: 401 })
    }

    const payload = verifyToken(token)
    if (!payload) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '无效的token'
      }, { status: 401 })
    }

    // 2. 限流检查
    const rateLimitResult = await checkRateLimit(
      apiLimiter,
      payload.userId
    )
    if (!rateLimitResult.success) {
      return rateLimitResult.response
    }

    // 3. 解析请求体
    const body: UploadTokenRequest = await request.json()

    // 4. 验证请求参数
    if (!body.filename) {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '文件名不能为空'
      }, { status: 400 })
    }

    const fileType = body.fileType || 'image'
    if (fileType !== 'image' && fileType !== 'video') {
      return NextResponse.json<ApiResponse>({
        success: false,
        error: '文件类型只能是 image 或 video'
      }, { status: 400 })
    }

    // 5. 生成上传配置
    try {
      const config = getUploadConfig(body.filename, fileType)

      // ✅ 调试日志：检查配置是否正确
      console.log('📤 上传配置:', {
        domain: config.domain,
        uploadDomain: config.uploadDomain,
        key: config.key,
      })

      const response: UploadTokenResponse = {
        token: config.token,
        key: config.key,
        domain: config.domain,
        uploadDomain: config.uploadDomain,
        uploadUrl: `${config.domain}/${config.key}`
      }

      return NextResponse.json<ApiResponse<UploadTokenResponse>>({
        success: true,
        data: response,
        message: '获取上传凭证成功'
      })

    } catch (error) {
      console.error('生成上传凭证失败:', error)

      // 检查是否是配置错误
      if (error instanceof Error && error.message.includes('未配置')) {
        return NextResponse.json<ApiResponse>({
          success: false,
          error: '七牛云存储未配置，请联系管理员'
        }, { status: 500 })
      }

      throw error
    }

  } catch (error) {
    console.error('获取上传token错误:', error)
    return NextResponse.json<ApiResponse>({
      success: false,
      error: '服务器错误'
    }, { status: 500 })
  }
}
