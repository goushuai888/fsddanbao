# 实施任务清单

## 阶段1: 基础设施搭建

### 1.1 安装依赖
- [ ] 安装 `isomorphic-dompurify` (XSS防护)
- [ ] 安装 `sonner` (Toast通知, 已安装需确认)
- [ ] 安装 `zod` (表单验证, 已安装需确认)
- [ ] 更新 package.json

### 1.2 创建工具函数
- [ ] 创建 `src/lib/sanitize.ts` - XSS清理工具
  - `sanitizeText()` - 清理纯文本
  - `sanitizeHtml()` - 清理HTML (保留安全标签)
  - `sanitizeObject()` - 递归清理对象
- [ ] 创建 `src/lib/error-handler.ts` - 统一错误处理
  - `handleApiError()` - API错误处理
  - `getErrorMessage()` - 提取错误消息
- [ ] 测试工具函数

### 1.3 创建共享组件
- [ ] 创建 `src/components/ErrorBoundary.tsx` - 错误边界组件
- [ ] 创建 `src/components/AdminAuthGuard.tsx` - 客户端认证守卫
- [ ] 测试组件渲染

## 阶段2: 服务端认证加固

### 2.1 Middleware认证
- [ ] 更新 `src/middleware.ts` 添加 `/admin/*` 路径保护
  - 验证JWT token
  - 验证管理员角色
  - 重定向未授权请求

### 2.2 Layout认证改进
- [ ] 修改 `src/app/admin/layout.tsx`
  - 移除客户端 localStorage 认证逻辑
  - 使用 Server Component 获取认证状态
  - 保留客户端用户信息显示

### 2.3 测试认证流程
- [ ] 测试未登录用户访问 /admin
- [ ] 测试非管理员用户访问 /admin
- [ ] 测试token过期场景

## 阶段3: XSS防护集成

### 3.1 关键页面XSS防护
- [ ] `src/app/admin/refunds/page.tsx`
  - 清理: refund.seller.name, refund.seller.email
  - 清理: refund.buyer.name, refund.buyer.email
  - 清理: refund.refundReason
  - 清理: note输入字段

- [ ] `src/app/admin/disputes/page.tsx`
  - 清理: dispute.initiator.name, dispute.initiator.email
  - 清理: dispute.reason, dispute.description
  - 清理: dispute.resolution
  - 清理: resolution输入字段

- [ ] `src/app/admin/users/page.tsx`
  - 清理: user.name, user.email, user.phone
  - 清理: 所有用户输入字段

- [ ] `src/app/admin/users/[id]/page.tsx`
  - 清理: 用户详情所有字段

- [ ] `src/app/admin/withdrawals/page.tsx`
  - 清理: 提现申请相关用户数据

- [ ] `src/app/admin/orders/page.tsx`
  - 清理: 订单相关用户数据

- [ ] `src/app/admin/page.tsx`
  - 清理: user.name, user.email

### 3.2 其他页面
- [ ] `src/app/admin/payments/page.tsx` - 清理支付相关数据
- [ ] `src/app/admin/revenue/page.tsx` - 清理收入统计数据

## 阶段4: 错误处理增强

### 4.1 替换alert为toast
- [ ] `src/app/admin/refunds/page.tsx`
  - fetchRefunds错误处理 (lines 75, 79)
  - handleAction错误处理 (lines 113, 117)
  - 添加成功提示toast

- [ ] `src/app/admin/disputes/page.tsx`
  - fetchDisputes错误处理 (lines 79, 83)
  - handleAction错误处理 (lines 116, 122, 126)
  - 添加成功提示toast

- [ ] `src/app/admin/page.tsx`
  - fetchStats错误处理 (line 48)
  - 添加错误toast

- [ ] 其他6个管理员页面
  - 统一使用 handleApiError()
  - 替换所有 alert()

### 4.2 添加HTTP状态码处理
- [ ] 处理401 Unauthorized - 跳转登录
- [ ] 处理403 Forbidden - 显示无权限提示
- [ ] 处理500 Internal Server Error - 显示友好错误
- [ ] 处理网络超时

### 4.3 错误边界集成
- [ ] 在 `src/app/admin/layout.tsx` 包裹 ErrorBoundary
- [ ] 测试错误捕获

## 阶段5: 竞态条件保护

### 5.1 按钮加载状态
- [ ] `src/app/admin/refunds/page.tsx`
  - "同意退款" 按钮添加 disabled={actionLoading} (line 245)
  - "拒绝退款" 按钮添加 disabled={actionLoading} (line 252)
  - Dialog内确认按钮已有loading状态 ✓

- [ ] `src/app/admin/disputes/page.tsx`
  - "同意申诉" 按钮添加 disabled={actionLoading} (line 247)
  - "拒绝申诉" 按钮添加 disabled={actionLoading} (line 254)
  - Dialog内确认按钮已有loading状态 ✓

- [ ] 其他页面的操作按钮
  - 添加 disabled={loading} 属性
  - 添加加载状态指示器

### 5.2 防止重复请求
- [ ] fetchRefunds添加防重复逻辑
- [ ] fetchDisputes添加防重复逻辑
- [ ] 考虑使用 AbortController

## 阶段6: 输入验证

### 6.1 创建Zod Schemas
- [ ] `src/lib/validations/admin.ts`
  - RefundActionSchema (action, note)
  - DisputeActionSchema (action, resolution)
  - UserUpdateSchema
  - WithdrawalActionSchema

### 6.2 集成表单验证
- [ ] `src/app/admin/refunds/page.tsx`
  - 验证note长度 (最大500字符)
  - 提交前Zod验证

- [ ] `src/app/admin/disputes/page.tsx`
  - 验证resolution长度 (最大1000字符)
  - 提交前Zod验证

- [ ] 其他表单页面
  - 添加Zod验证

## 阶段7: 其他改进

### 7.1 内存泄漏修复
- [ ] `src/app/admin/refunds/page.tsx`
  - useEffect添加清理函数 (line 50-52)

- [ ] `src/app/admin/disputes/page.tsx`
  - useEffect添加清理函数 (line 54-56)

- [ ] 其他页面
  - 检查并添加清理函数

### 7.2 无障碍性改进
- [ ] 所有表单添加适当的 label
- [ ] 操作按钮添加 aria-label
- [ ] 对话框添加 role="dialog"
- [ ] 添加键盘导航支持

## 阶段8: 测试验证

### 8.1 功能测试
- [ ] 测试管理员登录流程
- [ ] 测试未授权访问拦截
- [ ] 测试XSS注入防护 (各种payload)
- [ ] 测试错误处理 (401, 403, 500, 网络错误)
- [ ] 测试竞态条件保护 (快速双击)

### 8.2 回归测试
- [ ] 退款审批功能正常
- [ ] 申诉处理功能正常
- [ ] 用户管理功能正常
- [ ] 提现审核功能正常

### 8.3 安全测试
- [ ] 尝试修改localStorage绕过认证 (应失败)
- [ ] 尝试XSS注入攻击 (应被清理)
- [ ] 尝试CSRF攻击 (API层已有保护)

## 阶段9: 文档更新

### 9.1 更新CLAUDE.md
- [ ] 移除"管理员页面安全"从待实现功能
- [ ] 更新"安全措施"章节
- [ ] 添加"管理员页面安全加固完成"到最近更新

### 9.2 代码注释
- [ ] 在sanitize.ts添加使用示例
- [ ] 在error-handler.ts添加使用说明
- [ ] 更新相关组件注释

## 总结

- **总任务数**: 80+
- **预估时间**: 7-11小时
- **优先级分布**:
  - P0 (严重): 认证加固, XSS防护
  - P1 (高): 错误处理, 竞态保护
  - P2 (中): 输入验证, 内存泄漏
  - P3 (低): 无障碍性, 文档更新
