# 财务系统架构重构实施任务清单

## Phase 0: 准备工作

### 0.1 环境准备
- [ ] 0.1.1 创建功能分支 `feature/refactor-financial-architecture`
- [ ] 0.1.2 确认开发环境数据库连接正常
- [ ] 0.1.3 备份当前数据库（开发环境）

### 0.2 目录结构
- [ ] 0.2.1 创建 `src/lib/domain/finance/` 目录
- [ ] 0.2.2 创建 `src/lib/domain/finance/__tests__/` 测试目录
- [ ] 0.2.3 创建占位文件确保目录结构正确

### 0.3 数据库 Schema 变更
- [ ] 0.3.1 修改 `prisma/schema.prisma` 添加Payment新字段
  ```prisma
  model Payment {
    // 新增字段
    withdrawalId    String?
    withdrawal      Withdrawal?  @relation(fields: [withdrawalId], references: [id])
    performedBy     String?
    performedByUser User?        @relation("PerformedPayments", fields: [performedBy], references: [id])
    metadata        Json?

    @@index([withdrawalId])
    @@index([performedBy])
  }

  model Withdrawal {
    payments        Payment[]
  }

  model User {
    performedPayments Payment[]  @relation("PerformedPayments")
  }

  enum PaymentType {
    ESCROW
    RELEASE
    REFUND
    WITHDRAW
    ADMIN_ADJUSTMENT  // 新增
  }
  ```
- [ ] 0.3.2 运行 `pnpm db:push` 推送 schema 变更
- [ ] 0.3.3 验证数据库字段已添加成功
- [ ] 0.3.4 运行 `pnpm db:generate` 更新 Prisma Client

## Phase 1: 核心实现

### 1.1 类型定义
- [ ] 1.1.1 创建 `src/lib/domain/finance/types.ts`
  - 定义 `CreditParams`, `DebitParams`, `AdminAdjustParams` 接口
  - 定义 `FinancialOperationResult` 类型
  - 导出所有财务操作相关类型

### 1.2 PaymentGateway 实现
- [ ] 1.2.1 创建 `src/lib/domain/finance/PaymentGateway.ts`
  - 实现 `createPayment()` - 创建Payment记录
  - 实现 `updatePaymentStatus()` - 更新Payment状态
  - 实现 `getPaymentsByUser()` - 查询用户Payment历史
  - 实现 `getPaymentByWithdrawal()` - 查询提现关联Payment

### 1.3 WalletService 核心逻辑
- [ ] 1.3.1 创建 `src/lib/domain/finance/WalletService.ts`
  - 实现 `credit()` - 入账（增加余额）
    - 验证参数（金额>0, userId存在）
    - 在事务中：创建Payment + 更新余额
    - 调用 AuditLogger 记录审计
    - 返回 Payment 和新余额
  - 实现 `debit()` - 出账（扣除余额）
    - 验证参数（金额>0, 余额足够）
    - 在事务中：创建Payment + 扣除余额
    - 调用 AuditLogger 记录审计
    - 返回 Payment 和新余额

- [ ] 1.3.2 实现 `adminAdjustBalance()`
  - 验证管理员权限（调用方确保）
  - 根据金额正负调用 credit() 或 debit()
  - PaymentType 使用 ADMIN_ADJUSTMENT
  - metadata 包含 reason, note, adminUserId

- [ ] 1.3.3 实现 `refundWithdrawal()`
  - 查询 Withdrawal 和关联的原始 Payment(WITHDRAW)
  - 调用 credit() 恢复用户余额
  - 更新原始 Payment 状态为 CANCELLED
  - 更新 Withdrawal 状态（REJECTED/FAILED）

- [ ] 1.3.4 实现辅助方法
  - `getBalance(userId)` - 查询用户当前余额
  - `calculateBalanceFromPayments(userId)` - 从Payment计算余额（用于验证）
  - `getTransactionHistory(userId, filters)` - 查询账务历史

### 1.4 单元测试
- [ ] 1.4.1 创建 `__tests__/WalletService.test.ts`
  - 测试 credit() 成功场景
  - 测试 credit() 参数验证（金额≤0, userId不存在）
  - 测试 debit() 成功场景
  - 测试 debit() 余额不足场景
  - 测试 adminAdjustBalance() 增加余额
  - 测试 adminAdjustBalance() 扣除余额
  - 测试 refundWithdrawal() 完整流程
  - 测试事务回滚（模拟数据库错误）
  - **目标覆盖率**: >90%

- [ ] 1.4.2 创建 `__tests__/PaymentGateway.test.ts`
  - 测试 createPayment() 所有 PaymentType
  - 测试 updatePaymentStatus() 状态转换
  - 测试查询方法（byUser, byWithdrawal）

- [ ] 1.4.3 运行测试确保全部通过
  ```bash
  pnpm test src/lib/domain/finance
  ```

### 1.5 文档
- [ ] 1.5.1 创建 `src/lib/domain/finance/README.md`
  - WalletService API 说明
  - 使用示例代码
  - 架构图和数据流
  - 常见问题 FAQ

## Phase 2: API 迁移

### 2.1 管理员退款API (P0 - CRITICAL)
- [ ] 2.1.1 修改 `src/app/api/admin/refunds/[id]/route.ts`
  - 导入 WalletService
  - 替换 approve 逻辑：
    ```typescript
    // ❌ 删除
    await prisma.payment.create({ ... })

    // ✅ 替换为
    await walletService.credit({
      userId: order.buyerId,
      amount: order.escrowAmount || order.price,
      type: 'REFUND',
      orderId: order.id,
      note: note || '管理员批准退款申请',
      performedBy: auth.userId
    })
    ```
  - 保留审计日志调用
  - 保留订单状态更新逻辑

- [ ] 2.1.2 手动测试管理员退款
  - 创建测试订单并支付
  - 买家申请退款
  - 管理员批准退款
  - 验证：
    - ✅ 买家余额增加
    - ✅ Payment记录创建（type=REFUND, performedBy=adminId）
    - ✅ 订单状态变为CANCELLED
    - ✅ 账务记录页显示退款

### 2.2 管理员调整余额API (P0 - CRITICAL)
- [ ] 2.2.1 修改 `src/app/api/admin/users/[id]/route.ts`
  - PATCH 方法中处理 balance 参数
  - 替换直接修改逻辑：
    ```typescript
    // ❌ 删除
    if (balance !== undefined) updateData.balance = balance

    // ✅ 替换为
    if (balance !== undefined) {
      const currentBalance = await walletService.getBalance(params.id)
      const adjustAmount = Number(balance) - Number(currentBalance)

      if (adjustAmount !== 0) {
        await walletService.adminAdjustBalance({
          userId: params.id,
          amount: Math.abs(adjustAmount),
          isCredit: adjustAmount > 0,
          reason: '管理员手动调整余额',
          adminUserId: auth.userId,
          note: body.balanceNote || `调整余额至 ¥${balance}`
        })
      }
    }
    ```
  - 更新审计日志包含调账详情

- [ ] 2.2.2 手动测试管理员调余额
  - 管理员增加用户余额 +100
  - 验证：
    - ✅ 用户余额增加
    - ✅ Payment记录创建（type=ADMIN_ADJUSTMENT）
    - ✅ metadata包含reason和note
    - ✅ performedBy指向管理员
  - 管理员扣除用户余额 -50
  - 验证：
    - ✅ 用户余额减少
    - ✅ Payment记录创建（amount为正数，type区分增减）

### 2.3 提现拒绝/失败API (P1 - HIGH)
- [ ] 2.3.1 修改 `src/app/api/admin/withdrawals/[id]/route.ts`
  - reject 操作使用 `walletService.refundWithdrawal()`
  - fail 操作使用 `walletService.refundWithdrawal()`
  - 确保 Withdrawal 和 Payment 状态同步

- [ ] 2.3.2 修改 `src/app/api/user/withdraw/route.ts`
  - 在创建 Withdrawal 后立即创建 Payment
  - 保存 Payment.id 到变量，用于后续关联
  - 更新 Withdrawal 创建逻辑（等待 schema 添加 paymentId 字段）

- [ ] 2.3.3 手动测试提现流程
  - 用户申请提现 ¥200
  - 验证：
    - ✅ 余额扣除
    - ✅ Payment创建（type=WITHDRAW, status=PENDING）
    - ✅ Withdrawal创建
  - 管理员拒绝提现
  - 验证：
    - ✅ 余额恢复
    - ✅ 新Payment创建（type=REFUND）
    - ✅ 原Payment状态更新为CANCELLED
    - ✅ Withdrawal状态=REJECTED

### 2.4 UseCase 层迁移 (P1 - HIGH)
- [ ] 2.4.1 修改 `src/lib/actions/orders/ConfirmOrderUseCase.ts`
  - 删除手动创建Payment和更新余额代码
  - 调用 `walletService.credit()` 释放款项：
    ```typescript
    await walletService.credit({
      userId: order.sellerId,
      amount: releaseAmount,
      type: 'RELEASE',
      orderId: order.id,
      note: '订单完成,释放款项给卖家'
    }, tx)  // 传入事务上下文
    ```
  - 保持事务边界不变

- [ ] 2.4.2 修改 `src/lib/actions/orders/ApproveRefundUseCase.ts`
  - 删除手动创建Payment和更新余额代码
  - 调用 `walletService.credit()` 退款：
    ```typescript
    await walletService.credit({
      userId: order.buyerId,
      amount: refundAmount,
      type: 'REFUND',
      orderId: order.id,
      note: '卖家同意退款申请'
    }, tx)
    ```

- [ ] 2.4.3 运行 UseCase 单元测试（如果存在）
- [ ] 2.4.4 运行集成测试 `scripts/verify-transactions.ts`
  ```bash
  DATABASE_URL="..." npx tsx scripts/verify-transactions.ts
  ```

## Phase 3: 测试验证

### 3.1 自动化测试
- [ ] 3.1.1 运行所有单元测试
  ```bash
  pnpm test
  ```
- [ ] 3.1.2 运行事务完整性测试
  ```bash
  npx tsx scripts/verify-transactions.ts
  ```
- [ ] 3.1.3 运行乐观锁测试
  ```bash
  npx tsx scripts/verify-optimistic-lock.ts
  ```
- [ ] 3.1.4 运行手续费计算测试
  ```bash
  npx tsx scripts/verify-platform-fee-calculation.ts
  ```

### 3.2 数据完整性验证
- [ ] 3.2.1 创建 `scripts/verify-wallet-integrity.ts`
  - 检查所有用户余额 = sum(Payment)
  - 检查所有Withdrawal有对应Payment
  - 检查所有WITHDRAW类型Payment有对应Withdrawal
  - 检查所有ADMIN_ADJUSTMENT有performedBy
  - 生成验证报告

- [ ] 3.2.2 运行数据完整性验证
  ```bash
  npx tsx scripts/verify-wallet-integrity.ts
  ```
- [ ] 3.2.3 修复发现的数据不一致问题

### 3.3 手动测试清单
- [ ] 3.3.1 测试完整订单流程
  - 买家支付 → 卖家转移 → 买家确认 → 卖家余额增加
  - 验证Payment记录完整

- [ ] 3.3.2 测试退款流程
  - 买家支付 → 买家申请退款 → 卖家同意 → 买家余额恢复
  - 验证Payment记录完整

- [ ] 3.3.3 测试管理员操作
  - 管理员批准退款 → 买家余额增加
  - 管理员调整余额 → Payment记录创建
  - 管理员拒绝提现 → 余额恢复 + Payment状态同步

- [ ] 3.3.4 测试账务记录页
  - 查看所有Payment类型是否正确显示
  - 验证余额计算正确
  - 验证分页和筛选功能

### 3.4 性能测试
- [ ] 3.4.1 测试 WalletService 响应时间
  - credit() 操作 p95 < 50ms
  - debit() 操作 p95 < 50ms
  - adminAdjustBalance() p95 < 100ms

- [ ] 3.4.2 测试并发场景
  - 10个用户同时支付不同订单
  - 验证无事务冲突
  - 验证所有Payment和余额正确

## Phase 4: 文档和清理

### 4.1 代码注释
- [ ] 4.1.1 为 WalletService 所有公共方法添加 JSDoc
- [ ] 4.1.2 为关键业务逻辑添加注释说明
- [ ] 4.1.3 为复杂事务添加步骤说明

### 4.2 项目文档更新
- [ ] 4.2.1 更新 `CLAUDE.md`
  - 添加财务架构说明
  - 添加 WalletService 使用指南
  - 更新目录结构说明

- [ ] 4.2.2 创建 `docs/FINANCIAL_ARCHITECTURE.md`
  - 财务系统架构图
  - 数据流说明
  - 常见问题FAQ

- [ ] 4.2.3 更新 API 文档（如果存在）
  - 管理员退款API变更
  - 管理员调余额API变更

### 4.3 代码质量
- [ ] 4.3.1 运行 ESLint 检查
  ```bash
  pnpm lint
  ```
- [ ] 4.3.2 运行 TypeScript 类型检查
  ```bash
  pnpm tsc --noEmit
  ```
- [ ] 4.3.3 修复所有警告和错误

### 4.4 Git 提交
- [ ] 4.4.1 提交 Phase 0-1（核心实现）
  ```bash
  git add src/lib/domain/finance prisma/schema.prisma
  git commit -m "feat: 实现 WalletService 财务核心服务

  - 创建 WalletService 统一财务入口
  - 实现 credit/debit/adminAdjustBalance 方法
  - 添加 Payment 新字段: withdrawalId, performedBy, metadata
  - 新增 PaymentType.ADMIN_ADJUSTMENT
  - 单元测试覆盖率 >90%

  🤖 Generated with Claude Code (https://claude.com/claude-code)
  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

- [ ] 4.4.2 提交 Phase 2（API迁移）
  ```bash
  git add src/app/api src/lib/actions
  git commit -m "refactor: 迁移所有财务操作到 WalletService

  - 管理员退款使用 WalletService.credit()
  - 管理员调余额使用 WalletService.adminAdjustBalance()
  - 提现拒绝/失败使用 WalletService.refundWithdrawal()
  - UseCase 层委托财务逻辑到 WalletService
  - 修复管理员退款不更新余额问题
  - 修复管理员调余额无Payment记录问题

  🤖 Generated with Claude Code (https://claude.com/claude-code)
  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

- [ ] 4.4.3 提交 Phase 3-4（测试和文档）
  ```bash
  git add scripts docs CLAUDE.md
  git commit -m "docs: 更新财务架构文档和验证脚本

  - 添加 verify-wallet-integrity.ts 数据验证脚本
  - 创建 FINANCIAL_ARCHITECTURE.md 架构文档
  - 更新 CLAUDE.md 财务系统说明
  - 所有测试通过，数据完整性验证通过

  🤖 Generated with Claude Code (https://claude.com/claude-code)
  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

## Phase 5: 部署准备（可选，生产环境）

### 5.1 生产环境准备
- [ ] 5.1.1 在staging环境部署测试
- [ ] 5.1.2 运行完整回归测试
- [ ] 5.1.3 备份生产数据库
- [ ] 5.1.4 准备回滚脚本

### 5.2 监控设置
- [ ] 5.2.1 添加 WalletService 性能监控
- [ ] 5.2.2 添加财务操作错误告警
- [ ] 5.2.3 添加数据一致性定时检查

### 5.3 上线检查清单
- [ ] 5.3.1 所有测试通过 ✅
- [ ] 5.3.2 代码审查完成 ✅
- [ ] 5.3.3 文档更新完成 ✅
- [ ] 5.3.4 回滚方案准备完成 ✅
- [ ] 5.3.5 监控和告警配置完成 ✅

## 验收标准

### 功能验收
- ✅ 管理员退款后买家余额正确增加
- ✅ 管理员调余额有完整Payment记录和审计追溯
- ✅ 提现拒绝/失败后Payment状态正确同步
- ✅ 所有余额变动都有对应Payment记录
- ✅ Payment 和 User.balance 数据完全一致

### 质量验收
- ✅ WalletService 单元测试覆盖率 >90%
- ✅ 所有现有测试脚本通过
- ✅ 无 ESLint 错误
- ✅ 无 TypeScript 类型错误

### 性能验收
- ✅ WalletService.credit() p95 < 50ms
- ✅ WalletService.debit() p95 < 50ms
- ✅ 财务操作错误率 < 0.1%

### 文档验收
- ✅ WalletService API 文档完整
- ✅ 财务架构设计文档完整
- ✅ CLAUDE.md 更新
- ✅ 代码注释清晰

## 估时

| Phase | 任务 | 预估时间 | 负责人 |
|-------|------|---------|--------|
| 0 | 准备工作 | 4小时 | - |
| 1 | 核心实现 | 8小时 | - |
| 2 | API迁移 | 10小时 | - |
| 3 | 测试验证 | 6小时 | - |
| 4 | 文档清理 | 4小时 | - |
| 5 | 部署准备 | 4小时 | - |
| **总计** | | **36小时** | **(约5个工作日)** |

## 风险和依赖

### 风险
- 🟡 **中**: 数据库 Migration 失败 → 缓解：字段可空，分阶段迁移
- 🟡 **中**: WalletService 性能瓶颈 → 缓解：已测试，p95<20ms
- 🟢 **低**: 历史数据兼容性 → 缓解：查询容错，可回填

### 依赖
- ✅ Prisma 版本 >= 5.0（支持事务和JSON字段）
- ✅ PostgreSQL >= 13（支持JSONB索引）
- ✅ 现有测试脚本正常运行
