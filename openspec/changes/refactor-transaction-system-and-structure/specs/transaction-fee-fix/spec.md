# Spec: 交易手续费计算修复

## MODIFIED Requirements

### Requirement: Single source of truth for platform fee configuration

The system SHALL ensure all platform fee configurations and calculations come from a single source of truth to prevent financial discrepancies. All fee-related code MUST reference the centralized configuration in `business-rules.ts`.

#### Scenario: 删除重复的手续费常量定义

**Given** 系统中存在两处手续费率定义：
- `src/lib/constants/business-rules.ts` - `PLATFORM_FEE_RATE: 0.03`
- `src/lib/validations/order.ts` - `export const PLATFORM_FEE_RATE = 0.03`

**When** 开发者需要修改手续费率

**Then** 只需修改`business-rules.ts`一处即可生效
**And** 所有引用该常量的代码自动使用新值
**And** TypeScript编译器防止使用旧路径导入

**Validation**:
```bash
# 验证只有一处定义
grep -r "export.*PLATFORM_FEE_RATE" src/ | wc -l  # 应输出 1

# 验证所有引用都指向正确位置
grep -r "from.*business-rules.*PLATFORM_FEE_RATE" src/ | wc -l  # 应 > 0
grep -r "from.*validations/order.*PLATFORM_FEE_RATE" src/ | wc -l  # 应 = 0
```

---

#### Scenario: 删除重复的手续费计算函数

**Given** 系统中存在两处手续费计算逻辑：
- `src/lib/validations/order.ts` - `calculatePlatformFee()`
- 可能在其他文件中也有内联计算

**When** 需要计算平台手续费

**Then** 必须调用统一的`calculatePlatformFee()`函数
**And** 该函数来自`src/lib/constants/business-rules.ts`
**And** 函数内部使用`PLATFORM_FEE_RATE`常量

**Validation**:
```typescript
// business-rules.ts应导出此函数
export function calculatePlatformFee(price: number): number {
  return Math.round(price * ORDER_RULES.FEES.PLATFORM_FEE_RATE * 100) / 100
}

// 测试用例
expect(calculatePlatformFee(100)).toBe(3.00)
expect(calculatePlatformFee(99.99)).toBe(3.00)  // 四舍五入
expect(calculatePlatformFee(1)).toBe(0.03)
```

---

### Requirement: Dynamic platform fee calculation in order confirmation

The order confirmation process MUST recalculate platform fees using the centralized `calculatePlatformFee()` function. The system SHALL NOT rely on the potentially null `order.platformFee` field.

#### Scenario: 修复ConfirmOrderUseCase中的手续费计算Bug

**Given** 订单状态为`TRANSFERRING`
**And** 买家点击"确认收货"
**And** 订单的`platformFee`字段可能为`null`（旧数据）

**When** `ConfirmOrderUseCase.execute()`执行到计算释放金额

**Then** 必须调用`calculatePlatformFee(order.price)`重新计算手续费
**And** 不能依赖`order.platformFee`字段（可能不存在）
**And** 释放金额 = 订单价格 - 重新计算的手续费

**Current Bug**:
```typescript
// ❌ 错误：依赖可能为null的字段
const releaseAmount = Number(order.price) - (Number(order.platformFee) || 0)
// 如果platformFee为null，会使用||0，导致不扣手续费！
```

**Fixed Logic**:
```typescript
// ✅ 正确：重新计算手续费
const platformFee = calculatePlatformFee(Number(order.price))
const releaseAmount = Number(order.price) - platformFee
```

**Validation**:
```bash
# 测试场景：确认收货正确扣除手续费
# 创建测试订单: price=100
# 确认收货后验证:
#   - Payment记录的amount应为97（100 - 3%）
#   - 卖家余额增加97
```

---

#### Scenario: 记录手续费计算日志（可观测性）

**Given** 确认收货操作执行
**And** 手续费已计算

**When** 释放款项给卖家

**Then** 应记录日志包含：
- 订单ID
- 订单价格
- 计算的手续费
- 释放金额
- 时间戳

**And** 日志级别为`info`

**Validation**:
```typescript
console.log(`[ConfirmOrder] orderId=${orderId} price=${order.price} fee=${platformFee} release=${releaseAmount}`)
```

---

### Requirement: Persisted platformFee field in orders

The system MUST calculate and persist the `platformFee` field when creating orders. The persisted value SHALL be available for data integrity validation in downstream processes.

#### Scenario: POST /api/orders创建订单时设置platformFee

**Given** 卖家填写订单表单
**And** 订单价格为`price`（Decimal类型）

**When** 提交创建订单请求

**Then** 后端必须计算`platformFee = calculatePlatformFee(price)`
**And** 将`platformFee`保存到订单记录
**And** 返回的订单对象包含`platformFee`字段

**Current Code**:
```typescript
// src/app/api/orders/route.ts:259
const platformFee = calculatePlatformFee(priceDecimal)  // ✅ 已计算
// ❌ 但未保存到订单！
```

**Fixed Logic**:
```typescript
const order = await prisma.order.create({
  data: {
    // ... 其他字段
    price: priceDecimal,
    platformFee: calculatePlatformFee(priceDecimal),  // ✅ 保存到数据库
    // ...
  }
})
```

**Validation**:
```sql
-- 验证新订单有platformFee
SELECT id, price, "platformFee"
FROM "Order"
WHERE "createdAt" > NOW() - INTERVAL '1 hour'
AND "platformFee" IS NULL;  -- 应返回空结果
```

---

#### Scenario: 数据库Schema验证platformFee字段

**Given** Prisma schema定义

**When** 订单状态为`PAID`或更高

**Then** `platformFee`字段应为必填（非null）
**And** 字段类型为`Decimal(10, 2)`
**And** 值必须 >= 0

**Schema Change** (可选，用于数据完整性):
```prisma
model Order {
  // ...
  platformFee  Decimal?  @db.Decimal(10, 2)  // 当前：可选
  // 建议：添加应用层验证，在PAID状态必须有值
}
```

**Application Validation**:
```typescript
// 在PayOrderUseCase中验证
if (!order.platformFee) {
  throw new Error('Order platformFee not set')
}
```

---

## ADDED Requirements

### Requirement: Dedicated test script for platform fee calculations

The system SHALL provide a dedicated test script to verify platform fee calculation accuracy and consistency across all scenarios. The test script MUST validate order creation, confirmation, UI display, and edge cases.

#### Scenario: 创建verify-platform-fee-calculation.ts测试脚本

**Given** 测试环境数据库连接

**When** 运行测试脚本

**Then** 应验证以下场景：
1. **订单创建**：platformFee字段正确设置
2. **确认收货**：手续费正确扣除
3. **UI显示**：前端计算与后端一致
4. **边界情况**：极小/极大金额的手续费计算

**Test Cases**:
```typescript
// 测试1：订单创建
const order = await createTestOrder({ price: 100 })
expect(order.platformFee).toBe(3.00)

// 测试2：确认收货
await confirmOrder(order.id)
const payment = await getLatestPayment(order.id, 'RELEASE')
expect(payment.amount).toBe(97.00)

// 测试3：UI一致性
const uiFee = calculatePlatformFee(100)  // 前端函数
const apiFee = order.platformFee          // 后端数据
expect(uiFee).toBe(apiFee)

// 测试4：边界情况
expect(calculatePlatformFee(0.01)).toBe(0.00)  // 最小金额
expect(calculatePlatformFee(999999.99)).toBe(29999.99)  // 最大金额（3%）
```

**Validation**:
```bash
DATABASE_URL="..." npx tsx scripts/verify-platform-fee-calculation.ts
# 输出: ✅ 4/4 测试通过 (100%)
```

---

## Cross-References

### Related Capabilities
- **code-structure-refactor**: FormDialog统一和配置文件合并
- **data-integrity**: 数据库字段验证和约束

### Affected Components
- `src/lib/constants/business-rules.ts` - 单一数据源
- `src/lib/validations/order.ts` - 删除重复定义
- `src/application/use-cases/orders/ConfirmOrderUseCase.ts` - 修复计算逻辑
- `src/app/api/orders/route.ts` - 创建订单时保存platformFee
- `src/components/orders/PriceSummary.tsx` - UI显示（引用路径更新）

### Migration Path
1. **Phase 1**: 修复ConfirmOrderUseCase（最高优先级，防止资金损失）
2. **Phase 2**: 统一配置文件（防止未来不一致）
3. **Phase 3**: 订单创建时保存platformFee（数据完整性）
4. **Phase 4**: 添加测试和验证（质量保证）

### Backward Compatibility
- ✅ **现有订单**：platformFee可能为null，ConfirmOrderUseCase会重新计算
- ✅ **新订单**：platformFee始终有值
- ❌ **API变更**：无（内部实现变更）
- ❌ **数据库迁移**：不需要（platformFee字段已存在且可选）
