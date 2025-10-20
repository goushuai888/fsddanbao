# 财务系统架构重构提案

## Why

当前财务系统存在严重的架构问题，导致数据不一致、审计追溯不完整、业务逻辑重复散落。

### 核心问题

1. **余额操作分散且不一致** (CRITICAL)
   - 27处余额修改散落各处，无统一财务核心
   - 管理员可直接修改余额无Payment记录 (`/api/admin/users/[id]` line 137)
   - 部分操作有Payment记录，部分没有
   - 账务追溯链断裂，无法审计完整资金流

2. **Payment记录缺失用户余额变动** (CRITICAL)
   - 管理员退款只创建Payment记录，**不更新买家余额** (`/api/admin/refunds/[id]` line 62-83)
   - 用户在账务记录页看到"退款到账"，但余额未增加
   - Payment表和User.balance数据不一致

3. **缺少财务领域层** (HIGH)
   - 无统一的 FinancialService 或 WalletService
   - Payment/Withdrawal操作分散在各API路由
   - 每个操作重复实现：创建Payment + 更新余额 + 审计日志

4. **Withdrawal和Payment未关联** (MEDIUM)
   - 提现申请创建独立的Withdrawal记录
   - 同时创建Payment(type=WITHDRAW)记录
   - 两者无关联，数据重复，审计困难

### 业务影响

| 操作 | Payment记录 | 余额更新 | 一致性 | 影响 |
|------|-----------|---------|--------|------|
| 管理员退款 | ✅ 有 | ❌ **缺失** | ❌ 不一致 | 用户看不到退款 |
| 管理员调余额 | ❌ **缺失** | ✅ 直接改 | ❌ 不一致 | 无法审计资金来源 |
| 提现拒绝/失败 | ⚠️ 未同步 | ✅ 恢复 | ⚠️ 半一致 | Payment状态错误 |

## What Changes

### 1. 创建财务领域层 (NEW)

**新增模块**：
```
src/lib/domain/finance/
├── WalletService.ts           # 统一钱包服务（核心）
├── FinancialTransaction.ts    # 财务事务类型定义
├── PaymentGateway.ts          # Payment操作封装
└── README.md                  # 架构说明
```

**WalletService API**：
```typescript
class WalletService {
  // 入账（增加余额）
  async credit(params: CreditParams): Promise<Payment>

  // 出账（扣除余额）
  async debit(params: DebitParams): Promise<Payment>

  // 管理员调账（特殊操作）
  async adminAdjustBalance(params: AdminAdjustParams): Promise<Payment>

  // 查询余额
  async getBalance(userId: string): Promise<Decimal>

  // 查询账务历史
  async getTransactionHistory(userId: string, filters): Promise<Payment[]>
}
```

**核心规则**：
- ✅ 所有余额变动**必须**通过 WalletService
- ✅ 每次变动**必须**创建 Payment 记录
- ✅ Payment 和 余额更新 在**同一事务**
- ✅ 禁止直接修改 `user.balance`

### 2. 重构现有财务操作 (MODIFIED)

**管理员退款API** (`/api/admin/refunds/[id]`)：
```typescript
// ❌ 修复前
await prisma.payment.create({ type: 'REFUND' })  // 只创建记录

// ✅ 修复后
await walletService.credit({
  userId: order.buyerId,
  amount: refundAmount,
  type: 'REFUND',
  orderId: order.id,
  note: '管理员批准退款申请',
  performedBy: adminUserId  // 审计追溯
})
```

**管理员调整余额** (`/api/admin/users/[id]`)：
```typescript
// ❌ 修复前
updateData.balance = balance  // 直接修改，无Payment记录

// ✅ 修复后
await walletService.adminAdjustBalance({
  userId: targetUserId,
  amount: adjustAmount,
  reason: '管理员手动调整余额',
  adminUserId: auth.userId,
  note: reviewNote
})
```

**提现拒绝/失败** (`/api/admin/withdrawals/[id]`)：
```typescript
// ❌ 修复前
await tx.user.update({ balance: { increment } })  // Payment未同步状态

// ✅ 修复后
await walletService.refundWithdrawal({
  withdrawalId: id,
  reason: rejectReason,
  adminUserId: auth.userId
})
// 自动更新关联Payment状态为CANCELLED
```

### 3. 数据库Schema变更 (BREAKING)

**Payment表增强**：
```prisma
model Payment {
  // ... 现有字段 ...

  // ✅ 新增: 关联提现申请
  withdrawalId    String?       // 关联Withdrawal记录
  withdrawal      Withdrawal?   @relation(fields: [withdrawalId], references: [id])

  // ✅ 新增: 操作人追溯
  performedBy     String?       // 操作人userId（管理员操作时填充）
  performedByUser User?         @relation("PerformedPayments", fields: [performedBy], references: [id])

  // ✅ 新增: 元数据
  metadata        Json?         // 扩展信息（调账原因、退款详情等）

  @@index([withdrawalId])
  @@index([performedBy])
}
```

**Withdrawal表增强**：
```prisma
model Withdrawal {
  // ... 现有字段 ...

  // ✅ 新增: 关联Payment记录
  payments        Payment[]     // 一对多：申请、拒绝恢复等
}
```

**User表关联**：
```prisma
model User {
  // ... 现有字段 ...

  // ✅ 新增: 操作的Payment记录
  performedPayments Payment[]  @relation("PerformedPayments")
}
```

### 4. UseCase层调整 (MODIFIED)

**现有UseCase迁移到WalletService**：
- `ConfirmOrderUseCase` - 调用 `walletService.credit()` 释放款项
- `ApproveRefundUseCase` - 调用 `walletService.credit()` 退款
- `PayOrderUseCase` - 保持现有逻辑（托管不涉及余额）

### 5. 审计增强 (ENHANCED)

**所有财务操作自动记录**：
- WalletService内部集成审计日志
- 自动记录：操作人、金额、类型、关联订单/提现
- 元数据包含：调账原因、退款详情、管理员备注

## Impact

### Affected Specs
- **财务交易规范** (新建 `specs/financial-transactions/spec.md`)
- **钱包服务规范** (新建 `specs/wallet-service/spec.md`)
- **管理员操作规范** (修改 `specs/admin-operations/spec.md`)

### Affected Code

**新增文件** (约 600 行)：
- `src/lib/domain/finance/WalletService.ts` (~250行)
- `src/lib/domain/finance/FinancialTransaction.ts` (~100行)
- `src/lib/domain/finance/PaymentGateway.ts` (~150行)
- `src/lib/domain/finance/README.md` (~100行)

**修改文件** (约 300 行)：
- `src/app/api/admin/refunds/[id]/route.ts` (~50行修改)
- `src/app/api/admin/users/[id]/route.ts` (~80行修改)
- `src/app/api/admin/withdrawals/[id]/route.ts` (~100行修改)
- `src/lib/actions/orders/ConfirmOrderUseCase.ts` (~30行修改)
- `src/lib/actions/orders/ApproveRefundUseCase.ts` (~30行修改)
- `prisma/schema.prisma` (~20行新增)

**数据迁移**：
- 创建migration为Payment添加新字段
- 历史数据兼容（新字段可选）

### Breaking Changes

**⚠️ BREAKING: Schema变更**
- Payment表新增 `withdrawalId`, `performedBy`, `metadata` 字段
- 需要数据库migration
- 旧代码读取Payment兼容（新字段可空）

**✅ 非破坏性变更**：
- API接口保持不变
- 前端无需修改
- UseCase签名兼容

### Migration Path

**阶段1: 准备** (Day 1)
1. 创建 WalletService 及相关类
2. 编写单元测试覆盖核心逻辑
3. 数据库migration（添加字段）

**阶段2: 迁移** (Day 2-3)
1. 管理员退款API迁移到WalletService
2. 管理员调余额API迁移到WalletService
3. 提现API迁移到WalletService
4. UseCase层迁移

**阶段3: 验证** (Day 4)
1. 运行现有测试脚本验证事务完整性
2. 手动测试所有财务操作
3. 验证Payment记录和余额一致性

**阶段4: 清理** (Day 5)
1. 添加 ESLint rule 禁止直接修改 balance
2. 更新文档和注释
3. 归档本次变更

### Risk Assessment

**技术风险**：
- 🟡 **中等** - 涉及核心财务逻辑，需充分测试
- 🟢 **低** - 使用事务保护，回滚安全

**业务风险**：
- 🟢 **低** - API接口不变，前端无感知
- 🟢 **低** - 分阶段迁移，可逐步验证

**回滚计划**：
- Schema字段可空，可安全回滚代码
- 保留旧逻辑作为备份
- 数据库可回滚migration

## Success Criteria

**功能验证**：
- ✅ 所有余额变动都有对应Payment记录
- ✅ 管理员退款后买家余额正确增加
- ✅ 管理员调余额有完整审计追溯
- ✅ 提现拒绝/失败后Payment状态正确

**测试覆盖**：
- ✅ WalletService 单元测试覆盖率 >90%
- ✅ 现有事务测试全部通过
- ✅ 新增管理员操作集成测试

**性能要求**：
- ✅ 财务操作响应时间 <200ms (p95)
- ✅ 数据库事务冲突率 <0.1%

**文档完善**：
- ✅ WalletService API文档
- ✅ 财务架构设计文档
- ✅ 迁移指南和回滚步骤
