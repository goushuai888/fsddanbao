# 实施任务清单

## 1. 用户管理 API 审计集成
- [ ] 1.1 集成用户信息更新审计（PATCH /api/admin/users/[id]）
  - 记录修改前后的值（余额、角色、认证状态等）
  - 使用 `UPDATE_USER_BALANCE`, `UPDATE_USER_ROLE` 等 action
- [ ] 1.2 集成用户删除审计（DELETE /api/admin/users/[id]）
  - 记录被删除用户的完整信息
  - 使用 `DELETE_USER` action

## 2. 提现管理 API 审计集成
- [ ] 2.1 集成提现批准审计（action=approve）
  - 记录批准人、提现金额、审核备注
  - 使用 `APPROVE_WITHDRAWAL` action
- [ ] 2.2 集成提现拒绝审计（action=reject）
  - 记录拒绝理由
  - 使用 `REJECT_WITHDRAWAL` action
- [ ] 2.3 集成提现完成审计（action=complete）
  - 记录交易ID
  - 使用 `COMPLETE_WITHDRAWAL` action
- [ ] 2.4 集成提现失败审计（action=fail）
  - 记录失败原因
  - 使用 `FAIL_WITHDRAWAL` action（需在 AUDIT_ACTIONS 中新增）

## 3. 申诉处理 API 审计集成
- [ ] 3.1 集成申诉同意审计（action=approve）
  - 记录裁决结果、退款金额
  - 使用 `RESOLVE_DISPUTE` action
- [ ] 3.2 集成申诉拒绝审计（action=reject）
  - 记录裁决理由、释放金额
  - 使用 `CLOSE_DISPUTE` action

## 4. 退款管理 API 审计集成
- [ ] 4.1 集成退款批准审计（action=approve）
  - 记录批准原因、退款金额
  - 使用 `APPROVE_REFUND` action（需在 AUDIT_ACTIONS 中新增）
- [ ] 4.2 集成退款拒绝审计（action=reject）
  - 记录拒绝理由
  - 使用 `REJECT_REFUND` action（需在 AUDIT_ACTIONS 中新增）

## 5. 审计常量扩展
- [ ] 5.1 在 `src/lib/audit.ts` 中新增缺失的 action 常量
  - `DELETE_USER`
  - `FAIL_WITHDRAWAL`
  - `APPROVE_REFUND`
  - `REJECT_REFUND`

## 6. 测试验证
- [ ] 6.1 手动测试每个 API 端点
  - 验证审计日志正确记录到数据库
  - 验证 IP 地址和 User-Agent 正确提取
  - 验证 oldValue/newValue 正确记录
- [ ] 6.2 验证审计日志失败不影响主流程
  - 模拟数据库写入失败（断开 Prisma 连接）
  - 确认业务操作仍然成功
  - 确认错误被正确记录到控制台
- [ ] 6.3 使用 Prisma Studio 检查审计日志数据
  - 验证所有字段正确填充
  - 验证时间戳准确
  - 验证 JSON 序列化正确

## 7. 文档更新
- [ ] 7.1 更新 CLAUDE.md 标记任务为已完成
  - 将"审计日志集成"从高优先级移除
  - 添加到"最近更新"章节
- [ ] 7.2 更新 API.md 文档
  - 记录审计日志的触发时机
  - 记录可查询的审计日志字段
