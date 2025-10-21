# 增强账务记录审计追踪 - 实施任务清单

## 阶段 1: API 增强 ✅

### 1.1 修改 Prisma 查询
- [ ] 打开 `src/app/api/user/transactions/route.ts`
- [ ] 在 `prisma.payment.findMany()` 的 `include` 中添加：
  ```typescript
  include: {
    order: {
      // 保持现有配置
    },
    withdrawal: {
      select: {
        id: true,
        withdrawMethod: true,
        status: true,
        amount: true,
        actualAmount: true,
        createdAt: true,
        completedAt: true
      }
    },
    performedByUser: {
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    }
  }
  ```
- [ ] 确保返回的 Payment 记录包含 `metadata`、`note`、`performedBy` 字段（已在模型中，无需额外配置）

### 1.2 API 测试
- [ ] 启动开发服务器：`pnpm dev`
- [ ] 测试 API 调用：`GET /api/user/transactions`
- [ ] 验证响应包含新增字段
- [ ] 检查不同 Payment 类型的响应（ESCROW、RELEASE、REFUND、WITHDRAW）

## 阶段 2: 类型定义更新

### 2.1 TypeScript 类型
- [ ] 检查 `src/types/index.ts` 是否需要更新
- [ ] 如果前端使用自定义类型，添加：
  ```typescript
  interface TransactionResponse {
    // ... 现有字段
    withdrawal?: {
      id: string
      withdrawMethod: string
      status: string
      amount: number
      actualAmount: number
      createdAt: string
      completedAt: string | null
    }
    performedByUser?: {
      id: string
      name: string | null
      email: string
      role: string
    }
    metadata?: any
    note?: string | null
    performedBy?: string | null
  }
  ```

## 阶段 3: 前端展示增强

### 3.1 修改账务记录页面
- [ ] 打开 `src/app/transactions/page.tsx`
- [ ] 在交易类型标签旁边添加操作人标识：
  - 如果 `performedBy` 存在且 `performedByUser.role === 'ADMIN'`，显示"管理员操作"徽章
  - 显示操作人名称（如果有）

### 3.2 显示备注和元数据
- [ ] 在每条记录下方添加备注显示区域
- [ ] 如果 `note` 存在，显示为灰色文本
- [ ] 如果 `metadata` 存在且包含有用信息（如调账原因），显示关键字段：
  ```typescript
  // 示例：metadata 可能包含
  {
    reason: "用户投诉补偿",
    adminUserId: "xxx",
    originalAmount: 100
  }
  ```

### 3.3 提现记录增强
- [ ] 对于 `type === 'WITHDRAW'` 的记录，检查 `withdrawal` 字段
- [ ] 如果存在，显示：
  - 提现方式（银行卡/支付宝/微信）
  - 提现状态
  - 实际到账金额
  - 申请时间和完成时间
- [ ] 添加点击跳转到提现详情的链接（如果有提现详情页）

### 3.4 视觉设计
- [ ] 为管理员操作添加视觉标识：
  - 橙色/黄色徽章："管理员调账"
  - 图标：使用 `ShieldCheck` 或 `UserCog`
- [ ] 为不同操作类型使用不同样式：
  - 用户操作：默认样式
  - 管理员操作：带边框/背景色高亮
- [ ] 确保备注文本使用 `sanitizeText()` 清理（XSS 防护）

### 3.5 响应式设计
- [ ] 确保在移动设备上正确显示新增信息
- [ ] 考虑使用折叠/展开显示详细信息

## 阶段 4: 测试验证

### 4.1 功能测试
- [ ] **测试场景 1: 管理员调账**
  - 使用管理员账户给用户调账（增加/减少余额）
  - 检查账务记录是否显示操作人和调账原因
  - 验证"管理员操作"徽章显示正确

- [ ] **测试场景 2: 提现操作**
  - 用户申请提现
  - 检查 WITHDRAW 记录是否显示提现申请详情
  - 验证提现方式、状态、金额等信息正确

- [ ] **测试场景 3: 退款操作**
  - 卖家同意退款
  - 检查 REFUND 记录是否显示退款原因（如果在 metadata 中）
  - 验证关联的订单信息正确

- [ ] **测试场景 4: 普通交易**
  - 完成一笔正常订单（ESCROW → RELEASE）
  - 确保新增字段不影响普通交易显示
  - 验证 performedBy 为空时不显示操作人

### 4.2 边界情况测试
- [ ] 测试旧数据（没有 performedBy 字段）- 应优雅处理
- [ ] 测试 metadata 为 null 的记录 - 不崩溃
- [ ] 测试 withdrawal 为 null 的 WITHDRAW 记录（如果存在）

### 4.3 性能测试
- [ ] 记录修改前的 API 响应时间
- [ ] 记录修改后的 API 响应时间
- [ ] 确认增加 < 100ms
- [ ] 使用 Chrome DevTools 检查前端渲染性能

### 4.4 安全测试
- [ ] 验证普通用户看不到管理员的内部备注（如果有敏感信息）
- [ ] 验证所有用户输入都经过 sanitize 处理
- [ ] 测试 XSS 攻击向量（在备注中注入脚本）

## 阶段 5: 文档和部署

### 5.1 更新文档
- [ ] 更新 `CLAUDE.md` 中的"账务记录功能"部分
- [ ] 添加新增字段的说明
- [ ] 更新 API 文档（如果有 API.md）

### 5.2 代码审查
- [ ] 自我审查代码变更
- [ ] 确保符合项目编码规范
- [ ] 运行 `pnpm lint` 检查代码质量
- [ ] 运行 `pnpm build` 确保构建成功

### 5.3 Git 提交
- [ ] 创建 Git commit：
  ```bash
  git add .
  git commit -m "feat: 增强账务记录审计追踪

  主要改进:
  - API返回操作人信息(performedByUser)
  - API返回提现关联信息(withdrawal)
  - 前端显示操作备注和元数据
  - 管理员操作添加视觉标识
  - 提现记录显示详细信息

  受影响文件:
  - src/app/api/user/transactions/route.ts
  - src/app/transactions/page.tsx
  - src/types/index.ts (如有修改)

  测试:
  - 管理员调账 ✅
  - 提现操作 ✅
  - 退款操作 ✅
  - 普通交易 ✅
  - 性能影响 < 100ms ✅
  "
  ```

### 5.4 归档 OpenSpec 变更
- [ ] 运行 `openspec update enhance-transaction-audit-trail --status completed`
- [ ] 或运行 `/openspec:archive enhance-transaction-audit-trail`

## 预估时间

| 阶段 | 预估时间 | 实际时间 |
|------|---------|---------|
| 阶段 1: API 增强 | 1h | |
| 阶段 2: 类型定义 | 0.5h | |
| 阶段 3: 前端增强 | 2-3h | |
| 阶段 4: 测试验证 | 1h | |
| 阶段 5: 文档部署 | 0.5h | |
| **总计** | **5-6h** | |

## 依赖和前置条件

- ✅ 数据库已有 `performedBy`、`metadata`、`withdrawalId` 字段
- ✅ WalletService 已正确填充审计字段
- ✅ 开发环境正常运行

## 注意事项

⚠️ **隐私保护**: 确保管理员内部备注不暴露给普通用户
⚠️ **XSS 防护**: 所有用户输入必须使用 `sanitizeText()` 清理
⚠️ **性能监控**: 如果响应时间增加明显，考虑添加数据库索引
⚠️ **向后兼容**: 确保旧数据（没有新字段）不会导致前端崩溃
