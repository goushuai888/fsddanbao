## ADDED Requirements

### Requirement: 管理员操作审计

系统 SHALL 对所有管理员的敏感操作记录审计日志，包括操作人、操作时间、操作目标、操作前后的值、IP地址和User-Agent。

#### Scenario: 用户信息更新审计

- **WHEN** 管理员通过 `PATCH /api/admin/users/[id]` 更新用户信息（余额、角色、认证状态等）
- **THEN** 系统应创建审计日志记录，包含：
  - userId: 管理员ID
  - action: `UPDATE_USER_BALANCE` 或 `UPDATE_USER_ROLE` 或其他相关 action
  - target: 被修改的用户ID
  - targetType: "User"
  - oldValue: 修改前的值（JSON格式）
  - newValue: 修改后的值（JSON格式）
  - ip: 管理员的IP地址
  - userAgent: 管理员的浏览器信息

#### Scenario: 用户删除审计

- **WHEN** 管理员通过 `DELETE /api/admin/users/[id]` 删除用户
- **THEN** 系统应创建审计日志记录，包含：
  - userId: 管理员ID
  - action: `DELETE_USER`
  - target: 被删除的用户ID
  - targetType: "User"
  - oldValue: 被删除用户的完整信息（JSON格式）
  - description: "删除用户"

#### Scenario: 提现批准审计

- **WHEN** 管理员批准提现申请（action=approve）
- **THEN** 系统应创建审计日志记录，包含：
  - userId: 管理员ID
  - action: `APPROVE_WITHDRAWAL`
  - target: 提现申请ID
  - targetType: "Withdrawal"
  - newValue: {status: "APPROVED", amount: 提现金额, reviewNote: 审核备注}

#### Scenario: 提现拒绝审计

- **WHEN** 管理员拒绝提现申请（action=reject）
- **THEN** 系统应创建审计日志记录，包含：
  - userId: 管理员ID
  - action: `REJECT_WITHDRAWAL`
  - target: 提现申请ID
  - targetType: "Withdrawal"
  - newValue: {status: "REJECTED", rejectReason: 拒绝理由}

#### Scenario: 提现完成审计

- **WHEN** 管理员标记提现为完成（action=complete）
- **THEN** 系统应创建审计日志记录，包含：
  - userId: 管理员ID
  - action: `COMPLETE_WITHDRAWAL`
  - target: 提现申请ID
  - targetType: "Withdrawal"
  - newValue: {status: "COMPLETED", transactionId: 交易ID}

#### Scenario: 申诉处理审计

- **WHEN** 管理员处理申诉（同意或拒绝）
- **THEN** 系统应创建审计日志记录，包含：
  - userId: 管理员ID
  - action: `RESOLVE_DISPUTE` 或 `CLOSE_DISPUTE`
  - target: 申诉ID
  - targetType: "Dispute"
  - oldValue: {disputeStatus: "PENDING"}
  - newValue: {disputeStatus: "RESOLVED"/"CLOSED", resolution: 处理结果, orderStatus: 订单最终状态}

#### Scenario: 退款处理审计

- **WHEN** 管理员处理退款申请（批准或拒绝）
- **THEN** 系统应创建审计日志记录，包含：
  - userId: 管理员ID
  - action: `APPROVE_REFUND` 或 `REJECT_REFUND`
  - target: 订单ID
  - targetType: "Order"
  - oldValue: {refundStatus: "PENDING", orderStatus: 当前状态}
  - newValue: {refundStatus: "APPROVED"/"REJECTED", orderStatus: 新状态}

### Requirement: 审计日志不影响主流程

系统 SHALL 确保审计日志记录失败不会导致主业务操作失败。

#### Scenario: 审计日志写入失败

- **WHEN** 审计日志写入数据库失败（如数据库连接断开）
- **THEN** 系统应：
  - 将错误记录到控制台（`console.error`）
  - 继续执行主业务逻辑
  - 返回业务操作成功响应

### Requirement: 开发环境审计日志可见

系统 SHALL 在开发环境（NODE_ENV=development）下，将审计日志打印到控制台，便于开发调试。

#### Scenario: 开发环境审计日志输出

- **WHEN** 在开发环境下执行管理员操作
- **THEN** 系统应在控制台输出审计日志摘要，包含：
  - 标识前缀 `[AUDIT]`
  - userId
  - action
  - target
  - timestamp（ISO格式）
