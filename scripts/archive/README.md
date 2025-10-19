# 归档测试脚本

这个目录存放已完成其使命但保留作为参考的测试脚本。

## 归档原则

脚本会被归档（而非删除）如果满足以下条件之一：
- ✅ 测试已完成，功能已验证通过
- ✅ 脚本可能在未来作为参考使用
- ✅ 包含有价值的测试模式或方法
- ✅ 可能需要重新运行以验证回归

脚本会被删除（不归档）如果：
- ❌ 一次性修复脚本，已执行完毕
- ❌ 临时调试代码
- ❌ 已被更好的脚本替代

## 归档脚本列表

### verify-concurrent-operations.ts
**归档日期**: 2025-10-19
**用途**: 验证订单操作的并发保护机制
**状态**: ✅ 测试完成，功能已验证
**说明**:
- 测试多个买家同时购买订单的并发保护
- 验证乐观锁机制正常工作
- 已被 `verify-optimistic-lock.ts` 替代，但保留作为参考

**如何运行**:
```bash
DATABASE_URL="postgresql://..." npx tsx scripts/archive/verify-concurrent-operations.ts
```

---

## 活跃测试脚本（在 scripts/ 目录）

### verify-transactions.ts
事务完整性测试 - 验证支付、确认、取消、退款的原子性

### verify-optimistic-lock.ts
乐观锁测试 - 验证并发购买保护机制

### verify-platform-fee-calculation.ts
手续费计算测试 - 验证平台手续费正确扣除（2025-10-19新增）

### create-admin.ts
管理员账户创建工具
