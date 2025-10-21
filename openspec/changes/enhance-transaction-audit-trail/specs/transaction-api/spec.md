# Transaction API - 审计追踪规范

## ADDED Requirements

### Requirement: 操作人信息暴露

系统 SHALL 在账务记录 API 中暴露操作执行人的信息，特别是管理员执行的操作。

#### Scenario: 查询管理员执行的操作记录
- **WHEN** 数据库中有一条由管理员执行的Payment记录（performedBy字段不为空），用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - 响应包含 `performedByUser` 对象
  - `performedByUser.id` 等于 `performedBy` 的值
  - `performedByUser` 包含 `name`、`email`、`role` 字段
  - `performedByUser.role` 为 'ADMIN'

#### Scenario: 查询用户自己执行的操作记录
- **WHEN** 数据库中有一条由用户自己执行的Payment记录（performedBy字段为空），用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - 响应中 `performedBy` 字段为 null
  - 响应中 `performedByUser` 字段为 null

### Requirement: 提现记录关联

对于提现相关的Payment记录，系统 SHALL 包含完整的提现申请详情。

#### Scenario: 查询已完成的提现记录
- **WHEN** 数据库中有一条类型为WITHDRAW的Payment记录，且withdrawalId不为空，用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - 响应包含 `withdrawal` 对象
  - `withdrawal.id` 等于 `withdrawalId` 的值
  - `withdrawal` 包含 id、withdrawMethod、status、amount、actualAmount、createdAt、completedAt 字段

#### Scenario: 查询退款到提现账户的记录
- **WHEN** 数据库中有一条类型为REFUND的Payment记录，且关联了提现申请退款，用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - 如果 `withdrawalId` 不为空，响应应包含 `withdrawal` 对象
  - `withdrawal.status` 应为 'REJECTED' 或 'FAILED'（表示提现失败，款项退回）

#### Scenario: 查询非提现相关的记录
- **WHEN** 数据库中有一条类型为RELEASE或ESCROW的Payment记录，用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - `withdrawalId` 为 null
  - `withdrawal` 字段为 null

### Requirement: 元数据和备注暴露

系统 SHALL 暴露Payment记录的metadata和note字段，为用户提供操作上下文。

#### Scenario: 查询包含元数据的管理员调账记录
- **WHEN** 数据库中有一条ADMIN_ADJUSTMENT类型的Payment记录，metadata字段包含调账原因，用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - 响应包含 `metadata` 字段
  - `metadata` 是一个对象
  - `metadata` 可能包含 `reason`、`ticketId`、`adminUserId` 等字段
  - 响应包含 `note` 字段（如果数据库中有）

#### Scenario: 查询包含备注的退款记录
- **WHEN** 数据库中有一条REFUND类型的Payment记录，note字段记录了退款原因，用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - 响应包含 `note` 字段
  - `note` 内容为退款原因说明

#### Scenario: 查询没有元数据的普通记录
- **WHEN** 数据库中有一条RELEASE类型的Payment记录，metadata和note都为空，用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - `metadata` 字段为 null
  - `note` 字段为 null 或空字符串

### Requirement: API响应格式完整性

账务记录API SHALL 返回完整的审计信息，包括所有新增字段和关联对象。

#### Scenario: 完整的API响应结构验证
- **WHEN** 用户有多条不同类型的Payment记录，调用 `GET /api/user/transactions`
- **THEN** 响应应符合以下结构：
  - 包含原有字段：id、userId、orderId、amount、type、status、paymentMethod、transactionId、createdAt
  - 包含新增审计字段：performedBy、metadata、note、withdrawalId
  - 包含关联对象：order（原有）、withdrawal（新增）、performedByUser（新增）
  - 所有字段类型正确（string | null、object | null等）

### Requirement: 性能要求

API性能 SHALL NOT 因新增关联查询而显著下降。

#### Scenario: 响应时间性能基准
- **WHEN** 修改前API的平均响应时间为T0毫秒，实施新的关联查询后测试API响应时间
- **THEN** 系统应：
  - 新的平均响应时间T1满足：T1 <= T0 + 100ms
  - 99百分位响应时间增加不超过150ms

### Requirement: 向后兼容性

系统 SHALL 正确处理旧数据记录，不因缺少新字段而崩溃。

#### Scenario: 查询旧Payment记录（无审计字段）
- **WHEN** 数据库中有旧的Payment记录，performedBy和withdrawalId都为null，用户调用 `GET /api/user/transactions`
- **THEN** 系统应：
  - API正常返回，不抛出错误
  - `performedBy` 字段为 null
  - `performedByUser` 字段为 null
  - `withdrawalId` 字段为 null
  - `withdrawal` 字段为 null
  - 其他字段（amount、type、status等）正常显示

### Requirement: 安全性要求

系统 SHALL 防止XSS攻击，所有用户可见的文本内容 MUST 清理。

#### Scenario: 文本内容XSS防护
- **WHEN** 数据库中有Payment记录，note字段包含潜在的恶意脚本，前端显示账务记录列表
- **THEN** 系统应：
  - 所有来自数据库的文本内容使用 `sanitizeText()` 清理
  - HTML标签被转义或移除
  - JavaScript代码不被执行

#### Scenario: 元数据敏感信息处理（未来需求）
- **WHEN** 管理员调账时在metadata中记录了内部敏感信息，普通用户查看账务记录
- **THEN** 当前版本暂不实施敏感信息过滤，metadata完整返回
- **NOTE**: 未来版本应根据需要添加过滤逻辑，保护敏感字段
