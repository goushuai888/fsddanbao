## ADDED Requirements

### Requirement: 安全审计合规

系统 SHALL 满足金融类平台的安全审计要求，记录所有涉及资金操作和用户数据修改的管理员行为。

#### Scenario: 审计日志完整性

- **WHEN** 管理员执行任何敏感操作（用户管理、提现审核、申诉处理、退款处理）
- **THEN** 系统应确保审计日志包含以下必需字段：
  - 操作人身份（userId）
  - 操作时间（createdAt，自动记录）
  - 操作类型（action，使用预定义常量）
  - 操作目标（target + targetType）
  - 操作内容（oldValue/newValue，用于审计比对）
  - 来源追溯（ip + userAgent）

#### Scenario: 审计日志可查询

- **WHEN** 需要调查安全事件或纠纷
- **THEN** 系统应支持通过以下条件查询审计日志：
  - 按用户ID查询（哪个管理员做了什么）
  - 按操作类型查询（所有余额修改、所有提现批准等）
  - 按目标查询（某个用户/订单/提现的所有操作记录）
  - 按时间范围查询（某段时间内的所有操作）

#### Scenario: 审计日志不可篡改

- **WHEN** 审计日志创建后
- **THEN** 系统应确保审计日志只能创建，不能修改或删除（数据库约束）

### Requirement: IP地址真实性提取

系统 SHALL 正确提取客户端真实IP地址，支持反向代理和CDN场景。

#### Scenario: 反向代理环境IP提取

- **WHEN** 请求通过反向代理（Nginx、Vercel、Cloudflare等）
- **THEN** 系统应按优先级提取真实IP：
  1. `x-forwarded-for` 的第一个IP（最原始客户端）
  2. `x-real-ip`
  3. `cf-connecting-ip`（Cloudflare）
  4. 如果都不存在，返回 null

#### Scenario: IP地址格式验证

- **WHEN** 提取到IP地址
- **THEN** 系统应验证IP格式是否合法（IPv4或IPv6）
- **AND** 记录格式化后的IP地址（去除空格）

### Requirement: 审计操作常量管理

系统 SHALL 使用预定义的审计操作常量（`AUDIT_ACTIONS`），避免魔法字符串。

#### Scenario: 新增审计操作类型

- **WHEN** 需要记录新的审计操作类型
- **THEN** 必须先在 `src/lib/audit.ts` 的 `AUDIT_ACTIONS` 中定义常量
- **AND** 使用该常量而非直接传入字符串

#### Scenario: 审计操作类型命名规范

- **WHEN** 定义审计操作常量
- **THEN** 应遵循命名规范：`<动作>_<目标>`，如：
  - `UPDATE_USER_BALANCE`（更新用户余额）
  - `APPROVE_WITHDRAWAL`（批准提现）
  - `RESOLVE_DISPUTE`（解决申诉）
