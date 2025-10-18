# 订单业务逻辑审查清单

**审查日期**: 2025-10-18
**审查人**: AI Code Review (Multi-Agent)
**审查范围**: 订单状态流转的所有操作（8个action）

---

## ✅ 审查结果汇总

| 操作 | 状态要求 | 权限要求 | 业务逻辑 | 并发保护 | 审查结果 |
|------|---------|---------|---------|---------|---------|
| **pay** | PUBLISHED | 任何买家 | ✅ 正确 | ✅ 乐观锁 | ✅ **通过** |
| **transfer** | PAID | 仅卖家 | ⚠️ **需检查** | ✅ 乐观锁 | ⚠️ **有疑问** |
| **confirm** | TRANSFERRING | 仅买家 | ✅ 正确 | ✅ 事务+乐观锁 | ✅ **通过** |
| **cancel** | PUBLISHED/PAID | 视状态 | ❌ **严重错误** | ✅ 事务+乐观锁 | ❌ **已修复** |
| **request_refund** | PAID | 仅买家 | ✅ 正确 | ✅ 乐观锁 | ✅ **通过** |
| **approve_refund** | PAID+退款申请 | 仅卖家 | ✅ 正确 | ✅ 事务+乐观锁 | ✅ **通过** |
| **reject_refund** | PAID+退款申请 | 仅卖家 | ✅ 正确 | ✅ 乐观锁 | ✅ **通过** |
| **create_dispute** | TRANSFERRING/PAID | 仅买家 | ✅ 正确 | ✅ 事务+乐观锁 | ✅ **通过** |

---

## 🔍 详细审查

### 1. pay（买家支付）✅

**期望行为**:
- PUBLISHED → PAID
- 创建托管支付记录
- 设置 buyerId, paidAt, escrowAmount

**权限检查**:
- ✅ 状态检查: `order.status !== 'PUBLISHED'`
- ✅ 任何买家都可以支付（无需额外权限检查）

**业务逻辑**:
- ✅ 使用事务保证订单更新和支付记录创建的原子性
- ✅ 使用乐观锁防止并发购买

**潜在问题**:
- ⚠️ **卖家自己购买**: 没有检查 `payload.userId !== order.sellerId`
  - 影响: 卖家可以购买自己的订单（虽然没有实际意义）
  - 建议: 添加检查，禁止卖家购买自己的订单

**修复建议**:
```typescript
// 在 pay 操作中添加:
if (order.sellerId === payload.userId) {
  return NextResponse.json({
    error: '卖家不能购买自己的订单'
  }, { status: 403 })
}
```

---

### 2. transfer（卖家提交转移凭证）⚠️

**期望行为**:
- PAID → TRANSFERRING
- 保存 transferProof, transferNote, transferredAt

**权限检查**:
- ✅ 状态检查: `order.status !== 'PAID'`
- ✅ 权限检查: `order.sellerId !== payload.userId`

**业务逻辑**:
- ✅ 使用乐观锁防止并发操作

**潜在问题**:
- ⚠️ **退款申请中仍可提交转移凭证**:
  - 当前逻辑: 即使买家已申请退款(`refundRequested = true`)，卖家仍可提交转移凭证
  - 影响: 买家申请退款后，卖家可以通过提交转移凭证来"对抗"退款申请
  - 建议: 如果有退款申请，禁止提交转移凭证

**修复建议**:
```typescript
// 在 transfer 操作中添加:
if (order.refundRequested) {
  return NextResponse.json({
    error: '买家已申请退款，请先处理退款申请'
  }, { status: 400 })
}
```

---

### 3. confirm（买家确认收货）✅

**期望行为**:
- TRANSFERRING → COMPLETED
- 创建释放款项记录
- 更新卖家余额

**权限检查**:
- ✅ 状态检查: `order.status !== 'TRANSFERRING'`
- ✅ 权限检查: `order.buyerId !== payload.userId`

**业务逻辑**:
- ✅ 使用事务+乐观锁保证订单完成、款项释放、余额更新的原子性
- ✅ 正确计算卖家应得金额（扣除平台手续费）

**无潜在问题** ✅

---

### 4. cancel（取消订单）❌ → ✅

**期望行为**:
- PUBLISHED状态: 卖家可以取消（删除订单）
- PAID状态: ~~卖家可以取消~~ → **已修复: 禁止直接取消**

**权限检查（修复前）**:
- ❌ `if (!['PUBLISHED', 'PAID'].includes(order.status))` - 允许PAID状态
- ❌ `if (order.status === 'PAID' && order.sellerId !== payload.userId)` - 卖家可以取消PAID订单

**权限检查（修复后）**:
- ✅ `if (order.status === 'PAID')` - **完全禁止PAID状态cancel操作**
- ✅ `if (order.status === 'PUBLISHED' && order.sellerId !== payload.userId)` - 只有卖家可以取消

**业务逻辑**:
- ✅ 使用事务+乐观锁保证取消和退款的原子性

**修复内容**:
- ✅ **API路由**: 禁止PAID状态的cancel操作
- ✅ **前端UI**: 移除PAID状态卖家的"取消订单"按钮

**正确流程**:
```
PAID状态下:
- 买家想取消 → 申请退款 (request_refund) → 卖家同意 (approve_refund)
- 卖家想取消 → ❌ 不能直接取消 → 应该等待买家申请退款或主动联系买家
```

---

### 5. request_refund（买家申请退款）✅

**期望行为**:
- PAID状态设置退款申请标记
- 计算响应截止时间
- refundRequested = true, refundStatus = 'PENDING'

**权限检查**:
- ✅ 状态检查: `order.status !== 'PAID'`
- ✅ 权限检查: `order.buyerId !== payload.userId`
- ✅ 重复检查: `order.refundRequested`

**业务逻辑**:
- ✅ 使用乐观锁防止重复申请
- ✅ 自动计算响应截止时间（认证卖家24h，普通卖家48h）

**无潜在问题** ✅

---

### 6. approve_refund（卖家同意退款）✅

**期望行为**:
- PAID → CANCELLED
- 创建退款记录
- 更新买家余额
- refundStatus = 'APPROVED'

**权限检查**:
- ✅ 权限检查: `order.sellerId !== payload.userId`
- ✅ 状态检查: `!order.refundRequested || order.refundStatus !== 'PENDING'`

**业务逻辑**:
- ✅ 使用事务+乐观锁保证订单取消、退款记录、余额更新的原子性

**无潜在问题** ✅

---

### 7. reject_refund（卖家拒绝退款）✅

**期望行为**:
- 设置 refundStatus = 'REJECTED'
- 记录拒绝理由和时间

**权限检查**:
- ✅ 权限检查: `order.sellerId !== payload.userId`
- ✅ 状态检查: `!order.refundRequested || order.refundStatus !== 'PENDING'`
- ✅ 输入验证: `!body.reason || body.reason.trim() === ''`

**业务逻辑**:
- ✅ 使用乐观锁防止并发操作
- ✅ 强制要求填写拒绝理由

**无潜在问题** ✅

---

### 8. create_dispute（买家发起申诉）✅

**期望行为**:
- TRANSFERRING → DISPUTE（未收到货）
- PAID → DISPUTE（退款被拒后申请平台介入）
- 创建申诉记录

**权限检查**:
- ✅ 状态检查: `order.status !== 'TRANSFERRING' && order.status !== 'PAID'`
- ✅ PAID状态必须是退款被拒: `order.refundStatus !== 'REJECTED'`
- ✅ 权限检查: `order.buyerId !== payload.userId`

**业务逻辑**:
- ✅ 使用事务+乐观锁保证申诉创建和状态更新的原子性
- ✅ 完整记录申诉上下文（退款原因、拒绝理由、买家诉求）

**无潜在问题** ✅

---

## 🔴 发现的严重问题

### 问题1: PAID状态卖家可以直接取消订单（CVSS 9.1）❌ → ✅ 已修复

**修复前**:
```typescript
// ❌ 错误代码
if (order.status === 'PAID' && order.sellerId !== payload.userId) {
  return NextResponse.json({ error: '已付款订单只有卖家可以取消' })  // 卖家可以取消!
}
```

**修复后**:
```typescript
// ✅ 正确代码
if (order.status === 'PAID') {
  return NextResponse.json({
    error: '已付款订单不能直接取消。买家可以申请退款，卖家可以同意或拒绝退款申请。'
  }, { status: 400 })
}
```

**影响**:
- 破坏担保交易的核心原则
- 卖家可以在收款后单方面取消，损害买家权益
- 平台信誉受损

---

## ⚠️ 中等问题

### 问题2: PAID状态有退款申请时，卖家仍可提交转移凭证 ⚠️

**当前逻辑**:
```typescript
case 'transfer':
  if (order.status !== 'PAID') { return error }
  if (order.sellerId !== payload.userId) { return error }
  // ⚠️ 没有检查 order.refundRequested
```

**场景**:
1. 买家付款后发现问题，申请退款
2. 卖家不同意退款，却提交了转移凭证
3. 订单状态变为TRANSFERRING，退款申请被"绕过"

**建议修复**:
```typescript
case 'transfer':
  // ...
  if (order.refundRequested) {
    return NextResponse.json({
      error: '买家已申请退款，请先处理退款申请再提交转移凭证'
    }, { status: 400 })
  }
```

---

### 问题3: 卖家可以购买自己的订单 ℹ️

**当前逻辑**:
```typescript
case 'pay':
  if (order.status !== 'PUBLISHED') { return error }
  // ℹ️ 没有检查 payload.userId !== order.sellerId
```

**影响**:
- 卖家可以购买自己的订单（虽然没有实际意义）
- 可能用于刷单或测试

**建议修复**:
```typescript
case 'pay':
  // ...
  if (order.sellerId === payload.userId) {
    return NextResponse.json({
      error: '卖家不能购买自己的订单'
    }, { status: 403 })
  }
```

---

## 📋 修复优先级

| 问题 | 严重程度 | 修复状态 | 优先级 |
|------|---------|---------|--------|
| PAID状态卖家直接取消 | 🚨 CRITICAL | ✅ **已修复** | P0 |
| PAID+退款申请时可提交转移凭证 | ⚠️ HIGH | ⏳ **待修复** | P1 |
| 卖家购买自己的订单 | ℹ️ MEDIUM | ⏳ **待修复** | P2 |

---

## ✅ 修复计划

### P0: 立即修复（已完成）✅
- [x] 禁止PAID状态的cancel操作（API路由）
- [x] 移除PAID状态卖家的取消按钮（前端UI）
- [x] 创建业务逻辑错误审查报告

### P1: 短期修复（建议本次一起修复）
- [ ] 禁止PAID+退款申请状态提交转移凭证
- [ ] 更新前端UI，退款申请中隐藏"提交转移凭证"按钮

### P2: 长期优化
- [ ] 禁止卖家购买自己的订单
- [ ] 添加更完善的状态机验证
- [ ] 添加业务逻辑单元测试

---

## 🧪 测试建议

### 关键测试场景

**场景1: PAID状态卖家尝试取消**
```
Given: 订单状态为PAID（买家已付款）
When: 卖家点击"取消订单"按钮
Then:
  - API返回400错误: "已付款订单不能直接取消"
  - 前端UI不显示"取消订单"按钮
```

**场景2: PAID+退款申请时卖家提交转移凭证**
```
Given: 订单状态为PAID，买家已申请退款
When: 卖家提交转移凭证
Then:
  - API返回400错误: "买家已申请退款，请先处理退款申请"
  - 前端UI隐藏"提交转移凭证"按钮
```

**场景3: 卖家购买自己的订单**
```
Given: 卖家发布了订单（PUBLISHED状态）
When: 卖家点击"立即购买"
Then:
  - API返回403错误: "卖家不能购买自己的订单"
  - 前端UI不显示"立即购买"按钮（如果是自己的订单）
```

---

## 📝 相关文档

- `docs/BUSINESS_LOGIC_ERRORS.md` - 详细错误报告
- `CLAUDE.md` - 订单状态流转说明
- `SECURITY_VERIFICATION_REPORT.md` - 安全验证报告
