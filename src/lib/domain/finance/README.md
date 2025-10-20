# 财务领域模块 (Finance Domain)

本模块提供了统一的钱包服务和财务操作管理,确保所有财务交易的原子性和数据一致性。

## 📦 核心组件

### WalletService - 钱包服务 (业务逻辑层)

统一的财务操作入口,确保:
- ✅ Payment记录和User.balance严格同步
- ✅ 所有操作在事务中执行
- ✅ 完整的审计追溯
- ✅ 参数验证和错误处理

### PaymentGateway - Payment数据访问层

封装所有Payment相关的数据库操作:
- ✅ 创建和更新Payment记录
- ✅ 查询Payment历史(支持筛选和分页)
- ✅ 余额计算和验证

## 🚀 快速开始

### 安装依赖

```bash
pnpm install
```

### 运行测试

```bash
# 运行所有财务模块测试 (45个测试用例)
pnpm test src/lib/domain/finance

# 运行WalletService测试 (19个测试)
pnpm test src/lib/domain/finance/__tests__/WalletService.test.ts

# 运行PaymentGateway测试 (26个测试)
pnpm test src/lib/domain/finance/__tests__/PaymentGateway.test.ts

# 查看测试覆盖率
pnpm test:coverage src/lib/domain/finance
```

## 📖 API 文档

### WalletService

#### credit() - 入账操作

**使用场景:**
- 确认收货释放款项给卖家
- 退款给买家
- 提现拒绝/失败恢复余额
- 管理员增加用户余额

**方法签名:**
```typescript
async credit(
  params: CreditParams,
  tx?: PrismaTransactionClient
): Promise<FinancialOperationResult>
```

**参数:**
```typescript
interface CreditParams {
  userId: string              // 用户ID
  amount: number | Decimal    // 入账金额（必须>0）
  type: PaymentType           // 支付类型: RELEASE | REFUND | ADMIN_ADJUSTMENT
  orderId?: string            // 关联订单ID（可选）
  withdrawalId?: string       // 关联提现ID（可选）
  note: string                // 备注说明（必填）
  performedBy?: string        // 操作人ID（管理员操作时必填）
  metadata?: Record<string, any>  // 元数据（可选）
  paymentMethod?: string      // 支付方式（可选）
  transactionId?: string      // 第三方交易ID（可选）
}
```

**返回值:**
```typescript
interface FinancialOperationResult {
  payment: Payment           // 创建的Payment记录
  newBalance: Decimal        // 操作后的新余额
  success: true              // 操作是否成功
}
```

**使用示例:**
```typescript
import { walletService } from '@/lib/domain/finance/WalletService'

// 确认收货,释放款项给卖家
const result = await walletService.credit({
  userId: order.sellerId,
  amount: order.price,
  type: 'RELEASE',
  orderId: order.id,
  note: `订单 ${order.orderNo} 确认收货`
})

console.log(`新余额: ¥${result.newBalance}`)
console.log(`Payment ID: ${result.payment.id}`)
```

**错误处理:**
```typescript
import { FinancialError, FinancialErrorCode } from '@/lib/domain/finance/types'

try {
  await walletService.credit(params)
} catch (error) {
  if (error instanceof FinancialError) {
    switch (error.code) {
      case FinancialErrorCode.INVALID_AMOUNT:
        console.error('金额无效:', error.message)
        break
      case FinancialErrorCode.USER_NOT_FOUND:
        console.error('用户不存在:', error.message)
        break
      default:
        console.error('财务操作失败:', error.message)
    }
  }
}
```

---

#### debit() - 出账操作

**使用场景:**
- 用户申请提现
- 管理员扣除用户余额

**方法签名:**
```typescript
async debit(
  params: DebitParams,
  tx?: PrismaTransactionClient
): Promise<FinancialOperationResult>
```

**参数:**
```typescript
interface DebitParams {
  userId: string              // 用户ID
  amount: number | Decimal    // 扣除金额（必须>0）
  type: PaymentType           // 支付类型: WITHDRAW | ADMIN_ADJUSTMENT
  orderId?: string            // 关联订单ID（可选）
  withdrawalId?: string       // 关联提现ID（可选）
  note: string                // 备注说明（必填）
  performedBy?: string        // 操作人ID（管理员操作时必填）
  metadata?: Record<string, any>  // 元数据（可选）
  paymentMethod?: string      // 支付方式（可选）
  transactionId?: string      // 第三方交易ID（可选）
}
```

**使用示例:**
```typescript
// 用户申请提现
const result = await walletService.debit({
  userId: user.id,
  amount: withdrawalAmount,
  type: 'WITHDRAW',
  withdrawalId: withdrawal.id,
  note: `提现申请 - ${withdrawMethod}`
})
```

**余额检查:**
```typescript
// debit会自动检查余额是否足够
try {
  await walletService.debit({
    userId: user.id,
    amount: 1000,
    type: 'WITHDRAW',
    note: '提现'
  })
} catch (error) {
  if (error.code === FinancialErrorCode.INSUFFICIENT_BALANCE) {
    console.error('余额不足:', error.details.currentBalance)
  }
}
```

---

#### adminAdjustBalance() - 管理员调账

**使用场景:**
- 补偿用户损失
- 扣除违规用户资金
- 其他人工干预调整

**方法签名:**
```typescript
async adminAdjustBalance(
  params: AdminAdjustBalanceParams
): Promise<FinancialOperationResult>
```

**参数:**
```typescript
interface AdminAdjustBalanceParams {
  userId: string              // 目标用户ID
  amount: number | Decimal    // 调整金额（绝对值）
  isCredit: boolean           // true=增加余额, false=扣除余额
  reason: string              // 调账原因（必填,用于审计）
  adminUserId: string         // 管理员ID（必填）
  note?: string               // 额外备注（可选）
  relatedOrderNo?: string     // 关联订单号（可选）
}
```

**使用示例:**
```typescript
// 补偿用户损失
const result = await walletService.adminAdjustBalance({
  userId: 'user-123',
  amount: 100,
  isCredit: true,
  reason: '系统错误导致的损失补偿',
  adminUserId: 'admin-456',
  note: '用户反馈订单异常',
  relatedOrderNo: 'ORD-789'
})

// 扣除违规收益
await walletService.adminAdjustBalance({
  userId: 'user-123',
  amount: 500,
  isCredit: false,
  reason: '刷单行为,扣除违规收益',
  adminUserId: 'admin-456'
})
```

**审计日志:**
```typescript
// adminAdjustBalance会自动记录审计日志
// 包含: adminUserId, targetUserId, amount, reason, timestamp
```

---

#### refundWithdrawal() - 提现退款

**使用场景:**
- 管理员拒绝提现申请
- 提现处理失败（如银行转账失败）

**方法签名:**
```typescript
async refundWithdrawal(
  params: RefundWithdrawalParams
): Promise<FinancialOperationResult>
```

**参数:**
```typescript
interface RefundWithdrawalParams {
  withdrawalId: string        // 提现申请ID
  reason: string              // 退款原因（必填）
  adminUserId: string         // 管理员ID（必填）
  note?: string               // 额外备注（可选）
}
```

**使用示例:**
```typescript
// 拒绝提现申请,恢复余额
const result = await walletService.refundWithdrawal({
  withdrawalId: 'withdrawal-123',
  reason: '银行卡信息错误',
  adminUserId: 'admin-456',
  note: '请用户更新银行卡信息后重新申请'
})
```

**原子操作:**
```typescript
// refundWithdrawal在一个事务中执行:
// 1. 创建REFUND类型的Payment记录
// 2. 恢复用户余额
// 3. 更新原始WITHDRAW Payment状态为CANCELLED
// 4. 记录审计日志
```

---

#### getBalance() - 查询余额

**方法签名:**
```typescript
async getBalance(userId: string): Promise<Decimal>
```

**使用示例:**
```typescript
const balance = await walletService.getBalance('user-123')
console.log(`当前余额: ¥${balance}`)
```

---

#### calculateBalanceFromPayments() - 验证余额

**用途:** 从Payment记录计算余额,用于验证数据一致性

**方法签名:**
```typescript
async calculateBalanceFromPayments(userId: string): Promise<number>
```

**使用示例:**
```typescript
// 验证数据一致性
const actualBalance = await walletService.getBalance('user-123')
const calculatedBalance = await walletService.calculateBalanceFromPayments('user-123')

if (Number(actualBalance) !== calculatedBalance) {
  console.error('余额不一致!', {
    actual: Number(actualBalance),
    calculated: calculatedBalance
  })
}
```

## 🔐 事务支持

所有WalletService方法都支持在外部事务中执行:

```typescript
import { prisma } from '@/lib/infrastructure/database/prisma'

// 在事务中执行多个操作
await prisma.$transaction(async (tx) => {
  // 确认收货,释放款项给卖家
  await walletService.credit({
    userId: order.sellerId,
    amount: order.price,
    type: 'RELEASE',
    orderId: order.id,
    note: '确认收货'
  }, tx)  // 传入事务客户端

  // 扣除平台手续费
  await walletService.debit({
    userId: order.sellerId,
    amount: platformFee,
    type: 'ADMIN_ADJUSTMENT',
    note: '平台手续费',
    performedBy: 'system'
  }, tx)
})
```

## 🎯 PaymentType 说明

```typescript
enum PaymentType {
  ESCROW            // 托管支付(买家付款到平台)
  RELEASE           // 释放款项(平台付款给卖家)
  REFUND            // 退款(平台退款给买家)
  WITHDRAW          // 提现
  ADMIN_ADJUSTMENT  // 管理员调账
}
```

## ⚠️ 错误码

```typescript
enum FinancialErrorCode {
  INSUFFICIENT_BALANCE      // 余额不足
  INVALID_AMOUNT            // 无效的金额（≤0）
  USER_NOT_FOUND            // 用户不存在
  WITHDRAWAL_NOT_FOUND      // 提现不存在
  INVALID_WITHDRAWAL_STATUS // 提现状态不正确
  TRANSACTION_FAILED        // 数据库事务失败
  VALIDATION_ERROR          // 参数验证失败
  INTERNAL_ERROR            // 内部错误
}
```

## 📊 测试覆盖

### WalletService 测试 (19个测试用例)

- ✅ credit() 成功场景
- ✅ credit() 参数验证（金额≤0, userId不存在）
- ✅ credit() 外部事务支持
- ✅ debit() 成功场景
- ✅ debit() 余额不足
- ✅ debit() WITHDRAW类型创建PENDING状态Payment
- ✅ adminAdjustBalance() 增加余额
- ✅ adminAdjustBalance() 扣除余额
- ✅ adminAdjustBalance() 拒绝空原因
- ✅ adminAdjustBalance() 审计日志记录
- ✅ refundWithdrawal() 成功退款
- ✅ refundWithdrawal() 拒绝不存在的提现
- ✅ refundWithdrawal() 拒绝状态不正确的提现
- ✅ getBalance() 成功查询
- ✅ getBalance() 拒绝不存在的用户
- ✅ 事务回滚（Payment创建失败）
- ✅ 事务回滚（余额更新失败）
- ✅ calculateBalanceFromPayments() 正确计算

### PaymentGateway 测试 (26个测试用例)

- ✅ createPayment() 成功创建
- ✅ createPayment() 自定义状态
- ✅ createPayment() 外部事务支持
- ✅ createPayment() 关联订单
- ✅ createPayment() 关联提现
- ✅ createPayment() 记录操作人
- ✅ updatePaymentStatus() 成功更新
- ✅ updatePaymentStatus() 外部事务支持
- ✅ updatePaymentStatusBatch() 批量更新
- ✅ getPaymentsByUser() 基础查询
- ✅ getPaymentsByUser() 按类型筛选
- ✅ getPaymentsByUser() 按多个类型筛选
- ✅ getPaymentsByUser() 按状态筛选
- ✅ getPaymentsByUser() 日期范围筛选
- ✅ getPaymentsByUser() 分页支持
- ✅ getPaymentsByUser() 包含关联数据
- ✅ getPaymentsByWithdrawal() 查询提现Payment
- ✅ getPaymentsByOrder() 查询订单Payment
- ✅ getPaymentById() 查询单个Payment
- ✅ getPaymentById() 不存在返回null
- ✅ calculateBalanceFromPayments() 正确计算
- ✅ calculateBalanceFromPayments() 只计算COMPLETED
- ✅ calculateBalanceFromPayments() 处理空列表
- ✅ calculateBalanceFromPayments() 处理ADMIN_ADJUSTMENT
- ✅ calculateBalanceFromPayments() 各种类型组合

## 🔧 开发建议

### 1. 使用WalletService而不是直接操作数据库

❌ **不推荐:**
```typescript
// 直接更新余额（不安全）
await prisma.user.update({
  where: { id: userId },
  data: { balance: { increment: amount } }
})

// 单独创建Payment（不同步）
await prisma.payment.create({
  data: { userId, amount, type: 'RELEASE' }
})
```

✅ **推荐:**
```typescript
// 使用WalletService确保原子性
await walletService.credit({
  userId,
  amount,
  type: 'RELEASE',
  note: '操作说明'
})
```

### 2. 总是提供清晰的note说明

```typescript
// ❌ 不好
await walletService.credit({
  userId,
  amount: 100,
  type: 'RELEASE',
  note: '释放'
})

// ✅ 好
await walletService.credit({
  userId,
  amount: 100,
  type: 'RELEASE',
  orderId: order.id,
  note: `订单 ${order.orderNo} 确认收货,释放款项给卖家`
})
```

### 3. 管理员操作必须提供performedBy

```typescript
// ✅ 管理员调账
await walletService.adminAdjustBalance({
  userId: 'user-123',
  amount: 100,
  isCredit: true,
  reason: '补偿用户损失',
  adminUserId: auth.userId  // 必须记录操作人
})
```

### 4. 在复杂业务中使用事务

```typescript
// ✅ 订单确认收货的完整流程
await prisma.$transaction(async (tx) => {
  // 1. 释放款项给卖家
  const releaseResult = await walletService.credit({
    userId: order.sellerId,
    amount: order.price,
    type: 'RELEASE',
    orderId: order.id,
    note: '确认收货'
  }, tx)

  // 2. 扣除平台手续费
  await walletService.debit({
    userId: order.sellerId,
    amount: platformFee,
    type: 'ADMIN_ADJUSTMENT',
    note: '平台手续费',
    performedBy: 'system'
  }, tx)

  // 3. 更新订单状态
  await tx.order.update({
    where: { id: order.id },
    data: { status: 'COMPLETED' }
  })
})
```

## 📚 相关文档

- [OpenSpec Proposal](../../../openspec/changes/refactor-financial-architecture/proposal.md) - 重构方案说明
- [Architecture Design](../../../openspec/changes/refactor-financial-architecture/design.md) - 技术架构设计
- [Implementation Tasks](../../../openspec/changes/refactor-financial-architecture/tasks.md) - 实施任务清单

## 🤝 贡献指南

在修改财务模块时,请确保:

1. ✅ 所有测试通过: `pnpm test src/lib/domain/finance`
2. ✅ 添加新功能时同步添加测试用例
3. ✅ 遵循现有的代码风格和命名规范
4. ✅ 更新相关文档

## 📝 License

MIT
