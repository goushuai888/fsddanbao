# lib/ 架构规则和指南

## 架构概览

本项目采用**轻量级DDD（Domain-Driven Design）+ 薄UseCase层**架构，清晰分层、职责明确。

```
src/lib/
├── domain/              # 领域层 - 核心业务规则
│   ├── policies/       # 业务策略和规则
│   ├── events/         # 领域事件（未来）
│   └── DomainErrors.ts # 领域错误
│
├── actions/            # 应用层 - 用例编排
│   └── orders/         # 订单相关用例
│
├── infrastructure/     # 基础设施层 - 技术实现
│   ├── database/       # 数据库访问
│   ├── auth/           # 认证授权
│   ├── middleware/     # 中间件
│   ├── security/       # 安全防护
│   └── audit/          # 审计日志
│
├── utils/              # 工具层 - 纯函数
│   ├── formatters/     # 格式化工具
│   ├── validators/     # 验证工具
│   └── helpers/        # 通用辅助
│
├── services/           # 服务层 - 外部适配器
│   └── timeline/       # 时间线服务
│
├── repositories/       # 仓储层 - 数据访问接口
├── errors/             # 错误定义（遗留，建议使用domain/DomainErrors）
├── validations/        # Zod验证schemas
└── config/             # 配置管理
```

## 依赖规则（核心）

### 依赖方向图

```
┌─────────────────────────────────────┐
│         app/ (路由层)                │
└────────────┬────────────────────────┘
             │
             ↓
┌─────────────────────────────────────┐
│      actions/ (应用层)               │  ← 编排业务流程
└────┬────────┬────────────────────────┘
     │        │
     ↓        ↓
┌────────┐  ┌──────────────────────────┐
│domain/ │  │  infrastructure/         │
│(领域层)│  │  (基础设施层)              │
└────────┘  └─────────┬────────────────┘
     ↑               │
     │               ↓
     │      ┌──────────────────┐
     └──────│   utils/ (工具)   │
            └──────────────────┘
```

### 允许的依赖关系

✅ **app/** 可以依赖:
- actions/ (调用UseCase)
- infrastructure/ (认证、限流)
- utils/ (工具函数)
- domain/ (类型定义)

✅ **actions/** 可以依赖:
- domain/ (业务规则、错误)
- infrastructure/ (数据库、审计)
- repositories/ (数据访问)
- services/ (外部服务)
- utils/ (工具函数)

✅ **infrastructure/** 可以依赖:
- domain/ (领域错误)
- utils/ (工具函数)

✅ **services/** 可以依赖:
- domain/ (领域实体)
- infrastructure/database/ (数据访问)
- utils/ (工具函数)

✅ **domain/** 可以依赖:
- 无依赖（领域层是最底层）

✅ **utils/** 可以依赖:
- 无业务依赖（只能用标准库和通用工具）

### 禁止的依赖（防止循环）

❌ **domain/** 不能依赖:
- actions/ (会破坏分层)
- infrastructure/ (领域应独立于技术)
- services/ (领域应独立于外部)

❌ **infrastructure/** 不能依赖:
- actions/ (会造成循环依赖)

❌ **utils/** 不能依赖:
- 任何业务层（domain/actions/infrastructure/services）

❌ **actions/** 不能依赖:
- app/ (会造成循环依赖)

## 导入路径规范

使用绝对路径导入（通过`@/lib/`别名）：

```typescript
// ✅ 正确：使用绝对路径
import { ORDER_RULES } from '@/lib/domain/policies/business-rules'
import { PayOrderUseCase } from '@/lib/actions/orders/PayOrderUseCase'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { cn } from '@/lib/utils/helpers/common'

// ❌ 错误：使用相对路径（难以重构）
import { ORDER_RULES } from '../../domain/policies/business-rules'
```

## 文件归属决策树

**新增文件时，按此流程决定归属**：

```
是否包含业务规则？
├─ 是 → domain/policies/
└─ 否 → 是否是用户用例编排？
        ├─ 是 → actions/
        └─ 否 → 是否是技术实现（数据库、认证等）？
                ├─ 是 → infrastructure/
                └─ 否 → 是否是外部服务适配？
                        ├─ 是 → services/
                        └─ 否 → 是否是纯函数工具？
                                ├─ 是 → utils/
                                └─ 否 → 重新评估需求
```

## 常见场景归属示例

| 文件内容 | 应该放在 | 原因 |
|---------|---------|------|
| 手续费计算规则 | domain/policies/ | 业务规则 |
| 支付订单UseCase | actions/orders/ | 用例编排 |
| JWT token验证 | infrastructure/auth/ | 技术实现 |
| API限流 | infrastructure/security/ | 技术实现 |
| 发送邮件 | services/notification/ | 外部服务 |
| 日期格式化 | utils/formatters/ | 纯工具函数 |
| Zod验证schema | validations/ | 输入验证 |
| 配置常量 | config/ | 配置管理 |

## 代码质量检查清单

### 在提交PR前，确认：

**依赖检查**：
- [ ] 无循环依赖（使用`madge --circular src/lib/`检查）
- [ ] domain/层无外部依赖
- [ ] utils/层无业务依赖

**类型安全**：
- [ ] 所有公共API有TypeScript类型定义
- [ ] 无`any`类型（除非确实必要）
- [ ] `pnpm tsc --noEmit`通过

**测试覆盖**：
- [ ] 关键业务规则有单元测试（domain/policies/）
- [ ] 关键UseCase有集成测试（actions/）

**文档完整**：
- [ ] 复杂业务规则有注释
- [ ] 公共API有JSDoc注释

## 架构演进路线

### 当前状态（v1.0）
- ✅ 清晰的分层架构
- ✅ 领域规则集中管理
- ✅ 薄UseCase层
- ⚠️ 部分遗留代码（errors/目录）

### 短期优化（v1.1）
- [ ] 统一错误处理（迁移到domain/DomainErrors）
- [ ] 添加领域事件（domain/events/）
- [ ] 完善单元测试覆盖

### 中期优化（v2.0）
- [ ] CQRS分离（Query vs Command）
- [ ] 事件驱动架构（发布订阅）
- [ ] 依赖注入容器

### 长期愿景（v3.0）
- [ ] 微服务拆分（如需要）
- [ ] 完整DDD（聚合根、值对象）
- [ ] Event Sourcing（如需要）

## 参考资料

- **Clean Architecture**: Robert C. Martin
- **Domain-Driven Design**: Eric Evans
- **Next.js App Router**: https://nextjs.org/docs/app
- **Prisma Best Practices**: https://www.prisma.io/docs/guides

## 获取帮助

每个子目录都有详细的README.md文档：
- `domain/README.md` - 领域层指南
- `actions/README.md` - 应用层指南
- `infrastructure/README.md` - 基础设施层指南
- `utils/README.md` - 工具层指南
- `services/README.md` - 服务层指南

如有疑问，请参考对应的README文档。
