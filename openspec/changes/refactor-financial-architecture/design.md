# 财务系统架构重构设计文档

## Context

### 背景
FSD担保交易平台当前财务系统存在架构缺陷，导致：
1. 数据不一致：Payment记录和User.balance不匹配
2. 审计追溯断裂：部分操作无Payment记录
3. 代码重复：财务逻辑散落在27个位置
4. 维护困难：每次新增财务操作需重复实现事务逻辑

### 约束
- **技术栈**: Next.js 14 + Prisma ORM + PostgreSQL
- **业务约束**:
  - 平台手续费率 3%
  - 提现手续费 2%
  - 所有财务操作必须审计
  - 支持未来扩展：用户间转账、佣金分成
- **性能约束**:
  - 财务操作 p95 响应时间 <200ms
  - 并发订单 >100/s 不冲突
- **合规要求**:
  - 金额使用 Decimal 类型（避免浮点误差）
  - 所有资金流动可追溯
  - 审计日志保留≥3年

### 利益相关者
- **开发团队**: 需要清晰的财务抽象层
- **产品/运营**: 需要完整的财务报表和审计能力
- **用户**: 需要准确的余额和账务记录
- **监管**: 需要完整的资金流水追溯

## Goals / Non-Goals

### Goals
1. **统一财务入口**: 所有余额变动通过 WalletService
2. **强一致性**: Payment记录和User.balance严格同步
3. **完整审计**: 每笔资金流动可追溯到操作人和原因
4. **可扩展性**: 支持未来新增财务操作类型
5. **向后兼容**: 现有API接口不变，前端无需修改

### Non-Goals
1. ❌ 重构所有订单逻辑（仅财务相关）
2. ❌ 实现实时支付网关（仍使用模拟支付）
3. ❌ 多币种支持（当前仅人民币）
4. ❌ 性能优化（除非影响核心功能）

## Decisions

### Decision 1: 采用 WalletService 模式而非 Event Sourcing

**选择**: Centralized WalletService

**理由**:
- ✅ **简单性**: 团队熟悉的 Service 模式，学习曲线低
- ✅ **满足需求**: 当前业务规模无需 Event Sourcing 复杂度
- ✅ **性能**: 直接数据库事务，响应时间 <50ms
- ✅ **可演进**: 未来可逐步迁移到 Event Sourcing

**替代方案**:
- ❌ **Event Sourcing**: 过度设计，团队学习成本高
- ❌ **直接Prisma**: 无法统一财务逻辑，问题依旧

**架构图**:
```
┌─────────────────┐
│   API Routes    │
│  (Controllers)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐      ┌──────────────┐
│  WalletService  │─────▶│ PaymentGateway│
│  (Core Logic)   │      │  (Persistence)│
└────────┬────────┘      └───────┬───────┘
         │                       │
         ▼                       ▼
┌─────────────────┐      ┌──────────────┐
│  AuditLogger    │      │   Prisma     │
│  (Audit Trail)  │      │  (Database)  │
└─────────────────┘      └──────────────┘
```

### Decision 2: Payment 和 Withdrawal 双向关联

**选择**: 添加 `Payment.withdrawalId` 和 `Withdrawal.payments[]`

**理由**:
- ✅ **一致性**: 提现申请、拒绝恢复、完成都有Payment记录
- ✅ **审计**: 可从任一端追溯完整流程
- ✅ **灵活性**: 支持提现部分到账等复杂场景

**数据流**:
```
用户申请提现:
1. WalletService.debit() → Payment(type=WITHDRAW, status=PENDING, withdrawalId=xxx)
2. User.balance -= amount
3. Withdrawal.create(status=PENDING)

管理员拒绝:
1. WalletService.credit() → Payment(type=REFUND, status=COMPLETED, withdrawalId=xxx)
2. User.balance += amount
3. Withdrawal.update(status=REJECTED)
4. Payment(WITHDRAW).update(status=CANCELLED)
```

**替代方案**:
- ❌ **仅单向关联**: 从Payment无法查询Withdrawal
- ❌ **合并Withdrawal到Payment**: 丢失业务语义

### Decision 3: 管理员调余额使用特殊 PaymentType

**选择**: 新增 `PaymentType.ADMIN_ADJUSTMENT`

**理由**:
- ✅ **语义明确**: 区分正常业务和人工干预
- ✅ **审计**: 方便筛选所有管理员调账记录
- ✅ **元数据**: `Payment.metadata` 存储调账原因

**示例**:
```typescript
await walletService.adminAdjustBalance({
  userId: 'user_123',
  amount: 100,          // 正数=增加，负数=扣除
  reason: '补偿订单异常损失',
  adminUserId: 'admin_456',
  note: '订单#ORD-001 因系统故障导致重复扣款'
})

// 生成Payment:
{
  type: 'ADMIN_ADJUSTMENT',
  amount: 100,
  performedBy: 'admin_456',
  metadata: {
    reason: '补偿订单异常损失',
    note: '订单#ORD-001 因系统故障导致重复扣款',
    relatedOrderNo: 'ORD-001'
  }
}
```

**替代方案**:
- ❌ **复用 REFUND**: 语义混淆，审计困难
- ❌ **不创建Payment**: 无法追溯资金来源

### Decision 4: 保留现有 UseCase 层

**选择**: UseCase 调用 WalletService，不直接删除

**理由**:
- ✅ **职责分离**: UseCase 负责业务流程，WalletService 负责财务操作
- ✅ **事务边界**: UseCase 管理跨领域事务（订单+财务）
- ✅ **可测试性**: 可单独测试 WalletService 财务逻辑

**示例**:
```typescript
// ConfirmOrderUseCase.ts
class ConfirmOrderUseCase {
  async execute(input) {
    return await prisma.$transaction(async (tx) => {
      // 1. 订单逻辑
      const order = await tx.order.updateMany({ ... })

      // 2. 财务逻辑（委托给 WalletService）
      await walletService.credit({
        userId: order.sellerId,
        amount: releaseAmount,
        type: 'RELEASE',
        orderId: order.id,
        note: '订单完成,释放款项给卖家'
      }, tx)  // 传入事务上下文

      return order
    })
  }
}
```

**替代方案**:
- ❌ **删除UseCase**: 业务逻辑直接暴露在API层
- ❌ **UseCase内部实现**: 财务逻辑无法复用

## Risks / Trade-offs

### Risk 1: 数据库 Migration 失败

**风险**: 添加 Payment 新字段时数据库迁移失败

**影响**: MEDIUM - 阻塞部署

**缓解措施**:
1. 新字段设为可空（`nullable: true`）
2. 分阶段迁移：
   - 先添加字段（向后兼容）
   - 再迁移代码使用新字段
   - 最后可选：回填历史数据
3. 准备回滚脚本删除新字段

**回滚计划**:
```sql
-- Rollback migration
ALTER TABLE "Payment" DROP COLUMN "withdrawalId";
ALTER TABLE "Payment" DROP COLUMN "performedBy";
ALTER TABLE "Payment" DROP COLUMN "metadata";
```

### Risk 2: WalletService 成为性能瓶颈

**风险**: 所有财务操作集中到一个服务，可能影响并发

**影响**: LOW - 当前订单量 <100/s，WalletService 响应时间 <10ms

**缓解措施**:
1. 使用数据库行锁而非服务层锁
2. 财务操作已在事务中，天然串行化
3. 监控：添加 WalletService 性能指标

**性能基准**:
```
当前: 确认收货操作 p95 = 80ms (含订单+财务+审计)
目标: WalletService.credit() p95 < 20ms
监控: 如果 p95 > 50ms，考虑优化或拆分
```

### Risk 3: 历史数据兼容性

**风险**: 旧 Payment 记录无 `withdrawalId` 和 `performedBy`

**影响**: LOW - 仅影响审计报表的完整性

**缓解措施**:
1. 查询时容错：`payment.performedBy || 'SYSTEM'`
2. 报表标注：历史数据（2025-10-20前）可能缺失操作人
3. 可选：编写脚本回填关键历史数据

**回填优先级**:
- 🔴 **高**: 最近30天的管理员操作
- 🟡 **中**: 最近90天的提现记录
- 🟢 **低**: 更早的历史数据

### Trade-off: 灵活性 vs 约束

**选择**: 强约束（禁止直接修改 balance）

**优势**:
- ✅ 数据一致性保证
- ✅ 审计追溯完整
- ✅ 降低 Bug 风险

**劣势**:
- ⚠️ 开发需适应新模式
- ⚠️ 紧急修复余额需通过 WalletService

**缓解**:
- 提供 `walletService.adminAdjustBalance()` 应急接口
- 添加 ESLint 规则提示开发者
- 文档和代码注释清晰说明

## Migration Plan

### Phase 0: 准备 (Day 1, 4小时)

**目标**: 搭建基础设施

1. **创建目录结构**:
   ```
   src/lib/domain/finance/
   ├── WalletService.ts
   ├── PaymentGateway.ts
   ├── FinancialTransaction.ts
   ├── types.ts
   ├── __tests__/
   │   ├── WalletService.test.ts
   │   └── PaymentGateway.test.ts
   └── README.md
   ```

2. **数据库 Migration**:
   ```bash
   pnpm db:migrate:create add_payment_financial_fields
   ```
   ```prisma
   -- Migration
   ALTER TABLE "Payment" ADD COLUMN "withdrawalId" TEXT;
   ALTER TABLE "Payment" ADD COLUMN "performedBy" TEXT;
   ALTER TABLE "Payment" ADD COLUMN "metadata" JSONB;

   CREATE INDEX "Payment_withdrawalId_idx" ON "Payment"("withdrawalId");
   CREATE INDEX "Payment_performedBy_idx" ON "Payment"("performedBy");
   ```

3. **运行 Migration**:
   ```bash
   pnpm db:push  # 开发环境
   # 或
   pnpm db:migrate  # 生产环境
   ```

### Phase 1: 核心实现 (Day 1-2, 8小时)

**目标**: 实现 WalletService 核心逻辑

**步骤**:
1. 实现 `FinancialTransaction.ts` 类型定义
2. 实现 `PaymentGateway.ts` 数据访问层
3. 实现 `WalletService.ts` 核心方法：
   - `credit()` - 入账
   - `debit()` - 出账
   - `adminAdjustBalance()` - 管理员调账
   - `getBalance()` - 查询余额
4. 编写单元测试覆盖率 >90%

**验收标准**:
```typescript
// 测试示例
describe('WalletService.credit', () => {
  it('should create payment and update balance atomically', async () => {
    const result = await walletService.credit({
      userId: 'user_123',
      amount: 100,
      type: 'REFUND',
      note: 'Test refund'
    })

    expect(result.payment.amount).toBe(100)
    expect(result.payment.type).toBe('REFUND')
    expect(result.newBalance).toBe(initialBalance + 100)
  })

  it('should rollback on failure', async () => {
    // 模拟余额更新失败
    await expect(
      walletService.credit({ amount: -100 })  // 非法金额
    ).rejects.toThrow()

    // 验证Payment未创建
    const payments = await prisma.payment.findMany()
    expect(payments).toHaveLength(0)
  })
})
```

### Phase 2: API 迁移 (Day 2-3, 10小时)

**目标**: 迁移所有财务操作到 WalletService

**优先级**:
1. 🔴 **P0**: 管理员退款（数据不一致问题）
2. 🔴 **P0**: 管理员调余额（审计缺失问题）
3. 🟡 **P1**: 提现拒绝/失败（Payment状态同步）
4. 🟡 **P1**: UseCase 层迁移（代码重复）

**步骤**:
1. **管理员退款** (`/api/admin/refunds/[id]`):
   ```typescript
   // 修改前: 60行
   await prisma.payment.create({ ... })
   // 无余额更新

   // 修改后: 10行
   const result = await walletService.credit({
     userId: order.buyerId,
     amount: refundAmount,
     type: 'REFUND',
     orderId: order.id,
     note: note || '管理员批准退款申请',
     performedBy: auth.userId
   })
   ```

2. **管理员调余额** (`/api/admin/users/[id]`):
   ```typescript
   // 修改前: 直接修改
   updateData.balance = balance

   // 修改后: 通过 WalletService
   if (balance !== undefined) {
     const currentBalance = await walletService.getBalance(params.id)
     const adjustAmount = balance - currentBalance

     await walletService.adminAdjustBalance({
       userId: params.id,
       amount: adjustAmount,
       reason: '管理员手动调整余额',
       adminUserId: auth.userId,
       note: reviewNote
     })
   }
   ```

3. **提现拒绝/失败** (`/api/admin/withdrawals/[id]`):
   ```typescript
   // 修改前: 只恢复余额
   await tx.user.update({ balance: { increment } })

   // 修改后: 同步Payment状态
   await walletService.refundWithdrawal({
     withdrawalId: id,
     originalPaymentId: withdrawal.paymentId,  // 关联原Payment
     reason: rejectReason,
     adminUserId: auth.userId
   })
   ```

4. **UseCase 迁移**:
   - `ConfirmOrderUseCase` - 释放款项
   - `ApproveRefundUseCase` - 退款

### Phase 3: 测试验证 (Day 4, 6小时)

**目标**: 确保所有财务操作正确性

**测试清单**:
1. ✅ **单元测试**: WalletService 覆盖率 >90%
2. ✅ **集成测试**: 运行现有 `verify-transactions.ts`
3. ✅ **手动测试**:
   - 管理员退款 → 检查余额和Payment
   - 管理员调余额 → 检查Payment记录
   - 提现拒绝 → 检查Payment状态
   - 确认收货 → 检查卖家余额

**数据验证脚本**:
```typescript
// scripts/verify-wallet-integrity.ts
async function verifyWalletIntegrity() {
  // 检查1: 所有用户余额 = sum(Payment)
  const users = await prisma.user.findMany()
  for (const user of users) {
    const calculatedBalance = await calculateBalanceFromPayments(user.id)
    if (user.balance !== calculatedBalance) {
      console.error(`用户 ${user.id} 余额不一致`)
    }
  }

  // 检查2: 所有Withdrawal都有对应Payment
  const withdrawals = await prisma.withdrawal.findMany()
  for (const w of withdrawals) {
    const payments = await prisma.payment.findMany({
      where: { withdrawalId: w.id }
    })
    if (payments.length === 0) {
      console.error(`提现 ${w.id} 缺少Payment记录`)
    }
  }
}
```

### Phase 4: 部署和监控 (Day 5, 4小时)

**目标**: 安全上线并监控

**部署步骤**:
1. 备份生产数据库
2. 运行 Migration（添加字段）
3. 部署新代码
4. 运行数据完整性验证脚本
5. 监控财务操作错误率

**监控指标**:
```
关键指标:
- WalletService.credit() 响应时间 p95 < 50ms
- WalletService.debit() 响应时间 p95 < 50ms
- 财务操作错误率 < 0.1%
- Payment 和 balance 一致性 100%

告警规则:
- 响应时间 p95 > 100ms → 🟡 警告
- 错误率 > 1% → 🔴 严重
- 数据不一致 → 🔴 严重（立即人工介入）
```

**回滚触发条件**:
- 财务操作错误率 > 5%
- 发现数据不一致且无法修复
- 严重性能问题（p95 > 500ms）

**回滚步骤**:
1. 恢复旧代码
2. 回滚 Migration（删除新字段）
3. 验证系统恢复正常
4. 分析问题根因

## Open Questions

1. **Q**: 是否需要支持批量财务操作（如批量退款）？
   - **A**: 暂不需要，未来可通过 `WalletService.batchCredit()` 扩展

2. **Q**: Payment.metadata 的 JSON 结构是否需要定义 schema？
   - **A**: 建议定义 TypeScript 类型，但不强制数据库 schema，保持灵活性

3. **Q**: 是否需要财务操作的幂等性支持？
   - **A**: 当前使用乐观锁已足够，未来可添加 `idempotencyKey` 字段

4. **Q**: WalletService 是否需要支持分布式事务？
   - **A**: 当前单体应用无需，使用 Prisma 事务已足够

5. **Q**: 是否需要实时余额缓存（Redis）？
   - **A**: 暂不需要，数据库查询已足够快（<5ms），过早优化

## References

- [Prisma Transaction API](https://www.prisma.io/docs/concepts/components/prisma-client/transactions)
- [Money Pattern by Martin Fowler](https://martinfowler.com/eaaCatalog/money.html)
- [Event Sourcing Pattern](https://microservices.io/patterns/data/event-sourcing.html)
- 项目现有文档:
  - `SECURITY_VERIFICATION_REPORT.md` - 事务完整性测试
  - `REFUND_SYSTEM_FIX_REPORT.md` - 退款系统修复
  - `CLAUDE.md` - 项目架构说明
