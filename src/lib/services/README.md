# Services层 - 外部服务适配器

## 职责
Services层封装与外部服务的交互，作为适配器层连接核心业务和外部系统。这一层应该：
- ✅ 封装第三方服务调用
- ✅ 提供稳定的内部接口
- ✅ 处理外部服务的异常
- ✅ 可替换、可mock

## 目录结构

```
services/
└── timeline/          # 时间线服务
    └── timeline-service.ts  # 订单时间线生成
```

## 依赖规则

✅ **可以依赖**：
- domain/ - 领域层（使用领域实体、错误）
- infrastructure/database/ - 数据库访问
- utils/ - 工具函数
- 第三方服务SDK

❌ **不可以依赖**：
- actions/ - 应用层（防止循环依赖）

## 示例用法

```typescript
// ✅ 正确：从services导入适配器
import { generateOrderTimeline } from '@/lib/services/timeline/timeline-service'

// ✅ 正确：使用服务适配器
const timeline = generateOrderTimeline(order)
```

## 设计原则

1. **接口稳定**：对内提供稳定接口，隔离外部变化
2. **错误转换**：将外部错误转换为领域错误
3. **可替换**：易于替换底层实现（如切换支付网关）
4. **可测试**：通过mock外部依赖来测试
5. **职责单一**：每个service只负责一个外部系统

## 当前services

### timeline/
- **职责**：生成订单操作时间线
- **输入**：订单实体（包含所有状态和时间戳）
- **输出**：格式化的时间线数组
- **特点**：纯数据转换，无外部调用（类似formatter）

## 未来扩展

当业务扩展时，可能添加的services：

### notification/
- **职责**：发送通知（邮件、短信、站内信）
- **示例**：
  - `sendOrderNotification()`
  - `sendRefundNotification()`
- **集成**：邮件服务（SendGrid）、短信服务（阿里云）

### payment/
- **职责**：支付网关集成
- **示例**：
  - `createPayment()`
  - `verifyPaymentCallback()`
- **集成**：支付宝、微信支付

### storage/
- **职责**：文件存储服务
- **示例**：
  - `uploadFile()`
  - `getFileUrl()`
- **集成**：阿里云OSS、AWS S3

### analytics/
- **职责**：数据统计和分析
- **示例**：
  - `trackEvent()`
  - `generateReport()`
- **集成**：Google Analytics、自定义统计

## Services vs Utils

| 维度 | services/ | utils/ |
|-----|-----------|--------|
| 职责 | 外部服务适配 | 纯工具函数 |
| 副作用 | 可能有（调用API） | 无（纯函数） |
| 依赖 | 可依赖外部服务 | 无外部依赖 |
| 示例 | sendEmail(), uploadFile() | formatDate(), cn() |
| 可替换性 | 高（接口稳定） | 低（实现简单） |

## 添加新service的检查清单

在添加新service之前，请确认：
- [ ] 这是与外部系统的交互（如果是纯函数，应放在utils/）
- [ ] 需要隔离第三方服务的变化
- [ ] 提供稳定的内部接口
- [ ] 包含错误处理和重试逻辑
- [ ] 可以通过mock进行单元测试
- [ ] 有完整的TypeScript类型定义

## 注意事项

⚠️ **timeline-service当前的归属**：
- 当前`timeline-service`更像是一个数据格式化工具（无副作用）
- 未来如果保持纯函数特性，可能更适合移到`utils/formatters/`
- 如果添加外部调用（如推送时间线事件到分析系统），则适合留在services/
