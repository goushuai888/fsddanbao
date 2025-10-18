# 📚 FSD担保交易平台 - 文档中心

欢迎查阅FSD担保交易平台的完整文档。所有文档已按类别整理。

## 📂 文档目录结构

```
docs/
├── guides/              快速开始和使用指南
├── api/                 API接口文档
├── architecture/        系统架构设计
├── deployment/          部署和运维指南
├── security/            安全相关文档
└── reports/             技术报告（预留）
```

---

## 🚀 快速开始

### 新手入门
- **[快速开始指南](./guides/QUICKSTART.md)** - 5分钟快速部署和运行项目
- **[验证指南](./guides/VERIFICATION_GUIDE.md)** - 功能测试和验证流程

---

## 📖 开发文档

### API文档
- **[API接口文档](./api/API.md)** - 完整的RESTful API接口说明
  - 认证接口
  - 订单管理接口
  - 支付和退款接口
  - 管理员接口

### 架构设计
- **[系统架构文档](./architecture/ARCHITECTURE.md)** - 技术架构和设计思路
  - 技术栈选择
  - 数据库设计
  - 业务流程
  - 安全机制

---

## 🚢 部署运维

### 部署指南
- **[Docker部署指南](./deployment/DOCKER_DEPLOY.md)** - 使用Docker快速部署（推荐）
  - 一键启动脚本
  - 环境配置
  - 常用命令
  - 故障排查

- **[GitHub Container部署](./deployment/GITHUB_CONTAINER.md)** - 使用GitHub Container Registry
  - 镜像构建
  - 自动部署
  - 版本管理

---

## 🔒 安全文档

### 安全验证
- **[安全验证报告](./security/SECURITY_VERIFICATION_REPORT.md)** - 完整的安全审计和修复报告
  - 已修复漏洞列表
  - 测试脚本使用
  - 安全最佳实践
  - 改进建议

**主要安全改进：**
- ✅ JWT密钥升级为256位强随机密钥（CVSS 9.8）
- ✅ 数据库索引优化（27个索引）
- ✅ 事务完整性保护
- ✅ 乐观锁防止并发竞态
- ✅ 审计日志系统

---

## 📋 最近更新

### 2025-10-17
- ✅ 整理项目文档结构
- ✅ 删除临时报告文档
- ✅ 创建统一文档导航

### 2025-10-17 (早期)
- ✅ 完成安全验证和修复
- ✅ 添加退款系统增强
- ✅ 创建测试验证脚本

---

## 🤝 贡献文档

如果您发现文档有误或需要改进，欢迎：
1. 提交 Issue 描述问题
2. 提交 Pull Request 修正文档
3. 在文档中添加更多示例

---

## 📞 获取帮助

如有问题，请：
1. 查看对应文档
2. 查看 [常见问题](../README.md#开发计划)
3. 提交 [Issue](https://github.com/goushuai888/fsddanbao/issues)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
