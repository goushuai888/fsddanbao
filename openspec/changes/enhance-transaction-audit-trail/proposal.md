# 增强账务记录审计追踪

## Why

当前用户账务记录API (`/api/user/transactions`) 不暴露关键的审计信息，这对于金额相关的操作来说是一个严重的透明度问题。

### 核心问题

1. **缺少操作人信息** (HIGH)
   - Payment模型有 `performedBy` 和 `performedByUser` 字段
   - API查询时未包含 `performedByUser` 关联
   - 用户看到余额变动，但不知道是谁操作的
   - 管理员调账、退款操作无法追溯

2. **缺少操作上下文** (HIGH)
   - Payment模型有 `metadata` 字段（包含调账原因、退款详情等）
   - Payment模型有 `note` 字段（操作说明）
   - API响应中未包含这些字段
   - 用户无法了解账务变动的详细原因

3. **缺少提现关联信息** (MEDIUM)
   - WITHDRAW/REFUND类型的Payment关联了Withdrawal记录
   - API查询时未包含 `withdrawal` 关联
   - 用户无法看到提现申请的详细信息（提现方式、状态、到账金额等）

4. **透明度和信任度问题** (BUSINESS)
   - 用户看到"-¥100 提现扣除"，但不知道是哪个提现申请
   - 用户看到"+¥50 管理员调账"，但不知道为什么调账
   - 缺少信息导致用户疑惑和不信任

### 当前实现状态

**数据库**：✅ 所有审计字段已存在
```prisma
model Payment {
  performedBy     String?       // 操作人ID
  performedByUser User?         // 操作人关联
  withdrawalId    String?       // 提现申请ID
  withdrawal      Withdrawal?   // 提现关联
  metadata        Json?         // 元数据
  note            String?       // 备注
}
```

**API**：❌ 查询时未包含这些字段和关联
```typescript
// 当前查询
const transactions = await prisma.payment.findMany({
  include: {
    order: { /* ... */ }
  }
  // ❌ 缺少 withdrawal 关联
  // ❌ 缺少 performedByUser 关联
  // ❌ metadata、note 虽然返回但前端未使用
})
```

**前端**：❌ 没有显示审计信息的UI

### 业务影响

| 操作类型 | 当前显示 | 缺失信息 | 用户影响 |
|---------|---------|---------|---------|
| 管理员调账 | "+¥100 管理员调账" | 操作人、调账原因 | ❌ 不知道谁调的、为什么 |
| 提现扣除 | "-¥500 提现扣除" | 提现方式、状态、手续费 | ❌ 不知道哪个提现申请 |
| 退款到账 | "+¥1000 退款到账" | 退款原因、关联订单 | ⚠️ 信息不完整 |

## What Changes

### 1. API 增强 (MODIFIED)

**文件**：`src/app/api/user/transactions/route.ts`

**修改内容**：
```typescript
// ✅ 修改后
const transactions = await prisma.payment.findMany({
  where,
  include: {
    order: {
      // 保持现有配置
    },
    // 新增: 提现关联
    withdrawal: {
      select: {
        id: true,
        withdrawMethod: true,
        status: true,
        amount: true,
        actualAmount: true,
        createdAt: true,
        completedAt: true
      }
    },
    // 新增: 操作人关联
    performedByUser: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    }
  }
  // metadata, note, performedBy 已在Payment模型中，无需额外配置
})
```

### 2. 前端展示增强 (MODIFIED)

**文件**：`src/app/transactions/page.tsx`

**新增功能**：
1. **管理员操作标识**
   - 如果 `performedBy` 不为空且 `performedByUser.role === 'ADMIN'`
   - 显示橙色/黄色徽章："管理员操作"
   - 显示操作人姓名

2. **操作备注显示**
   - 如果 `note` 存在，显示为灰色次要文本
   - 使用 `sanitizeText()` 清理内容（XSS防护）

3. **元数据显示**
   - 如果 `metadata` 存在且包含有用字段（如 `reason`）
   - 显示为折叠/展开详情
   - 示例：metadata.reason = "用户投诉补偿"

4. **提现详情显示**
   - 对于 `type === 'WITHDRAW'` 的记录
   - 如果 `withdrawal` 存在，显示：
     - 提现方式（银行卡/支付宝/微信）
     - 提现状态
     - 申请金额 vs 到账金额（显示手续费）
     - 申请时间和完成时间

### 3. 类型定义更新 (NEW)

**文件**：`src/types/index.ts` (如需要)

**新增接口**：
```typescript
export interface TransactionWithAudit {
  // ... 现有Payment字段
  performedBy: string | null
  metadata: any | null
  note: string | null
  withdrawalId: string | null

  // 新增关联对象
  withdrawal?: {
    id: string
    withdrawMethod: string
    status: string
    amount: number
    actualAmount: number
    createdAt: string
    completedAt: string | null
  }

  performedByUser?: {
    id: string
    name: string | null
    email: string
    role: string
  }
}
```

## Impact

### Affected Specs
- **Transaction API规范** (新建 `specs/transaction-api/spec.md`)
  - 7个新需求（操作人暴露、提现关联、元数据暴露等）
  - 性能要求、向后兼容性、安全性

### Affected Files

**修改文件** (约 150 行)：
- `src/app/api/user/transactions/route.ts` (~20行修改)
- `src/app/transactions/page.tsx` (~100行新增UI)
- `src/types/index.ts` (~30行新增类型定义，可选)

**无需修改**：
- 数据库schema - 所有字段已存在
- WalletService - 已正确记录审计信息
- 其他API端点

### Breaking Changes

**✅ 无破坏性变更**：
- 仅在API响应中添加新字段
- 前端渐进增强，旧字段保持不变
- 旧数据（缺少新字段）优雅处理

### Risk Assessment

**技术风险**：
- 🟢 **低** - 仅添加关联查询，不修改核心逻辑
- 🟢 **低** - 性能影响小（新增2个关联查询）
- 🟢 **低** - 向后兼容，旧数据不会崩溃

**安全风险**：
- 🟡 **中等** - 需要确保敏感信息不暴露
  - 缓解措施：前端使用 `sanitizeText()` 清理所有文本
  - 缓解措施：敏感 metadata 字段未来可在后端过滤

**业务风险**：
- 🟢 **低** - 仅增强显示，不影响现有功能
- 🟢 **低** - 用户体验提升，无负面影响

### Migration Path

**阶段1: API修改** (1小时)
1. 修改 Prisma 查询添加关联
2. 测试API响应格式
3. 验证性能影响

**阶段2: 前端开发** (2-3小时)
1. 设计UI组件（徽章、详情显示）
2. 实现渲染逻辑
3. 添加 sanitize 清理

**阶段3: 测试验证** (1小时)
1. 测试管理员调账记录显示
2. 测试提现记录显示
3. 测试旧数据兼容性
4. 测试性能（响应时间）

**阶段4: 文档更新** (0.5小时)
1. 更新 CLAUDE.md
2. 更新API文档（如有）
3. Git commit 归档

## Success Criteria

**功能验证**：
- ✅ API返回 `performedByUser` 信息（管理员操作时）
- ✅ API返回 `withdrawal` 详情（提现记录时）
- ✅ API返回 `metadata` 和 `note` 字段
- ✅ 前端显示管理员操作徽章
- ✅ 前端显示操作备注
- ✅ 前端显示提现详情（方式、状态、金额）

**数据验证**：
- ✅ 测试管理员调账记录（显示操作人和原因）
- ✅ 测试提现记录（显示提现申请详情）
- ✅ 测试退款记录（显示退款原因）
- ✅ 测试旧数据（无新字段时不崩溃）

**性能要求**：
- ✅ API响应时间增加 < 100ms
- ✅ 前端渲染性能无明显下降

**安全验证**：
- ✅ 所有文本内容使用 `sanitizeText()` 清理
- ✅ XSS攻击防护测试通过
- ✅ 敏感信息不暴露（如需要）

**用户体验**：
- ✅ 用户能清楚了解每笔账务的来源和原因
- ✅ 提现记录一目了然
- ✅ 管理员操作明确标识
