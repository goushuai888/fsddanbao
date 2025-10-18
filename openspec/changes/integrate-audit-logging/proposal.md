# 审计日志集成提案

## Why

当前系统存在严重的安全合规缺陷：`src/lib/audit.ts` 已经实现了完整的审计日志工具函数，但在所有管理员 API 中都**未被调用**。这导致：

1. **无操作追溯** - 无法追查管理员的敏感操作（用户余额修改、提现批准、申诉处理等）
2. **安全合规风险** - 不符合金融类平台的审计要求
3. **纠纷处理困难** - 发生问题时无法定位责任人和操作时间
4. **监管风险** - 涉及资金操作的平台必须保留完整审计日志

根据 CLAUDE.md 的安全改进计划，这是**高优先级 🔴** 任务，影响13个管理员 API 路由。

## What Changes

将现有的 `logAudit()` 函数集成到所有管理员写操作 API 中，记录关键操作的详细信息：

### 受影响的 API 端点（4个写操作）

1. **用户管理** (`src/app/api/admin/users/[id]/route.ts`)
   - `PATCH` - 更新用户信息（余额、角色、认证状态）
   - `DELETE` - 删除用户

2. **提现管理** (`src/app/api/admin/withdrawals/[id]/route.ts`)
   - `PATCH` - 审核提现申请（批准/拒绝/完成/失败）

3. **申诉处理** (`src/app/api/admin/disputes/[id]/route.ts`)
   - `PATCH` - 处理申诉（同意/拒绝）

4. **退款管理** (`src/app/api/admin/refunds/[id]/route.ts`)
   - `PATCH` - 处理退款申请（批准/拒绝）

### 记录内容

每个操作记录以下信息：
- 操作人（userId）
- 操作类型（action，使用 `AUDIT_ACTIONS` 常量）
- 操作目标（target，如 userId/orderId/withdrawalId）
- 目标类型（targetType，如 User/Order/Withdrawal/Dispute）
- 旧值/新值（oldValue/newValue，用于比对）
- 描述（description）
- IP地址和User-Agent（自动提取）

### 非功能性改进

- **不影响主流程** - 审计日志失败不会导致业务操作失败（已在 `logAudit()` 中处理）
- **开发环境可见** - 开发时控制台打印审计日志（便于调试）
- **异步执行** - 不阻塞主业务逻辑

## Impact

### 受影响的规范
- **新增**: `specs/admin-operations/spec.md` - 管理员操作审计规范
- **新增**: `specs/security/spec.md` - 安全审计要求

### 受影响的代码文件
- `src/app/api/admin/users/[id]/route.ts` (3处调用)
- `src/app/api/admin/withdrawals/[id]/route.ts` (5处调用)
- `src/app/api/admin/disputes/[id]/route.ts` (2处调用)
- `src/app/api/admin/refunds/[id]/route.ts` (2处调用)

### 数据库影响
- 无 schema 变更（`AuditLog` 表已存在）
- 预期日志增长：低频（管理员操作较少）

### 风险评估
- **风险等级**: 低
- **回滚方案**: 简单（移除审计日志调用即可）
- **测试范围**:
  - 验证审计日志正确记录
  - 验证主业务流程不受影响
  - 验证审计日志失败不影响主流程

### 合规性收益
- ✅ 满足金融平台审计要求
- ✅ 提供完整操作追溯能力
- ✅ 支持安全事件调查
- ✅ 为未来合规审查做准备
