# API接口文档

## 基础信息

- **Base URL**: `http://localhost:3000/api`
- **认证方式**: Bearer Token (JWT)
- **Content-Type**: `application/json`

## 认证相关

### 1. 用户注册

**接口**: `POST /auth/register`

**请求参数**:
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "张三",
  "phone": "13800138000",
  "role": "BUYER"  // BUYER | SELLER
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx...",
      "email": "user@example.com",
      "name": "张三",
      "role": "BUYER",
      "verified": false
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "注册成功"
}
```

### 2. 用户登录

**接口**: `POST /auth/login`

**请求参数**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "clxxx...",
      "email": "user@example.com",
      "name": "张三",
      "role": "BUYER",
      "verified": false,
      "balance": 0
    },
    "token": "eyJhbGciOiJIUzI1NiIs..."
  },
  "message": "登录成功"
}
```

## 订单相关

### 3. 创建订单

**接口**: `POST /orders`

**请求头**:
```
Authorization: Bearer {token}
```

**请求参数**:
```json
{
  "vehicleBrand": "Tesla",
  "vehicleModel": "Model 3",
  "vehicleYear": 2023,
  "vin": "5YJ3E1EA...",  // 可选
  "fsdVersion": "FSD Beta 12.3",
  "price": 30000
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "orderNo": "FSD20241016ABC123",
    "status": "PUBLISHED",
    "vehicleBrand": "Tesla",
    "vehicleModel": "Model 3",
    "price": 30000,
    "platformFee": 900,
    "createdAt": "2024-10-16T10:00:00.000Z"
  },
  "message": "订单创建成功"
}
```

### 4. 获取订单列表

**接口**: `GET /orders`

**请求头**:
```
Authorization: Bearer {token}
```

**查询参数**:
- `status`: 订单状态 (可选)
- `type`: 订单类型 `sell` | `buy` (可选)

**示例**:
```
GET /orders?type=sell&status=PUBLISHED
```

**响应示例**:
```json
{
  "success": true,
  "data": [
    {
      "id": "clxxx...",
      "orderNo": "FSD20241016ABC123",
      "status": "PUBLISHED",
      "vehicleBrand": "Tesla",
      "vehicleModel": "Model 3",
      "price": 30000,
      "seller": {
        "id": "clxxx...",
        "name": "张三",
        "verified": true
      },
      "buyer": null,
      "createdAt": "2024-10-16T10:00:00.000Z"
    }
  ]
}
```

### 5. 获取订单详情

**接口**: `GET /orders/{id}`

**请求头**:
```
Authorization: Bearer {token}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "orderNo": "FSD20241016ABC123",
    "status": "PAID",
    "vehicleBrand": "Tesla",
    "vehicleModel": "Model 3",
    "vehicleYear": 2023,
    "vin": "5YJ3E1EA...",
    "fsdVersion": "FSD Beta 12.3",
    "price": 30000,
    "escrowAmount": 30000,
    "platformFee": 900,
    "seller": {
      "id": "clxxx...",
      "name": "张三",
      "email": "seller@example.com",
      "phone": "13800138000",
      "verified": true
    },
    "buyer": {
      "id": "clyyy...",
      "name": "李四",
      "email": "buyer@example.com",
      "phone": "13900139000",
      "verified": true
    },
    "payments": [],
    "reviews": [],
    "createdAt": "2024-10-16T10:00:00.000Z",
    "paidAt": "2024-10-16T10:30:00.000Z"
  }
}
```

### 6. 订单操作

**接口**: `PATCH /orders/{id}`

**请求头**:
```
Authorization: Bearer {token}
```

#### 6.1 买家支付

**请求参数**:
```json
{
  "action": "pay"
}
```

#### 6.2 卖家提交转移凭证

**请求参数**:
```json
{
  "action": "transfer",
  "transferProof": "https://example.com/proof.jpg",
  "transferNote": "FSD权限已通过Tesla App转移"
}
```

#### 6.3 买家确认收货

**请求参数**:
```json
{
  "action": "confirm"
}
```

#### 6.4 取消订单

**请求参数**:
```json
{
  "action": "cancel"
}
```

**响应示例**:
```json
{
  "success": true,
  "data": {
    "id": "clxxx...",
    "status": "COMPLETED",
    "completedAt": "2024-10-16T12:00:00.000Z"
  },
  "message": "操作成功"
}
```

## 订单状态说明

| 状态 | 说明 | 可执行操作 |
|------|------|------------|
| PUBLISHED | 已发布 | 买家可支付，卖家可取消 |
| PAID | 已支付 | 卖家提交转移凭证，双方可申诉 |
| TRANSFERRING | 转移中 | 买家确认收货，双方可申诉 |
| CONFIRMING | 待确认 | 买家确认收货 |
| COMPLETED | 已完成 | 双方可评价 |
| CANCELLED | 已取消 | 无 |
| DISPUTE | 申诉中 | 等待平台处理 |

## 错误响应

所有错误响应格式:
```json
{
  "success": false,
  "error": "错误信息描述"
}
```

常见HTTP状态码:
- `200`: 成功
- `400`: 请求参数错误
- `401`: 未授权/token无效
- `403`: 权限不足
- `404`: 资源不存在
- `500`: 服务器错误

## 使用示例 (curl)

### 注册用户
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "测试用户",
    "role": "SELLER"
  }'
```

### 登录
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 创建订单 (需要token)
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "vehicleBrand": "Tesla",
    "vehicleModel": "Model 3",
    "vehicleYear": 2023,
    "fsdVersion": "FSD Beta 12.3",
    "price": 30000
  }'
```

### 获取订单列表
```bash
curl http://localhost:3000/api/orders?type=sell \
  -H "Authorization: Bearer YOUR_TOKEN"
```
