# Actions层 - 应用用例

## 职责
Actions层（应用层）编排业务流程，协调domain和infrastructure层完成用户用例。这一层应该：
- ✅ 实现具体的业务用例（UseCase）
- ✅ 编排领域对象和基础设施服务
- ✅ 处理事务边界
- ✅ 转换数据格式（DTO ↔ Domain Entity）

## 目录结构

```
actions/
└── orders/            # 订单相关用例
    ├── PayOrderUseCase.ts              # 支付订单
    ├── TransferOrderUseCase.ts         # 提交转移凭证
    ├── ConfirmOrderUseCase.ts          # 确认收货
    ├── CancelOrderUseCase.ts           # 取消订单
    ├── RequestRefundUseCase.ts         # 申请退款
    ├── ApproveRefundUseCase.ts         # 同意退款
    ├── RejectRefundUseCase.ts          # 拒绝退款
    ├── RequestRefundExtensionUseCase.ts # 申请延期
    └── CreateDisputeUseCase.ts         # 创建申诉
```

## 依赖规则

✅ **可以依赖**：
- domain/ - 领域层（业务规则、领域错误）
- infrastructure/ - 基础设施层（数据库、审计）
- repositories/ - 仓储接口
- utils/ - 工具函数

❌ **不可以依赖**：
- app/ - 路由层（防止循环依赖）

## 示例用法

```typescript
// ✅ 正确：在API路由中调用UseCase
import { PayOrderUseCase } from '@/lib/actions/orders/PayOrderUseCase'

// API路由只负责HTTP层的事情
export async function PATCH(request: NextRequest) {
  // 1. 认证检查
  const payload = verifyToken(token)

  // 2. 调用UseCase执行业务逻辑
  const useCase = new PayOrderUseCase()
  const result = await useCase.execute({
    orderId: params.id,
    userId: payload.userId
  })

  // 3. 返回HTTP响应
  return NextResponse.json({ success: true, data: result.order })
}
```

## UseCase模式

每个UseCase类遵循统一模式：

```typescript
export class SomeUseCase {
  // 输入参数接口
  interface ExecuteInput {
    orderId: string
    userId: string
    // ...其他参数
  }

  // 输出结果接口
  interface ExecuteResult {
    order: Order
    // ...其他返回值
  }

  // 执行方法
  async execute(input: ExecuteInput): Promise<ExecuteResult> {
    // 1. 参数验证
    // 2. 业务规则检查
    // 3. 数据库操作（事务）
    // 4. 审计日志
    // 5. 返回结果
  }
}
```

## 设计原则

1. **单一职责**：每个UseCase只完成一个用户用例
2. **薄层设计**：不包含业务规则，只编排调用
3. **事务管理**：在UseCase层管理数据库事务边界
4. **错误处理**：捕获并转换为DomainError
5. **审计追踪**：记录所有敏感操作

## Actions vs Domain

| 维度 | actions/ | domain/policies/ |
|-----|----------|------------------|
| 职责 | 用例编排 | 业务规则 |
| 内容 | 流程控制 | 规则和策略 |
| 依赖 | 可依赖多层 | 无依赖 |
| 测试 | 集成测试 | 单元测试 |
| 示例 | PayOrderUseCase | calculatePlatformFee() |

## 事务管理示例

```typescript
export class ConfirmOrderUseCase {
  async execute(input: ExecuteInput): Promise<ExecuteResult> {
    // ✅ 正确：使用Prisma事务确保原子性
    const result = await prisma.$transaction(async (tx) => {
      // 1. 更新订单状态
      const order = await tx.order.update({
        where: { id: input.orderId },
        data: { status: 'COMPLETED' }
      })

      // 2. 创建支付记录
      await tx.payment.create({
        data: {
          orderId: order.id,
          userId: order.sellerId,
          amount: order.price,
          type: 'RELEASE'
        }
      })

      // 3. 更新卖家余额
      await tx.user.update({
        where: { id: order.sellerId },
        data: { balance: { increment: releaseAmount } }
      })

      return order
    })

    // ✅ 正确：事务外记录审计日志（失败不影响业务）
    await logAudit({
      userId: input.userId,
      action: 'CONFIRM_ORDER',
      target: input.orderId
    })

    return { order: result }
  }
}
```

## 添加新UseCase的检查清单

在添加新UseCase之前，请确认：
- [ ] 这是一个完整的用户用例（如"支付订单"、"申请退款"）
- [ ] 不包含业务规则（规则应在domain/policies/）
- [ ] 使用事务保护关键操作
- [ ] 抛出DomainError而不是技术错误
- [ ] 记录审计日志（如果是敏感操作）
- [ ] 有完整的TypeScript类型定义
- [ ] 包含必要的权限检查

## 未来优化方向

1. **命令模式**：统一UseCase接口（Command/Handler模式）
2. **事件发布**：UseCase完成后发布领域事件
3. **CQRS分离**：查询和命令分离（Query vs Command）
4. **依赖注入**：通过构造函数注入依赖（更易测试）
