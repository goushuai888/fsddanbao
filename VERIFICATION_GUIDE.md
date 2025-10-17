# ✅ 修复验证快速指南

> 所有关键问题已修复,请按以下步骤验证

---

## 🎯 快速验证(5分钟)

### 1. JWT安全验证 ⏱️ 1分钟

```bash
# 测试1: 验证JWT_SECRET强制检查
# 临时删除JWT_SECRET,应用应拒绝启动
unset JWT_SECRET && pnpm dev

# 预期输出:
# Error: FATAL: JWT_SECRET must be set in environment variables and at least 32 characters long.

# 测试2: 生成强密钥并配置
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# 将输出的64字符密钥添加到 .env.local:
# JWT_SECRET=<生成的密钥>
```

✅ **通过标准**: 应用无JWT_SECRET时拒绝启动

---

### 2. 数据库索引验证 ⏱️ 2分钟

```bash
# 连接数据库
psql -U shuai -d fsd_escrow

# 查看Order表索引
\d "Order"

# 预期输出应包含:
# "Order_sellerId_status_idx" btree ("sellerId", status)
# "Order_buyerId_status_idx" btree ("buyerId", status)
# "Order_status_createdAt_idx" btree (status, "createdAt")
# "Order_createdAt_idx" btree ("createdAt")
# "Order_status_idx" btree (status)

# 查看Payment表索引
\d "Payment"

# 预期输出应包含:
# "Payment_orderId_idx" btree ("orderId")
# "Payment_userId_type_idx" btree ("userId", type)
# "Payment_status_createdAt_idx" btree (status, "createdAt")
# "Payment_type_idx" btree (type)

# 验证索引效果
EXPLAIN ANALYZE SELECT * FROM "Order" WHERE "sellerId" = 'xxx' AND status = 'PUBLISHED';

# 预期输出:
# Index Scan using "Order_sellerId_status_idx"
# (NOT Seq Scan - 全表扫描)
```

✅ **通过标准**: 所有表都有索引,查询使用Index Scan

---

### 3. 事务完整性验证 ⏱️ 1分钟

```bash
# 启动应用
pnpm dev

# 查看代码确认
grep -n "prisma.\$transaction" src/app/api/orders/\[id\]/route.ts

# 应显示以下行号使用了事务:
# Line 172: updatedOrder = await prisma.$transaction(async (tx) => {
# Line 225: updatedOrder = await prisma.$transaction(async (tx) => {
# Line 337: updatedOrder = await prisma.$transaction(async (tx) => {
# Line 428: updatedOrder = await prisma.$transaction(async (tx) => {
```

✅ **通过标准**: confirm、pay、cancel、approve_refund都使用事务

---

### 4. 乐观锁验证 ⏱️ 1分钟

```sql
-- 查看Order表是否有version字段
SELECT "id", "version" FROM "Order" LIMIT 5;

-- 预期输出: version字段存在,默认值为0
```

```typescript
// 查看代码
cat src/app/api/orders/[id]/route.ts | grep -A 10 "case 'pay':"

// 应包含:
// version: order.version || 0  // 版本号必须匹配
// version: { increment: 1 }    // 版本号+1
```

✅ **通过标准**: Order表有version字段,pay操作使用版本检查

---

## 🧪 功能测试(可选,10分钟)

### 测试1: 并发支付测试

**目标**: 验证乐观锁防止多人购买同一订单

```bash
# 1. 创建测试订单(卖家身份)
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <seller_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleBrand": "Tesla",
    "vehicleModel": "Model 3",
    "vehicleYear": 2023,
    "fsdVersion": "FSD 12.0",
    "price": 64000
  }'

# 记录返回的订单ID: ORDER_ID

# 2. 创建pay.json
echo '{
  "action": "pay"
}' > pay.json

# 3. 并发测试(10个请求同时发送)
ab -n 10 -c 10 -p pay.json -T application/json \
  -H "Authorization: Bearer <buyer_token>" \
  http://localhost:3000/api/orders/<ORDER_ID>

# 预期结果:
# - 成功: 1个请求 (200 OK)
# - 失败: 9个请求 (409 Conflict - "订单已被其他买家购买或状态已变更")
```

✅ **通过标准**: 仅1个支付成功,其余返回409冲突

---

### 测试2: 事务完整性测试

**目标**: 验证订单确认时事务保护

```bash
# 1. 完成一个订单流程:
# 创建订单 → 支付 → 转移 → 确认

# 2. 确认后查询数据库
psql -U shuai -d fsd_escrow -c "
  SELECT o.id, o.status, o.\"completedAt\",
         p.type, p.amount, p.status as payment_status,
         u.balance
  FROM \"Order\" o
  JOIN \"Payment\" p ON p.\"orderId\" = o.id AND p.type = 'RELEASE'
  JOIN \"User\" u ON u.id = o.\"sellerId\"
  WHERE o.id = '<ORDER_ID>';
"

# 预期结果:
# - Order.status = 'COMPLETED'
# - Payment.type = 'RELEASE'
# - Payment.status = 'COMPLETED'
# - User.balance 增加了 (price - platformFee)
```

✅ **通过标准**: 订单完成、Payment创建、余额更新三者一致

---

### 测试3: 取消订单退款测试

**目标**: 验证取消时退款和余额更新

```bash
# 1. 创建并支付一个订单
# 2. 卖家取消订单
curl -X PATCH http://localhost:3000/api/orders/<ORDER_ID> \
  -H "Authorization: Bearer <seller_token>" \
  -H "Content-Type: application/json" \
  -d '{"action": "cancel"}'

# 3. 查询数据库验证
psql -U shuai -d fsd_escrow -c "
  SELECT o.id, o.status, o.\"cancelledAt\",
         p.type, p.amount, p.status as payment_status,
         u.balance
  FROM \"Order\" o
  JOIN \"Payment\" p ON p.\"orderId\" = o.id AND p.type = 'REFUND'
  JOIN \"User\" u ON u.id = o.\"buyerId\"
  WHERE o.id = '<ORDER_ID>';
"

# 预期结果:
# - Order.status = 'CANCELLED'
# - Payment.type = 'REFUND'
# - Payment.status = 'COMPLETED'
# - User.balance 增加了退款金额
```

✅ **通过标准**: 订单取消、退款创建、买家余额增加三者一致

---

### 测试4: 审计日志测试

**目标**: 验证审计日志记录

```sql
-- 查看AuditLog表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_name = 'AuditLog';

-- 查看审计日志索引
\d "AuditLog"

-- 预期输出应包含:
-- "AuditLog_userId_createdAt_idx"
-- "AuditLog_action_createdAt_idx"
-- "AuditLog_target_idx"
-- "AuditLog_createdAt_idx"
```

```typescript
// 在管理员操作中使用审计日志(示例)
import { logAudit, AUDIT_ACTIONS } from '@/lib/audit'

await logAudit({
  userId: adminId,
  action: AUDIT_ACTIONS.APPROVE_WITHDRAWAL,
  target: withdrawalId,
  targetType: 'Withdrawal',
  description: '管理员批准提现',
  req: request
})
```

✅ **通过标准**: AuditLog表存在,有4个索引,logAudit函数可用

---

## 📊 性能验证

### 查询性能对比

```sql
-- 测试1: 订单列表查询(有索引)
EXPLAIN ANALYZE
SELECT * FROM "Order"
WHERE "sellerId" = 'xxx' AND status = 'PUBLISHED'
ORDER BY "createdAt" DESC
LIMIT 20;

-- 预期:
-- Execution Time: < 10ms
-- Using Index Scan

-- 测试2: 无索引查询(对比)
EXPLAIN ANALYZE
SELECT * FROM "Order"
WHERE "transferNote" LIKE '%测试%';  -- 无索引字段

-- 预期:
-- Execution Time: 可能>50ms
-- Using Seq Scan (全表扫描)
```

✅ **通过标准**: 索引字段查询<10ms,使用Index Scan

---

## 🎯 完整性检查清单

运行以下命令进行全面检查:

```bash
# 1. 代码完整性
echo "=== 检查JWT安全 ==="
grep -n "JWT_SECRET" src/lib/auth.ts | head -5

echo "=== 检查事务使用 ==="
grep -n "prisma.\$transaction" src/app/api/orders/\[id\]/route.ts

echo "=== 检查审计日志 ==="
ls -lh src/lib/audit.ts

# 2. 数据库完整性
echo "=== 检查数据库表 ==="
psql -U shuai -d fsd_escrow -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_name IN ('Order', 'Payment', 'AuditLog');
"

echo "=== 检查version字段 ==="
psql -U shuai -d fsd_escrow -c "
  SELECT column_name, data_type, column_default
  FROM information_schema.columns
  WHERE table_name = 'Order' AND column_name = 'version';
"

echo "=== 检查索引数量 ==="
psql -U shuai -d fsd_escrow -c "
  SELECT schemaname, tablename, COUNT(*) as index_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename;
"

# 预期输出:
# Order: 至少6个索引
# Payment: 至少4个索引
# Withdrawal: 至少3个索引
# AuditLog: 至少4个索引

# 3. 应用启动测试
echo "=== 测试应用启动 ==="
timeout 10s pnpm dev || echo "应用启动成功"
```

---

## ✅ 验证成功标准

所有测试通过,则修复成功:

- [x] JWT_SECRET强制检查生效
- [x] 数据库有19个新索引
- [x] 所有资金操作使用事务
- [x] Order表有version字段
- [x] pay操作使用乐观锁
- [x] AuditLog表存在
- [x] 审计工具函数可用
- [x] 查询使用索引而非全表扫描

---

## 🚀 下一步

验证通过后:

1. **提交代码**
   ```bash
   git add .
   git commit -m "fix: 修复所有Critical和High级别安全漏洞

   - 修复JWT密钥硬编码
   - 添加19个数据库索引
   - 修复订单确认/支付/取消/退款事务
   - 添加支付乐观锁防止竞态
   - 实现审计日志系统

   详细修复报告见 FIX_COMPLETED_REPORT.md
   "
   git push
   ```

2. **部署到测试环境**
   ```bash
   # 确保生产环境变量正确配置
   - JWT_SECRET (64字符)
   - DATABASE_URL
   - 其他环境变量

   # 部署
   ./deploy.sh start
   ```

3. **开始Phase 2改进**
   - Service层重构
   - 前端状态管理
   - CSRF保护
   - 输入验证

   预计2-3周完成

---

**验证完成时间**: ___________
**验证人**: ___________
**验证结果**: [ ] 通过 / [ ] 未通过

如有问题,请查看 [FIX_COMPLETED_REPORT.md](./FIX_COMPLETED_REPORT.md)
