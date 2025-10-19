# 架构优化计划 - 从良好到优秀

**目标**: 将架构评分从7.5/10提升到9.0+/10

**日期**: 2025-10-19

---

## 📊 当前问题诊断

### 问题1: lib/根目录混乱 ❌
```
src/lib/
├── admin-menu.ts        # 配置？
├── api-responses.ts     # 工具？
├── audit.ts             # 基础设施？
├── auth.ts              # 基础设施？
├── cookies.ts           # 工具？
├── error-handler.ts     # 工具？
├── prisma.ts            # 基础设施？
├── ratelimit.ts         # 基础设施？
├── sanitize.ts          # 工具？
├── url-validator.ts     # 工具？
└── utils.ts             # 工具？
```
**问题**: 11个文件散落在根目录，职责不清

### 问题2: constants/应该是domain/policies ❌
```
lib/constants/
├── business-rules.ts    # 业务规则
├── confirm-config.ts    # 业务规则
├── order-status.ts      # 业务规则
├── order.ts             # 业务规则
└── refund-config.ts     # 业务规则
```
**问题**: 这些是业务规则（domain knowledge），不是技术常量

### 问题3: services/职责不明确 ❌
```
lib/services/
└── orderTimelineService.ts  # 业务逻辑？工具？
```
**问题**: 只有1个文件，是否应该放在utils或domain？

---

## 🎯 优化目标架构

### 分层清晰的目录结构

```
src/lib/
├── domain/                         # 领域层（核心业务）
│   ├── policies/                   # 业务规则和策略
│   │   ├── fee-policy.ts          # 手续费策略
│   │   ├── deadline-policy.ts     # 期限策略
│   │   └── order-rules.ts         # 订单规则
│   ├── events/                     # 领域事件（解耦）
│   │   ├── order-events.ts
│   │   └── payment-events.ts
│   └── errors/                     # 领域错误
│       └── DomainErrors.ts
│
├── actions/                        # 应用层（用例编排）
│   └── orders/                     # 订单用例
│       ├── pay-order.ts           # 支付订单
│       ├── confirm-order.ts       # 确认收货
│       └── ...
│
├── repositories/                   # 数据访问层
│   └── IOrderRepository.ts
│
├── infrastructure/                 # 基础设施层
│   ├── database/
│   │   └── prisma.ts              # 数据库客户端
│   ├── auth/
│   │   ├── jwt.ts                 # JWT工具
│   │   └── session.ts             # 会话管理
│   ├── middleware/
│   │   └── auth.ts                # 认证中间件
│   ├── security/
│   │   ├── sanitize.ts            # XSS防护
│   │   └── ratelimit.ts           # 限流
│   └── audit/
│       └── audit-logger.ts         # 审计日志
│
├── utils/                          # 纯函数工具
│   ├── validators/
│   │   └── url-validator.ts
│   ├── formatters/
│   │   └── response-formatter.ts
│   └── helpers/
│       ├── cookies.ts
│       └── error-handler.ts
│
├── services/                       # 外部服务适配器
│   ├── timeline/
│   │   └── timeline-service.ts
│   ├── notification/               # 未来：通知服务
│   └── payment/                    # 未来：支付网关
│
└── config/                         # 配置管理
    └── index.ts
```

---

## 🔄 迁移映射表

| 当前位置 | 新位置 | 原因 |
|---------|--------|------|
| `lib/constants/business-rules.ts` | `lib/domain/policies/business-rules.ts` | 业务规则 |
| `lib/constants/confirm-config.ts` | `lib/domain/policies/deadline-policy.ts` | 业务策略 |
| `lib/constants/refund-config.ts` | `lib/domain/policies/refund-policy.ts` | 业务策略 |
| `lib/constants/order-status.ts` | `lib/domain/policies/order-status.ts` | 业务规则 |
| `lib/constants/order.ts` | `lib/domain/policies/order-validation.ts` | 业务规则 |
| `lib/auth.ts` | `lib/infrastructure/auth/jwt.ts` | 基础设施 |
| `lib/prisma.ts` | `lib/infrastructure/database/prisma.ts` | 基础设施 |
| `lib/middleware/auth.ts` | `lib/infrastructure/middleware/auth.ts` | 基础设施 |
| `lib/audit.ts` | `lib/infrastructure/audit/audit-logger.ts` | 基础设施 |
| `lib/ratelimit.ts` | `lib/infrastructure/security/ratelimit.ts` | 基础设施 |
| `lib/sanitize.ts` | `lib/infrastructure/security/sanitize.ts` | 基础设施 |
| `lib/api-responses.ts` | `lib/utils/formatters/api-response.ts` | 工具函数 |
| `lib/error-handler.ts` | `lib/utils/helpers/error-handler.ts` | 工具函数 |
| `lib/cookies.ts` | `lib/utils/helpers/cookies.ts` | 工具函数 |
| `lib/url-validator.ts` | `lib/utils/validators/url.ts` | 工具函数 |
| `lib/utils.ts` | `lib/utils/helpers/common.ts` | 工具函数 |
| `lib/admin-menu.ts` | `lib/config/admin-menu.ts` | 配置 |
| `lib/services/orderTimelineService.ts` | `lib/services/timeline/timeline-service.ts` | 服务 |

---

## 📋 执行步骤

### Phase 1: 创建新目录结构 ✅
```bash
mkdir -p src/lib/domain/{policies,events}
mkdir -p src/lib/infrastructure/{database,auth,middleware,security,audit}
mkdir -p src/lib/utils/{validators,formatters,helpers}
mkdir -p src/lib/services/timeline
```

### Phase 2: 移动domain层文件
- constants/ → domain/policies/

### Phase 3: 移动infrastructure层文件
- prisma.ts → infrastructure/database/
- auth.ts → infrastructure/auth/
- middleware/ → infrastructure/middleware/
- ratelimit.ts, sanitize.ts → infrastructure/security/
- audit.ts → infrastructure/audit/

### Phase 4: 移动utils层文件
- api-responses.ts → utils/formatters/
- error-handler.ts, cookies.ts → utils/helpers/
- url-validator.ts → utils/validators/
- utils.ts → utils/helpers/

### Phase 5: 重组services层
- orderTimelineService.ts → services/timeline/

### Phase 6: 更新所有导入路径
- 使用sed批量替换

### Phase 7: 添加架构文档
- 每个目录添加README.md
- 添加依赖规则文档

### Phase 8: 验证
- TypeScript编译检查
- 运行测试脚本
- 循环依赖检测

---

## 🎯 预期收益

### 架构清晰度 ⬆️
- ✅ 每个目录职责单一
- ✅ 分层明确（domain → actions → infrastructure）
- ✅ 符合Clean Architecture原则

### 可维护性 ⬆️
- ✅ 新人快速找到文件位置
- ✅ 修改影响范围可控
- ✅ 单元测试更容易编写

### 可扩展性 ⬆️
- ✅ 添加新功能时目录归属明确
- ✅ 支持领域事件（未来）
- ✅ 便于引入微服务（未来）

### 架构评分提升
- 当前: 7.5/10
- 目标: 9.0+/10

---

## 🔒 架构规则

### 依赖方向规则
```
app/ → lib/actions/ → lib/domain/ → lib/repositories/
                   ↓
              lib/infrastructure/
                   ↓
              lib/utils/
```

### 禁止的依赖
```
❌ lib/domain/ → lib/actions/
❌ lib/domain/ → lib/infrastructure/
❌ lib/infrastructure/ → lib/actions/
❌ lib/utils/ → lib/domain/
```

### 导入规则
```typescript
// ✅ 允许
import { OrderRules } from '@/lib/domain/policies/order-rules'
import { prisma } from '@/lib/infrastructure/database/prisma'
import { formatApiResponse } from '@/lib/utils/formatters/api-response'

// ❌ 禁止
import { something } from '@/lib/infrastructure/database/prisma'  // 跨层访问
```

---

## 📅 时间估算

- Phase 1-2: 30分钟（创建目录+移动domain）
- Phase 3-5: 1小时（移动infrastructure+utils+services）
- Phase 6: 1-2小时（更新导入路径）
- Phase 7: 30分钟（文档）
- Phase 8: 30分钟（验证）

**总计**: 3.5-4小时

---

## ✅ 验收标准

1. ✅ lib/根目录只保留4个子目录（domain/actions/infrastructure/utils）
2. ✅ TypeScript编译通过（0错误）
3. ✅ 无循环依赖
4. ✅ 所有测试脚本通过
5. ✅ 架构文档完整
6. ✅ 架构评审分数 ≥ 9.0/10
