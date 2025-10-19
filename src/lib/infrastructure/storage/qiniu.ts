/**
 * 七牛云存储服务
 *
 * 功能：
 * - 生成上传token（服务端）
 * - 文件URL验证
 * - 支持图片和视频上传
 */

import * as qiniu from 'qiniu'

/**
 * 七牛云配置
 */
const QINIU_CONFIG = {
  accessKey: process.env.QINIU_ACCESS_KEY || '',
  secretKey: process.env.QINIU_SECRET_KEY || '',
  bucket: process.env.QINIU_BUCKET || '',
  // ✅ 保持原始协议（测试域名只支持HTTP，正式CDN域名支持HTTPS）
  domain: process.env.QINIU_DOMAIN || '',
  zone: process.env.QINIU_ZONE || 'Zone_z2', // 华南
}

/**
 * 根据存储区域获取上传域名
 *
 * @param zone 存储区域代码
 * @returns 上传域名
 */
function getUploadDomain(zone: string): string {
  const uploadDomains: Record<string, string> = {
    'Zone_z0': 'https://upload.qiniup.com',      // 华东
    'Zone_z1': 'https://upload-z1.qiniup.com',   // 华北
    'Zone_z2': 'https://upload-z2.qiniup.com',   // 华南
    'Zone_na0': 'https://upload-na0.qiniup.com', // 北美
    'Zone_as0': 'https://upload-as0.qiniup.com', // 东南亚（新加坡）
  }

  return uploadDomains[zone] || 'https://upload.qiniup.com'
}

// 验证配置
function validateQiniuConfig() {
  if (!QINIU_CONFIG.accessKey || !QINIU_CONFIG.secretKey) {
    throw new Error('七牛云密钥未配置，请设置 QINIU_ACCESS_KEY 和 QINIU_SECRET_KEY')
  }
  if (!QINIU_CONFIG.bucket) {
    throw new Error('七牛云空间未配置，请设置 QINIU_BUCKET')
  }
  if (!QINIU_CONFIG.domain) {
    throw new Error('七牛云域名未配置，请设置 QINIU_DOMAIN')
  }
}

/**
 * 生成上传凭证（Token）
 *
 * @param options 上传选项
 * @returns 上传token
 */
export function generateUploadToken(options?: {
  key?: string // 指定文件名（可选）
  maxFileSize?: number // 最大文件大小（字节，默认10MB）
  expires?: number // 过期时间（秒，默认1小时）
  fileType?: 'image' | 'video' // 文件类型限制
}): string {
  validateQiniuConfig()

  const mac = new qiniu.auth.digest.Mac(
    QINIU_CONFIG.accessKey,
    QINIU_CONFIG.secretKey
  )

  const putPolicy = new qiniu.rs.PutPolicy({
    scope: options?.key
      ? `${QINIU_CONFIG.bucket}:${options.key}` // 覆盖上传
      : QINIU_CONFIG.bucket, // 普通上传
    expires: options?.expires || 3600, // 默认1小时
    fsizeLimit: options?.maxFileSize || 10 * 1024 * 1024, // 默认10MB
  })

  // 根据文件类型添加 MIME 类型限制
  if (options?.fileType === 'image') {
    putPolicy.mimeLimit = 'image/jpeg;image/png;image/webp;image/gif'
  } else if (options?.fileType === 'video') {
    putPolicy.mimeLimit = 'video/mp4;video/quicktime;video/mpeg'
  }

  return putPolicy.uploadToken(mac)
}

/**
 * 生成唯一文件名
 * 格式: transfer-proofs/{year}/{month}/{timestamp}-{random}.{ext}
 *
 * @param originalFilename 原始文件名
 * @returns 生成的文件名
 */
export function generateUniqueFilename(originalFilename: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 8)

  // 提取扩展名
  const ext = originalFilename.split('.').pop()?.toLowerCase() || 'jpg'

  return `transfer-proofs/${year}/${month}/${timestamp}-${random}.${ext}`
}

/**
 * 验证文件是否来自七牛云域名
 *
 * @param url 文件URL
 * @returns 是否有效
 */
export function isQiniuUrl(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const domain = QINIU_CONFIG.domain.replace(/^https?:\/\//, '')
    return urlObj.host === domain
  } catch {
    return false
  }
}

/**
 * 构建完整的七牛云URL
 *
 * @param key 文件key
 * @returns 完整URL
 */
export function buildQiniuUrl(key: string): string {
  const domain = QINIU_CONFIG.domain.replace(/\/$/, '')
  return `${domain}/${key}`
}

/**
 * 上传配置接口（返回给前端）
 */
export interface UploadConfig {
  token: string // 上传token
  key: string // 文件名
  domain: string // CDN域名（文件访问域名）
  uploadDomain: string // 上传域名（根据Zone自动选择）
}

/**
 * 获取上传配置
 * 用于API端点返回给前端
 *
 * @param originalFilename 原始文件名
 * @param fileType 文件类型
 * @returns 上传配置
 */
export function getUploadConfig(
  originalFilename: string,
  fileType: 'image' | 'video' = 'image'
): UploadConfig {
  const key = generateUniqueFilename(originalFilename)
  const token = generateUploadToken({
    key,
    maxFileSize: fileType === 'image' ? 10 * 1024 * 1024 : 100 * 1024 * 1024, // 图片10MB，视频100MB
    expires: 3600, // 1小时
    fileType,
  })

  return {
    token,
    key,
    domain: QINIU_CONFIG.domain,
    uploadDomain: getUploadDomain(QINIU_CONFIG.zone),
  }
}

/**
 * 文件类型验证
 */
export const ALLOWED_FILE_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/quicktime', 'video/mpeg'],
}

/**
 * 文件大小限制（字节）
 */
export const FILE_SIZE_LIMITS = {
  image: 10 * 1024 * 1024, // 10MB
  video: 100 * 1024 * 1024, // 100MB
}
