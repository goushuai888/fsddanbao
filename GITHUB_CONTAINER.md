# GitHub Container Registry 镜像构建和推送指南

本文档说明如何构建Docker镜像并推送到GitHub Container Registry (ghcr.io)，以便在其他服务器上快速部署。

## 📋 前置要求

- Docker 已安装并运行
- GitHub 账号
- GitHub Personal Access Token (PAT)

## 🔑 创建 GitHub Personal Access Token

1. 登录 GitHub，进入 Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token (classic)"
3. 设置权限：
   - ✅ `write:packages` - 上传容器镜像
   - ✅ `read:packages` - 下载容器镜像
   - ✅ `delete:packages` - 删除容器镜像
4. 生成并保存 Token（只会显示一次！）

## 🔐 登录 GitHub Container Registry

```bash
# 使用你的 GitHub 用户名和刚才创建的 Token
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

**示例：**
```bash
echo "ghp_xxxxxxxxxxxxxxxxxxxx" | docker login ghcr.io -u goushuai888 --password-stdin
```

登录成功会显示：
```
Login Succeeded
```

## 🏗️ 构建 Docker 镜像

**方式一：构建并标记（推荐）**

```bash
# 同时创建 latest 和版本号标签
docker build -t ghcr.io/goushuai888/fsddanbao:latest -t ghcr.io/goushuai888/fsddanbao:v1.2.0 .
```

**方式二：先构建后标记**

```bash
# 1. 构建本地镜像
docker build -t fsddanbao:v1.2.0 .

# 2. 标记为 GitHub Container Registry 格式
docker tag fsddanbao:v1.2.0 ghcr.io/goushuai888/fsddanbao:v1.2.0
docker tag fsddanbao:v1.2.0 ghcr.io/goushuai888/fsddanbao:latest
```

## 📤 推送镜像到 GitHub

```bash
# 推送指定版本
docker push ghcr.io/goushuai888/fsddanbao:v1.2.0

# 推送 latest 标签
docker push ghcr.io/goushuai888/fsddanbao:latest
```

**或者一次性推送所有标签：**

```bash
docker push ghcr.io/goushuai888/fsddanbao --all-tags
```

## 🔍 验证镜像推送

1. 访问 GitHub 仓库页面
2. 点击右侧 "Packages" 查看已推送的镜像
3. 或访问：https://github.com/users/goushuai888/packages/container/package/fsddanbao

## 🚀 在其他服务器上使用镜像

### 设置镜像为公开（可选）

如果希望不登录也能拉取镜像：

1. 进入 Package 页面
2. 点击 "Package settings"
3. 找到 "Danger Zone" → "Change visibility"
4. 选择 "Public"

### 拉取镜像

**公开镜像（无需登录）：**

```bash
docker pull ghcr.io/goushuai888/fsddanbao:latest
```

**私有镜像（需要先登录）：**

```bash
# 1. 登录
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin

# 2. 拉取镜像
docker pull ghcr.io/goushuai888/fsddanbao:latest
```

## 📦 使用 Docker Compose 部署

修改 `docker-compose.yml`，使用 GitHub 上的镜像：

```yaml
services:
  app:
    # 注释掉 build 配置
    # build:
    #   context: .
    #   dockerfile: Dockerfile

    # 使用预构建的镜像
    image: ghcr.io/goushuai888/fsddanbao:latest

    # 其他配置保持不变...
    container_name: fsd-escrow-app
    restart: always
    # ...
```

然后直接启动：

```bash
docker-compose up -d
```

## 🔄 更新镜像

### 开发环境（构建并推送新版本）

```bash
# 1. 修改版本号（如 v1.3.0）
docker build -t ghcr.io/goushuai888/fsddanbao:v1.3.0 -t ghcr.io/goushuai888/fsddanbao:latest .

# 2. 推送新版本
docker push ghcr.io/goushuai888/fsddanbao --all-tags

# 3. 提交代码并打标签
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0
```

### 生产环境（更新镜像）

```bash
# 1. 拉取最新镜像
docker-compose pull

# 2. 重启服务
docker-compose up -d

# 或者一步完成
docker-compose pull && docker-compose up -d
```

## 📊 镜像管理

### 查看本地镜像

```bash
docker images | grep fsddanbao
```

### 删除本地镜像

```bash
# 删除指定版本
docker rmi ghcr.io/goushuai888/fsddanbao:v1.2.0

# 删除所有相关镜像
docker images | grep fsddanbao | awk '{print $3}' | xargs docker rmi
```

### 清理构建缓存

```bash
docker builder prune -a
```

## 🛠️ 故障排查

### 推送失败：unauthorized

```bash
# 重新登录
docker logout ghcr.io
echo "YOUR_GITHUB_TOKEN" | docker login ghcr.io -u YOUR_GITHUB_USERNAME --password-stdin
```

### 构建失败：网络问题

```bash
# 使用镜像加速器或等待网络恢复后重试
docker build --network=host -t ghcr.io/goushuai888/fsddanbao:latest .
```

### 镜像太大

```bash
# 查看镜像大小
docker images ghcr.io/goushuai888/fsddanbao

# 使用多阶段构建（已在 Dockerfile 中配置）
# 清理不必要的文件，确保 .dockerignore 正确配置
```

## 💡 最佳实践

1. **版本管理**：
   - 使用语义化版本号（如 v1.2.0）
   - latest 标签始终指向最新稳定版本
   - 生产环境使用具体版本号，避免使用 latest

2. **安全性**：
   - 不要在公开的镜像中包含敏感信息
   - 使用 .dockerignore 排除 .env 文件
   - 定期更新基础镜像修复安全漏洞

3. **自动化**：
   - 使用 GitHub Actions 自动构建和推送镜像
   - 在 git tag 时触发自动构建

## 📚 相关文档

- [DOCKER_DEPLOY.md](./DOCKER_DEPLOY.md) - Docker 本地部署指南
- [README.md](./README.md) - 项目主文档
- [GitHub Container Registry 官方文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
