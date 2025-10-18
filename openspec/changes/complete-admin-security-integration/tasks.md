# 任务清单 - 完成管理后台安全集成

## 阶段1: 用户管理页面安全加固（P0）

### 用户列表页面 (`users/page.tsx`)
- [ ] 1.1 添加安全工具导入（sanitizeText, handleApiError, toast）
- [ ] 1.2 使用useCallback包装fetchUsers函数
- [ ] 1.3 添加AbortController到useEffect
- [ ] 1.4 替换alert为toast.error/toast.success
- [ ] 1.5 添加handleApiError错误处理（401/403/500）
- [ ] 1.6 XSS防护：清理user.name, user.email, user.phone
- [ ] 1.7 修复ESLint警告（exhaustive-deps）
- [ ] 1.8 测试：网络错误、401错误、XSS注入

### 用户详情/编辑页面 (`users/[id]/page.tsx`)
- [ ] 1.9 添加安全工具导入（含UserUpdateSchema）
- [ ] 1.10 使用useCallback包装fetchUserDetail函数
- [ ] 1.11 添加AbortController到useEffect
- [ ] 1.12 替换alert为toast通知
- [ ] 1.13 添加handleApiError错误处理
- [ ] 1.14 XSS防护：清理所有用户输入字段
- [ ] 1.15 添加Zod验证（UserUpdateSchema.safeParse）
- [ ] 1.16 竞态保护：操作按钮添加disabled={actionLoading}
- [ ] 1.17 无障碍性：表单label + aria-describedby
- [ ] 1.18 字符计数显示（name≤50, phone格式）
- [ ] 1.19 修复ESLint警告
- [ ] 1.20 测试：表单验证、并发操作、XSS防护

## 阶段2: 财务审核页面安全加固（P0）

### 提现审核页面 (`withdrawals/page.tsx`)
- [ ] 2.1 添加安全工具导入（含WithdrawalActionSchema）
- [ ] 2.2 使用useCallback包装fetchWithdrawals函数
- [ ] 2.3 添加AbortController到useEffect
- [ ] 2.4 替换alert为toast通知
- [ ] 2.5 添加handleApiError错误处理
- [ ] 2.6 XSS防护：清理user.name, user.email, bankAccount等
- [ ] 2.7 添加Zod验证（WithdrawalActionSchema.safeParse）
- [ ] 2.8 竞态保护：审核按钮添加disabled={actionLoading}
- [ ] 2.9 无障碍性：对话框role="dialog" + aria-modal="true"
- [ ] 2.10 对话框支持Esc关闭
- [ ] 2.11 字符计数显示（reviewNote≤500, rejectReason≤200）
- [ ] 2.12 修复ESLint警告
- [ ] 2.13 测试：审核流程、输入验证、并发保护

## 阶段3: 其他管理页面安全加固（P1）

### 订单管理页面 (`orders/page.tsx`)
- [ ] 3.1 添加安全工具导入
- [ ] 3.2 使用useCallback包装fetchOrders函数
- [ ] 3.3 添加AbortController到useEffect
- [ ] 3.4 替换alert为toast通知
- [ ] 3.5 添加handleApiError错误处理
- [ ] 3.6 XSS防护：清理orderNo, vehicleBrand, vehicleModel, seller.name, buyer.name
- [ ] 3.7 修复ESLint警告（exhaustive-deps, unused vars）
- [ ] 3.8 测试：筛选功能、错误处理

### 支付记录页面 (`payments/page.tsx`)
- [ ] 3.9 添加安全工具导入
- [ ] 3.10 使用useCallback包装fetchPayments函数
- [ ] 3.11 添加AbortController到useEffect
- [ ] 3.12 替换alert为toast通知
- [ ] 3.13 添加handleApiError错误处理
- [ ] 3.14 XSS防护：清理user.name, orderNo
- [ ] 3.15 修复ESLint警告
- [ ] 3.16 测试：列表展示、错误处理

### 收益统计页面 (`revenue/page.tsx`)
- [ ] 3.17 添加安全工具导入
- [ ] 3.18 使用useCallback包装fetchStats函数
- [ ] 3.19 添加AbortController到useEffect
- [ ] 3.20 替换alert为toast通知（如有）
- [ ] 3.21 添加handleApiError错误处理
- [ ] 3.22 修复ESLint警告
- [ ] 3.23 测试：日期筛选、数据展示

## 阶段4: 代码质量验证

- [ ] 4.1 运行 `pnpm lint` 检查所有页面
- [ ] 4.2 修复所有Error级别的ESLint问题
- [ ] 4.3 运行 `pnpm build` 确保TypeScript编译通过
- [ ] 4.4 代码审查：检查是否遵循安全模式

## 阶段5: 功能测试

### XSS防护测试
- [ ] 5.1 用户列表：输入`<script>alert('XSS')</script>`到name字段
- [ ] 5.2 用户编辑：输入`<img src=x onerror=alert('XSS')>`到各字段
- [ ] 5.3 提现审核：输入`<a href="javascript:alert('XSS')">链接</a>`到备注
- [ ] 5.4 确认所有输入被正确清理（显示为纯文本）

### 错误处理测试
- [ ] 5.5 模拟401错误：清除token访问管理页面
- [ ] 5.6 模拟403错误：使用非管理员账号
- [ ] 5.7 模拟网络错误：断网操作
- [ ] 5.8 确认Toast通知正确显示，401自动跳转登录页

### 竞态条件测试
- [ ] 5.9 快速双击用户编辑的保存按钮
- [ ] 5.10 快速双击提现审核的批准按钮
- [ ] 5.11 确认只发送一次请求，按钮变灰

### 内存泄漏测试
- [ ] 5.12 快速切换筛选条件（用户列表、订单列表）
- [ ] 5.13 数据加载中快速离开页面
- [ ] 5.14 确认无控制台AbortError警告

## 阶段6: 文档更新

- [ ] 6.1 更新CLAUDE.md - 记录完成的安全集成
- [ ] 6.2 更新已知问题列表（移除"管理员页面安全"项）
- [ ] 6.3 添加安全模式使用指南（供未来新页面参考）

## 任务统计

- **总任务数**: 66个
- **阶段1（用户管理）**: 20个任务
- **阶段2（提现审核）**: 13个任务
- **阶段3（其他页面）**: 17个任务
- **阶段4（代码质量）**: 4个任务
- **阶段5（功能测试）**: 10个任务
- **阶段6（文档更新）**: 3个任务

## 并行化机会

以下任务可以并行执行：
- 阶段1和阶段2可以并行（不同页面）
- 阶段3的3个页面可以并行
- 阶段5的测试可以部分并行（不同页面）

## 关键里程碑

- [ ] M1: 用户管理页面完成（任务1.1-1.20）
- [ ] M2: 提现审核页面完成（任务2.1-2.13）
- [ ] M3: 所有页面完成（任务3.1-3.23）
- [ ] M4: 代码质量验证通过（任务4.1-4.4）
- [ ] M5: 功能测试通过（任务5.1-5.14）
- [ ] M6: 文档更新完成（任务6.1-6.3）
