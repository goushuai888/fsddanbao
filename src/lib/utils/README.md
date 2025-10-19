# Utils层 - 工具函数

## 职责
工具层提供纯函数和无副作用的辅助工具，服务于所有其他层。这一层应该：
- ✅ 提供纯函数（无副作用）
- ✅ 可复用、可测试
- ✅ 独立于业务逻辑
- ✅ 不依赖任何业务层

## 目录结构

```
utils/
├── formatters/        # 格式化工具
│   └── api-responses.ts  # API响应格式化
├── validators/        # 验证工具
│   └── url-validator.ts  # URL验证
└── helpers/           # 通用辅助函数
    ├── common.ts         # 通用工具（cn等）
    ├── cookies.ts        # Cookie操作
    └── error-handler.ts  # 错误处理辅助
```

## 依赖规则

✅ **可以依赖**：
- 标准库
- 通用工具库（clsx, tailwind-merge等）

❌ **不可以依赖**：
- domain/ - 领域层
- actions/ - 应用层
- infrastructure/ - 基础设施层
- 任何业务逻辑

## 示例用法

```typescript
// ✅ 正确：使用纯工具函数
import { cn } from '@/lib/utils/helpers/common'
import { handleApiError } from '@/lib/utils/helpers/error-handler'
import { formatApiResponse } from '@/lib/utils/formatters/api-responses'
import { validateUrl } from '@/lib/utils/validators/url-validator'

// ✅ 正确：工具函数无副作用
const className = cn('base-class', isActive && 'active')
const response = formatApiResponse(data, 'success')
const isValid = validateUrl(url)
```

## 设计原则

1. **纯函数**：所有函数应该是纯函数，相同输入永远返回相同输出
2. **无副作用**：不修改外部状态，不访问数据库或API
3. **小而专注**：每个函数只做一件事
4. **易于测试**：可以单独测试，无需mock
5. **类型安全**：完整的TypeScript类型定义

## 各子模块说明

### formatters/
- **职责**：数据格式化、转换
- **示例**：API响应格式化、日期格式化、数字格式化
- **特点**：纯数据转换，无业务逻辑

### validators/
- **职责**：数据验证、格式检查
- **示例**：URL验证、邮箱验证、输入清理
- **特点**：返回布尔值或验证结果，无副作用

### helpers/
- **职责**：通用辅助函数
- **示例**：className合并、Cookie操作、错误处理
- **特点**：可复用、跨业务领域

## 与domain/policies的区别

| 维度 | utils/ | domain/policies/ |
|-----|--------|------------------|
| 职责 | 技术工具 | 业务规则 |
| 内容 | 纯函数 | 业务常量+策略函数 |
| 依赖 | 无业务依赖 | 可能依赖domain其他部分 |
| 示例 | cn(), formatDate() | calculatePlatformFee() |
| 命名 | 技术术语 | 业务术语 |

## 添加新工具函数的检查清单

在添加新函数到utils/之前，请确认：
- [ ] 这是一个纯函数（无副作用）
- [ ] 不包含业务逻辑（如果包含，应放在domain/）
- [ ] 不访问数据库或外部API（如果访问，应放在infrastructure/）
- [ ] 可以在任何业务场景复用
- [ ] 有完整的TypeScript类型定义
- [ ] 有单元测试（推荐）
