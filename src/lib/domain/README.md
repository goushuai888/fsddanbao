# Domain层 - 领域逻辑

## 职责
领域层包含核心业务规则和领域知识，是系统的核心。这一层应该：
- ✅ 独立于技术实现细节
- ✅ 包含业务规则和策略
- ✅ 定义领域错误和异常
- ✅ 不依赖任何外部层

## 目录结构

```
domain/
├── policies/           # 业务策略和规则
│   ├── business-rules.ts   # 核心业务规则（手续费、价格限制等）
│   ├── confirm-config.ts   # 确认收货期限策略
│   ├── refund-config.ts    # 退款响应期限策略
│   ├── order-status.ts     # 订单状态定义
│   ├── order-views.ts      # 订单视图配置
│   └── order.ts            # 订单验证规则
├── events/            # 领域事件（未来扩展）
└── DomainErrors.ts    # 领域错误定义
```

## 依赖规则

✅ **可以依赖**：
- 无依赖（领域层是最底层）

❌ **不可以依赖**：
- actions/ - 应用层
- infrastructure/ - 基础设施层
- utils/ - 工具层
- 任何外部库（除了标准库）

## 示例用法

```typescript
// ✅ 正确：从domain/policies导入业务规则
import { ORDER_RULES, calculatePlatformFee } from '@/lib/domain/policies/business-rules'
import { DomainError, OrderNotFoundError } from '@/lib/domain/DomainErrors'

// ✅ 正确：定义领域错误
if (!order) {
  throw new OrderNotFoundError('订单不存在')
}

// ✅ 正确：使用业务规则
const fee = calculatePlatformFee(orderPrice)
```

## 设计原则

1. **单一职责**：每个策略文件只负责一个业务领域
2. **不可变性**：所有配置使用 `as const` 确保不可变
3. **类型安全**：导出完整的TypeScript类型定义
4. **纯函数**：策略函数应该是纯函数，无副作用
5. **业务语言**：使用业务领域的术语命名

## 未来扩展

- **events/**: 领域事件用于解耦不同聚合根
- **aggregates/**: 聚合根定义（如果需要完整DDD）
- **value-objects/**: 值对象定义（如果需要完整DDD）
