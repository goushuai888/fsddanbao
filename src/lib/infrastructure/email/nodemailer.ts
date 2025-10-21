/**
 * Nodemailer 邮件服务
 *
 * 支持SMTP邮件发送（QQ邮箱、163邮箱等）
 */

import nodemailer from 'nodemailer'

// 邮件配置接口
export interface EmailConfig {
  host: string
  port: number
  secure: boolean
  auth: {
    user: string
    pass: string
  }
}

// 发送邮件选项
export interface SendMailOptions {
  to: string
  subject: string
  text?: string
  html?: string
}

/**
 * 创建邮件传输器
 */
function createTransporter() {
  const config: EmailConfig = {
    host: process.env.SMTP_HOST || 'smtp.qq.com',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || true,
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || ''
    }
  }

  // 验证配置
  if (!config.auth.user || !config.auth.pass) {
    throw new Error('SMTP配置不完整，请检查环境变量 SMTP_USER 和 SMTP_PASS')
  }

  return nodemailer.createTransport(config)
}

/**
 * 发送邮件
 */
export async function sendEmail(options: SendMailOptions): Promise<boolean> {
  try {
    const transporter = createTransporter()

    const mailOptions = {
      from: `"${process.env.SMTP_FROM_NAME || 'FSD担保交易平台'}" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html
    }

    const info = await transporter.sendMail(mailOptions)
    console.log('邮件发送成功:', info.messageId)
    return true
  } catch (error) {
    console.error('邮件发送失败:', error)
    return false
  }
}

/**
 * 发送验证码邮件
 */
export async function sendVerificationCode(
  email: string,
  code: string,
  type: string
): Promise<boolean> {
  // 根据类型生成不同的邮件内容
  const typeMap: Record<string, string> = {
    WITHDRAWAL: '提现验证',
    CHANGE_EMAIL: '修改邮箱验证',
    LARGE_PAYMENT: '大额支付验证',
    CHANGE_PASSWORD: '修改密码验证',
    REGISTER: '注册验证',
    LOGIN: '登录验证'
  }

  const subject = `【FSD担保交易】${typeMap[type] || '验证'}码`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .code-box {
          background: white;
          border: 2px dashed #667eea;
          border-radius: 8px;
          padding: 20px;
          text-align: center;
          margin: 20px 0;
        }
        .code {
          font-size: 32px;
          font-weight: bold;
          color: #667eea;
          letter-spacing: 8px;
          font-family: 'Courier New', monospace;
        }
        .footer {
          background: #f9fafb;
          padding: 20px;
          text-align: center;
          font-size: 12px;
          color: #6b7280;
          border: 1px solid #e5e7eb;
          border-top: none;
          border-radius: 0 0 10px 10px;
        }
        .warning {
          background: #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 12px;
          margin: 20px 0;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1 style="margin: 0;">FSD担保交易平台</h1>
        <p style="margin: 10px 0 0 0;">安全可靠的Tesla FSD转移服务</p>
      </div>

      <div class="content">
        <h2>您的验证码</h2>
        <p>您正在进行 <strong>${typeMap[type] || '验证'}</strong> 操作，请使用以下验证码完成验证：</p>

        <div class="code-box">
          <div class="code">${code}</div>
        </div>

        <div class="warning">
          <strong>⚠️ 安全提示：</strong>
          <ul style="margin: 10px 0 0 0; padding-left: 20px;">
            <li>验证码有效期为 <strong>10分钟</strong></li>
            <li>请勿将验证码告诉他人</li>
            <li>如非本人操作，请忽略此邮件</li>
          </ul>
        </div>

        <p style="margin-top: 20px; color: #6b7280;">
          如果您没有进行此操作，可能是他人误输入了您的邮箱地址，请忽略此邮件。
        </p>
      </div>

      <div class="footer">
        <p>此邮件由系统自动发送，请勿回复</p>
        <p>© ${new Date().getFullYear()} FSD担保交易平台 - 让Tesla FSD转移更安全</p>
      </div>
    </body>
    </html>
  `

  const text = `
【FSD担保交易】${typeMap[type] || '验证'}码

您的验证码是：${code}

验证码有效期为10分钟，请勿告诉他人。
如非本人操作，请忽略此邮件。

此邮件由系统自动发送，请勿回复。
© ${new Date().getFullYear()} FSD担保交易平台
  `

  return sendEmail({
    to: email,
    subject,
    text,
    html
  })
}
