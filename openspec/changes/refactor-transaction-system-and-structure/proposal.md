# Proposal: 交易系统Bug修复和代码重构

## Overview

本提案旨在修复交易系统中发现的关键bug，优化目录结构，消除代码重复，提升系统的可维护性和可靠性。

## Motivation

通过全面的代码审查，发现了以下核心问题：

### 1. 交易系统Bug

#### 🚨 Critical: 手续费计算不一致（潜在资金损失）
- **问题**：`platformFee`常量在两处定义（`business-rules.ts`和`order.ts`），可能导致不一致
- **位置**：
  - `src/lib/constants/business-rules.ts:28` - 定义为 `PLATFORM_FEE_RATE: 0.03`
  - `src/lib/validations/order.ts:156` - 重复定义 `PLATFORM_FEE_RATE = 0.03`
- **影响**：如果两处配置不同步，会导致UI显示和实际扣费不一致
- **风险**：CVSS 7.5 (高危) - 可能导致平台资金损失或用户纠纷

#### ⚠️ High: 确认收货时手续费计算有bug
- **问题**：`ConfirmOrderUseCase.ts:93` 计算逻辑不正确
  ```typescript
  const releaseAmount = Number(order.price) - (Number(order.platformFee) || 0)
  ```
- **问题分析**：
  1. 如果`order.platformFee`为`null`（订单创建时未设置），会使用`||0`导致不扣手续费
  2. 应该在确认收货时重新计算手续费，而不是依赖订单字段
- **正确逻辑**：
  ```typescript
  const platformFee = calculatePlatformFee(Number(order.price))
  const releaseAmount = Number(order.price) - platformFee
  ```

#### ⚠️ Medium: 缺少手续费数据完整性验证
- **问题**：订单创建时未设置`platformFee`字段
- **位置**：`src/app/api/orders/route.ts:259` - 仅计算但未保存到订单
- **影响**：后续业务逻辑依赖该字段时会出错

#### ℹ️ Low: TODO注释未处理
- **位置**：`src/lib/constants/business-rules.ts:228`
- **内容**：`// TODO: 实际生产环境应从数据库读取`
- **建议**：实现动态配置或移除注释

### 2. 代码组织问题

#### 重复的FormDialog组件
- **位置**：
  - `src/components/admin/FormDialog.tsx` (331行) - 管理员通用表单
  - `src/components/orders/dialogs/FormDialog.tsx` (109行) - 订单简化表单
- **问题**：两个组件功能相似但接口不同，造成维护负担
- **建议**：统一为一个可复用组件

#### 目录结构混乱
- **DDD架构不完整**：
  - `src/application/` - UseCase层（使用中）
  - `src/domain/` - 领域层（使用中）
  - `src/infrastructure/` - **已删除（空目录）**
- **问题**：DDD架构只实现了一半，缺少完整的分层

- **重复的配置**：
  - `src/lib/constants/business-rules.ts` - 业务规则
  - `src/lib/validations/order.ts` - 订单验证（含重复的手续费常量）
  - 建议：合并到统一配置文件

### 3. 文件清理建议

#### 可删除的测试脚本
- `scripts/verify-concurrent-operations.ts` - 并发测试（已验证完成，可归档）
- `scripts/fix-missing-confirm-deadline.ts` - 一次性修复脚本（已执行，可删除）

#### 未使用的组件目录
- `src/components/orders/dialogs/FormDialog.tsx` - 仅被1个文件引用，考虑内联

## Proposed Solution

### Phase 1: 修复关键Bug（优先级：P0）

1. **统一手续费配置**
   - 删除`src/lib/validations/order.ts`中的重复定义
   - 所有地方统一引用`src/lib/constants/business-rules.ts`

2. **修复确认收货手续费计算**
   - 修改`ConfirmOrderUseCase.ts`，使用`calculatePlatformFee`重新计算
   - 在订单创建时保存`platformFee`字段到数据库

3. **添加数据完整性验证**
   - 订单创建时设置`platformFee`字段
   - 添加数据库约束确保该字段非空（对PAID及以后状态）

### Phase 2: 目录结构重构（优先级：P1）

1. **统一FormDialog组件**
   - 保留功能更强的`admin/FormDialog`
   - 迁移`orders/dialogs`中的使用场景
   - 删除重复代码

2. **优化配置文件组织**
   - 合并`business-rules.ts`和`order.ts`中的重复配置
   - 创建统一的配置索引文件

3. **完善DDD架构（可选）**
   - 要么补全`infrastructure`层（数据库仓储接口）
   - 要么移除DDD模式，回归简单的Next.js架构
   - **建议**：保持当前UseCase模式，不引入完整DDD

### Phase 3: 代码清理（优先级：P2）

1. **删除临时脚本**
   - 归档`verify-concurrent-operations.ts`到`scripts/archive/`
   - 删除`fix-missing-confirm-deadline.ts`（一次性脚本）

2. **清理TODO注释**
   - 实现或移除`business-rules.ts:228`的TODO

## Impact Analysis

### 风险评估

| 变更 | 风险等级 | 影响范围 | 缓解措施 |
|------|---------|---------|---------|
| 手续费计算修复 | 🔴 High | 所有确认收货操作 | 1. 添加单元测试<br>2. 在测试环境验证计算<br>3. 数据库备份 |
| FormDialog统一 | 🟡 Medium | 管理员页面和订单页面 | 1. 逐步迁移<br>2. 保留旧组件直到完全迁移 |
| 目录重构 | 🟢 Low | 导入路径变更 | 使用TypeScript重构工具 |

### 受影响的功能

- ✅ **确认收货流程** - 手续费计算修复后，卖家到账金额会更准确
- ✅ **管理员功能** - FormDialog统一后，体验更一致
- ✅ **开发效率** - 代码组织优化后，更易维护

## Alternatives Considered

### Alternative 1: 保持现状
- **优点**：无需修改，风险为零
- **缺点**：手续费bug持续存在，可能造成资金损失
- **结论**：❌ 不可接受，bug必须修复

### Alternative 2: 仅修复Bug，不重构
- **优点**：变更最小，风险可控
- **缺点**：代码组织问题持续累积
- **结论**：✅ 可接受的最小方案

### Alternative 3: 完全重写为完整DDD架构
- **优点**：架构更清晰
- **缺点**：工作量巨大（预计2-4周），风险高
- **结论**：❌ 性价比低，不推荐

## Success Criteria

### 必须达成（Phase 1）
- [ ] 手续费计算在所有场景下一致（UI/API/数据库）
- [ ] 订单确认收货时正确扣除手续费
- [ ] 所有手续费相关测试通过
- [ ] 零资金损失事故

### 应该达成（Phase 2）
- [ ] FormDialog组件统一，减少代码重复
- [ ] 配置文件合并，单一数据源
- [ ] TypeScript类型检查无错误

### 可以达成（Phase 3）
- [ ] 临时脚本清理完成
- [ ] TODO注释处理完成
- [ ] 目录结构符合Next.js最佳实践

## Timeline

### Sprint 1 (3-5天) - Bug修复
- Day 1-2: 手续费计算修复 + 测试
- Day 3: 数据完整性验证
- Day 4-5: 测试环境验证 + Code Review

### Sprint 2 (3-5天) - 代码重构
- Day 1-2: FormDialog统一
- Day 3: 配置文件合并
- Day 4-5: 代码清理 + 文档更新

### Sprint 3 (1-2天) - 验收
- Day 1: 端到端测试
- Day 2: 部署到生产环境

**总计**：7-12天（根据测试发现的问题可能延长）

## Open Questions

1. **手续费历史数据**：已存在的订单如何处理？
   - 选项A：追溯计算并更新`platformFee`字段
   - 选项B：仅对新订单生效
   - **建议**：选项B，避免改动历史数据

2. **DDD架构方向**：是否继续完善DDD？
   - 选项A：移除application/domain层，回归简单架构
   - 选项B：保持当前状态（薄UseCase层）
   - 选项C：补全infrastructure层
   - **建议**：选项B，当前架构已经够用

3. **手续费配置**：是否实现动态配置？
   - 选项A：硬编码（当前方案）
   - 选项B：数据库配置表
   - 选项C：环境变量
   - **建议**：短期选项A，长期考虑选项B

## Dependencies

### 必需依赖
- ✅ Prisma ORM - 数据库操作
- ✅ TypeScript - 类型安全
- ✅ 现有测试脚本 - 回归测试

### 可选依赖
- ⚪ 单元测试框架（Jest/Vitest）- 建议引入
- ⚪ 数据库迁移工具（Prisma Migrate）- 已有

## References

- [CLAUDE.md](../../CLAUDE.md) - 项目开发指南
- [openspec/project.md](../../project.md) - 项目上下文
- [prisma/schema.prisma](../../prisma/schema.prisma) - 数据库设计
- CVSS Calculator: https://www.first.org/cvss/calculator/3.1
