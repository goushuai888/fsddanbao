# Spec: 代码结构重构

## MODIFIED Requirements

### Requirement: Unified FormDialog component

The system SHALL consolidate duplicate FormDialog components into a single reusable component. The unified component MUST support both full-featured (multi-field) and simplified (single-field) modes to serve admin and order workflows.

#### Scenario: 合并admin和orders的FormDialog组件

**Given** 系统中存在两个FormDialog组件：
- `src/components/admin/FormDialog.tsx` (331行) - 功能完整，支持多字段、Zod验证
- `src/components/orders/dialogs/FormDialog.tsx` (109行) - 简化版，单textarea

**When** 开发者需要添加新的表单对话框

**Then** 应使用统一的`src/components/admin/FormDialog.tsx`
**And** 该组件支持两种模式：
  - **完整模式**：多字段、复杂验证（管理员使用）
  - **简化模式**：单字段、简单验证（订单操作使用）

**Implementation**:
```typescript
// src/components/admin/FormDialog.tsx
export interface FormDialogProps {
  // ... 现有props
  simpleMode?: boolean  // 新增：启用简化模式
  simplePlaceholder?: string
  simpleMinLength?: number
}

// 简化模式使用示例
<FormDialog
  simpleMode={true}
  simplePlaceholder="请填写退款原因..."
  simpleMinLength={5}
  onSubmit={(value) => handleRefund(value)}
/>
```

**Validation**:
```bash
# 验证只有一个FormDialog组件
find src/components -name "FormDialog.tsx" | wc -l  # 应输出 1

# 验证所有引用都更新
grep -r "orders/dialogs/FormDialog" src/ | wc -l  # 应输出 0
```

---

#### Scenario: 迁移orders/dialogs中的包装组件

**Given** `src/components/orders/dialogs/index.tsx`中定义了RefundDialog、RejectRefundDialog等包装组件

**When** 这些组件需要使用新的统一FormDialog

**Then** 应更新导入路径：
```typescript
// Before
import { FormDialog } from './FormDialog'

// After
import { FormDialog } from '@/components/admin/FormDialog'
```

**And** 使用简化模式调用：
```typescript
<FormDialog
  simpleMode={true}
  // ... 其他props
/>
```

**And** 保持包装组件的接口不变（对外API兼容）

**Validation**:
- 订单详情页的退款/拒绝/申诉对话框正常工作
- UI样式与之前一致
- 功能完全正常

---

### Requirement: Centralized configuration index

The system SHALL provide a centralized configuration index to simplify imports. All configuration modules MUST be re-exported through a single entry point at `src/lib/config/index.ts`.

#### Scenario: 创建统一配置索引文件

**Given** 配置分散在多个文件：
- `src/lib/constants/business-rules.ts`
- `src/lib/constants/confirm-config.ts`
- `src/lib/constants/refund-config.ts`
- `src/lib/constants/order-views.ts`

**When** 开发者需要导入配置

**Then** 应提供统一的导入路径：
```typescript
// Before (分散导入)
import { ORDER_RULES } from '@/lib/constants/business-rules'
import { CONFIRM_DEADLINE_CONFIG } from '@/lib/constants/confirm-config'

// After (统一导入)
import { ORDER_RULES, CONFIRM_DEADLINE_CONFIG } from '@/lib/config'
```

**Implementation**:
```typescript
// src/lib/config/index.ts (新建)
export * from '../constants/business-rules'
export * from '../constants/confirm-config'
export * from '../constants/refund-config'
export * from '../constants/order-views'

// 额外导出分类（可选）
export { ORDER_RULES, PAYMENT_RULES } from '../constants/business-rules'
export { CONFIRM_DEADLINE_CONFIG } from '../constants/confirm-config'
```

**Validation**:
```bash
# 验证新索引文件存在
test -f src/lib/config/index.ts && echo "✅ 配置索引存在"

# 验证可以从索引导入
grep -r "from '@/lib/config'" src/ | wc -l  # 应 > 0
```

---

#### Scenario: 保持向后兼容的导入路径

**Given** 大量现有代码使用旧的导入路径

**When** 创建新的统一配置索引

**Then** 旧的导入路径应继续工作（向后兼容）
**And** 新代码推荐使用统一路径
**And** 在文档中说明两种方式都支持

**Validation**:
```typescript
// 两种方式都应该work
import { ORDER_RULES } from '@/lib/constants/business-rules'  // ✅ 旧方式
import { ORDER_RULES } from '@/lib/config'  // ✅ 新方式（推荐）
```

---

## REMOVED Requirements

### Requirement: ~~完善DDD架构~~

**Priority**: ~~P2~~ (Cancelled)
**Capability**: code-structure-refactor
**Status**: Rejected

**Reason**: 经过评估，当前的薄UseCase层架构已经满足需求，引入完整DDD会增加复杂度而收益有限。

#### Decision: 保持当前架构模式

**Given** 系统已有`src/application/`和`src/domain/`层
**And** `src/infrastructure/`层已删除（空目录）

**When** 评估是否需要完整DDD架构

**Then** 决定**不引入**完整DDD，理由：
1. **复杂度**：完整DDD需要Repository、Entity、ValueObject等概念，学习曲线陡峭
2. **团队规模**：小团队不需要如此重的架构
3. **当前架构够用**：UseCase模式已提供足够的业务逻辑封装
4. **迁移成本**：从当前架构迁移到完整DDD需要重写大量代码

**Alternative**: 保持当前架构并改进命名
```
src/
├── app/              # Next.js路由和页面
├── components/       # React组件
├── lib/              # 工具函数和配置
├── use-cases/        # 业务逻辑（改名自application）
└── types/            # TypeScript类型
```

**Validation**:
- 在文档中明确说明架构模式：薄UseCase层 + Next.js App Router
- 更新`CLAUDE.md`和`openspec/project.md`
- 删除对"DDD"的误导性引用

---

## ADDED Requirements

### Requirement: Clean scripts directory

The project SHALL archive completed verification scripts and remove one-time fix scripts. The system MUST maintain a clean scripts directory with only actively used utilities.

#### Scenario: 归档已完成的测试脚本

**Given** 并发操作测试已完成验证
**And** `scripts/verify-concurrent-operations.ts`不再常用

**When** 清理项目文件

**Then** 应将该文件移动到`scripts/archive/`目录
**And** 在archive目录添加README说明文件用途
**And** 保留供未来参考

**Implementation**:
```bash
mkdir -p scripts/archive
mv scripts/verify-concurrent-operations.ts scripts/archive/

# 创建说明文件
cat > scripts/archive/README.md <<EOF
# 归档脚本

本目录存放已完成使命但保留供参考的脚本。

## verify-concurrent-operations.ts
- 用途：测试订单操作的并发保护
- 状态：已验证通过（2025-10-18）
- 保留原因：未来添加新操作时可参考
EOF
```

**Validation**:
```bash
test -f scripts/archive/verify-concurrent-operations.ts && echo "✅ 已归档"
test -f scripts/archive/README.md && echo "✅ 说明文件已创建"
```

---

#### Scenario: 删除一次性修复脚本

**Given** `scripts/fix-missing-confirm-deadline.ts`是一次性修复脚本
**And** 该脚本已在生产环境执行完成

**When** 清理项目文件

**Then** 应删除该文件
**And** 在git commit中说明删除原因
**And** 保留功能逻辑在业务代码中（自动修复逻辑）

**Implementation**:
```bash
rm scripts/fix-missing-confirm-deadline.ts

git commit -m "chore: 删除一次性修复脚本

fix-missing-confirm-deadline.ts已完成使命：
- 功能：修复缺失confirmDeadline的TRANSFERRING订单
- 执行时间：2025-10-18
- 结果：所有订单已修复
- 保留：自动修复逻辑已集成到API路由中
"
```

**Validation**:
```bash
test ! -f scripts/fix-missing-confirm-deadline.ts && echo "✅ 已删除"
```

---

#### Scenario: 处理TODO注释

**Given** 代码中存在TODO注释
**And** `src/lib/constants/business-rules.ts:228`有待处理的TODO

**When** 清理代码

**Then** 对每个TODO进行评估：
1. **可实现**：创建Issue跟踪
2. **不实现**：删除TODO并添加说明
3. **未决定**：转为FIXME并说明原因

**For `business-rules.ts:228`**:
```typescript
// Before
// TODO: 实际生产环境应从数据库读取

// After (决定不实现)
/**
 * 硬编码配置 - 适用于当前业务规模
 *
 * 如需动态配置，建议实现：
 * 1. 创建SystemConfig表
 * 2. 添加管理界面修改配置
 * 3. 使用缓存避免频繁查询数据库
 */
```

**Validation**:
```bash
# 搜索所有TODO
grep -rn "TODO" src/

# 验证是否都已处理（允许有明确计划的TODO）
```

---

## Cross-References

### Related Capabilities
- **transaction-fee-fix**: 手续费配置统一（共享business-rules.ts）

### Affected Components
- `src/components/admin/FormDialog.tsx` - 扩展支持简化模式
- `src/components/orders/dialogs/` - 更新导入路径或删除
- `src/lib/config/index.ts` - 新建统一配置索引
- `scripts/archive/` - 新建归档目录
- `CLAUDE.md` - 更新架构说明

### Migration Path
1. **Phase 1**: FormDialog统一（向后兼容）
2. **Phase 2**: 配置文件索引（旧路径仍可用）
3. **Phase 3**: 脚本归档和清理（无风险）
4. **Phase 4**: TODO处理（文档更新）

### Backward Compatibility
- ✅ **FormDialog**: 旧组件可以逐步迁移
- ✅ **配置导入**: 两种路径都支持
- ✅ **脚本删除**: 不影响运行时
- ✅ **TODO清理**: 仅文档变更
