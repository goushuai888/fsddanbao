# 技术设计

## Context

`src/lib/audit.ts` 已实现完整的审计日志工具，包括：
- `logAudit()` 函数：创建审计日志并处理异常
- `AUDIT_ACTIONS` 常量：预定义的审计操作类型
- `extractIP()` 函数：从请求头提取真实IP

现需要在4个管理员 API 路由中集成调用。

## Goals / Non-Goals

**Goals:**
- 在所有管理员写操作中记录审计日志
- 确保审计日志包含完整的操作上下文（谁、何时、做了什么、改了什么）
- 不影响主业务流程（审计日志失败不应导致业务操作失败）

**Non-Goals:**
- 不修改 `logAudit()` 函数的核心逻辑（已充分测试）
- 不记录只读操作（GET请求），仅记录写操作
- 不记录普通用户的操作，仅记录管理员操作

## Decisions

### 决策1：在事务外调用审计日志

**选择**：在 Prisma 事务**完成后**调用 `logAudit()`

**理由**：
- 审计日志失败不应导致事务回滚（业务优先）
- `logAudit()` 内部有 try-catch，失败只记录错误到控制台
- 事务成功后再记录审计，确保记录的是已提交的数据

**替代方案**：
- ❌ 在事务内调用 - 会增加事务复杂度，审计失败可能回滚业务
- ❌ 使用独立事务 - 增加数据库连接开销，过度设计

**代码模式**：
```typescript
// 业务事务
await prisma.$transaction([...])

// 事务成功后记录审计日志
await logAudit({
  userId: payload.userId,
  action: AUDIT_ACTIONS.APPROVE_WITHDRAWAL,
  target: withdrawalId,
  targetType: 'Withdrawal',
  oldValue: { status: 'PENDING' },
  newValue: { status: 'APPROVED' },
  req: request
})
```

### 决策2：扩展 AUDIT_ACTIONS 常量

**选择**：新增4个缺失的 action 常量

**新增常量**：
```typescript
export const AUDIT_ACTIONS = {
  // ... 现有常量 ...

  // 新增
  DELETE_USER: 'DELETE_USER',
  FAIL_WITHDRAWAL: 'FAIL_WITHDRAWAL',
  APPROVE_REFUND: 'APPROVE_REFUND',
  REJECT_REFUND: 'REJECT_REFUND'
} as const
```

**理由**：
- 保持命名一致性（全大写、下划线分隔）
- 类型安全（TypeScript `as const` 断言）
- 避免魔法字符串

### 决策3：记录修改前后的值

**选择**：使用 `oldValue` 和 `newValue` 记录变更对比

**关键字段**：
- 用户更新：记录被修改的字段（余额、角色、认证状态）
- 提现审核：记录状态变更（PENDING → APPROVED/REJECTED）
- 申诉处理：记录裁决结果和订单状态变更
- 退款处理：记录退款状态和订单状态

**数据格式**：使用JSON对象，便于查询和解析
```typescript
oldValue: { balance: 100, role: 'BUYER' }
newValue: { balance: 200, role: 'SELLER' }
```

### 决策4：异步执行不阻塞响应

**选择**：使用 `await logAudit()` 但不影响响应

**理由**：
- `logAudit()` 内部已处理异常（try-catch）
- 失败只记录错误，不抛出异常
- 对用户响应时间影响微乎其微（<10ms）

**替代方案**：
- ❌ 后台队列 - 过度设计，管理员操作频率低
- ❌ 完全忽略错误 - 失去调试能力

## Risks / Trade-offs

### 风险1：审计日志丢失

**风险**：数据库连接断开时，审计日志可能写入失败

**缓解措施**：
- `logAudit()` 捕获异常并记录到控制台
- 开发环境下额外打印审计摘要
- 生产环境可通过应用日志（如Sentry）追溯

**可接受性**：✅ 极低频率（数据库稳定性高），业务优先

### 风险2：性能影响

**影响分析**：
- 每个管理员操作额外增加1次数据库写入
- 管理员操作频率极低（<10次/天）
- 单次写入耗时 <10ms

**缓解措施**：
- 审计日志表有索引（userId, createdAt）
- 定期归档旧日志（超过1年）

**可接受性**：✅ 可忽略不计

### Trade-off：完整性 vs 简洁性

**选择**：优先完整性

- 记录完整的 oldValue/newValue（即使数据量大）
- 记录所有管理员操作（即使某些不涉及资金）
- 保留所有字段（IP、UserAgent）

**理由**：审计日志是合规要求，宁可冗余也不能遗漏

## Migration Plan

### 实施步骤

1. **扩展审计常量**（1分钟）
   - 在 `src/lib/audit.ts` 添加4个新 action

2. **集成用户管理API**（10分钟）
   - PATCH: 更新前先获取旧值
   - DELETE: 删除前获取完整用户信息

3. **集成提现管理API**（15分钟）
   - 4个操作分别记录不同 action

4. **集成申诉处理API**（10分钟）
   - 记录裁决结果和资金流向

5. **集成退款管理API**（10分钟）
   - 记录退款决策

6. **手动测试验证**（30分钟）
   - 每个API端点执行一次操作
   - Prisma Studio 检查审计日志

### 回滚方案

**如果发现严重问题**：
1. 移除所有 `logAudit()` 调用（恢复到原代码）
2. 删除新增的 AUDIT_ACTIONS 常量
3. 不需要数据库迁移（AuditLog表保留，不影响业务）

**回滚耗时**：<5分钟（简单的代码删除）

## Open Questions

无 - 所有技术细节已明确，可直接开始实施。
