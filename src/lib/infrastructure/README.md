# Infrastructure层 - 基础设施

## 职责
基础设施层提供技术实现和外部系统集成，支撑应用层和领域层的运行。这一层应该：
- ✅ 提供数据库访问
- ✅ 提供认证授权机制
- ✅ 提供安全防护（限流、XSS防护）
- ✅ 提供审计日志
- ✅ 封装第三方技术细节

## 目录结构

```
infrastructure/
├── database/          # 数据库访问层
│   └── prisma.ts         # Prisma Client单例
├── auth/              # 认证授权
│   └── jwt.ts            # JWT token生成和验证
├── middleware/        # 中间件
│   ├── auth.ts           # 认证中间件
│   └── __tests__/        # 中间件测试
├── security/          # 安全防护
│   ├── ratelimit.ts      # API限流
│   └── sanitize.ts       # XSS防护
└── audit/             # 审计日志
    └── audit-logger.ts   # 审计日志记录
```

## 依赖规则

✅ **可以依赖**：
- domain/ - 领域层（使用领域错误）
- utils/ - 工具层（辅助函数）
- 第三方库（@prisma/client, jsonwebtoken等）

❌ **不可以依赖**：
- actions/ - 应用层（防止循环依赖）

## 示例用法

```typescript
// ✅ 正确：从infrastructure导入技术实现
import { prisma } from '@/lib/infrastructure/database/prisma'
import { verifyToken, generateToken } from '@/lib/infrastructure/auth/jwt'
import { sensitiveLimiter, apiLimiter } from '@/lib/infrastructure/security/ratelimit'
import { sanitizeText } from '@/lib/infrastructure/security/sanitize'
import { logAudit } from '@/lib/infrastructure/audit/audit-logger'

// ✅ 正确：使用基础设施
const user = await prisma.user.findUnique({ where: { id } })
const token = generateToken({ userId: user.id })
await logAudit({ userId, action: 'LOGIN' })
```

## 设计原则

1. **技术隔离**：将技术实现细节封装在infrastructure层
2. **接口抽象**：对外提供清晰的接口（如prisma单例）
3. **配置管理**：从环境变量读取配置
4. **错误处理**：捕获并转换技术错误为领域错误
5. **日志记录**：记录关键操作和错误

## 各子模块说明

### database/
- **职责**：提供Prisma Client单例，避免连接池耗尽
- **注意**：仅导出prisma实例，不暴露Prisma API细节

### auth/
- **职责**：JWT token生成、验证、密码加密
- **安全**：使用256位密钥、bcryptjs加密密码

### middleware/
- **职责**：Next.js中间件，统一认证和权限检查
- **特性**：支持路由级别的认证、角色检查

### security/
- **职责**：API限流、XSS防护
- **技术**：使用Upstash Redis限流、DOMPurify清理HTML

### audit/
- **职责**：记录所有敏感操作，支持审计追溯
- **数据**：操作人、时间、目标、IP、User-Agent
