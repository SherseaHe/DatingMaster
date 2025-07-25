# Kimi API Backend

基于 Node.js 的 Kimi API 后端服务，提供完整的前端接口集成。

## 📋 功能特性

- 🚀 **单轮对话** - 支持简单的问答交互
- 💬 **多轮对话** - 支持上下文感知的连续对话
- 🌊 **流式对话** - 支持实时流式响应
- 🔧 **模型管理** - 获取可用模型列表
- 🛡️ **安全防护** - 集成速率限制、CORS、Helmet安全中间件
- 📊 **健康监控** - 提供健康检查和API信息端点
- 🔑 **认证支持** - 可选的API Key认证机制

## 🛠️ 技术栈

- **Node.js** - 运行时环境
- **Express** - Web框架
- **OpenAI SDK** - Kimi API客户端
- **dotenv** - 环境变量管理
- **cors** - 跨域资源共享
- **helmet** - 安全中间件
- **express-rate-limit** - 速率限制

## 📦 安装与运行

### 1. 克隆项目

```bash
git clone <repository-url>
cd kimi-backend
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境配置

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置您的Kimi API密钥：

```env
# Kimi API Configuration
KIMI_API_KEY=sk-XeraCRbcZFqrnBxDB4VdUCUwcHZcZISRWwh8fLYyRtALKrh0
KIMI_BASE_URL=https://api.moonshot.cn/v1

# Server Configuration
PORT=3000
NODE_ENV=development

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. 启动服务

开发模式（支持热重载）：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

## 🔌 API接口文档

### 基础信息

- **基础URL**: `http://localhost:3000`
- **认证方式**: API Key（可选）
- **请求格式**: JSON
- **响应格式**: JSON

### API端点

#### 1. 健康检查

```http
GET /health
```

响应示例：
```json
{
  "success": true,
  "message": "Kimi API Backend is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

#### 2. API信息

```http
GET /api/info
```

#### 3. 单轮对话

```http
POST /api/chat/completion
```

请求体：
```json
{
  "message": "你好，请介绍一下你自己",
  "model": "moonshot-v1-8k"
}
```

响应示例：
```json
{
  "success": true,
  "data": {
    "message": "你好！我是 Kimi，一个由 Moonshot AI 开发的人工智能助手...",
    "usage": {
      "prompt_tokens": 10,
      "completion_tokens": 50,
      "total_tokens": 60
    },
    "model": "moonshot-v1-8k"
  }
}
```

#### 4. 多轮对话

```http
POST /api/chat/history
```

请求体：
```json
{
  "messages": [
    {"role": "user", "content": "你好"},
    {"role": "assistant", "content": "你好！我是Kimi。"},
    {"role": "user", "content": "请告诉我今天的天气"}
  ],
  "model": "moonshot-v1-8k"
}
```

#### 5. 流式对话

```http
POST /api/chat/stream
```

请求体：
```json
{
  "messages": "请写一个简短的故事",
  "model": "moonshot-v1-8k"
}
```

响应格式（Server-Sent Events）：
```
data: {"content": "从前"}
data: {"content": "有一个"}
data: {"content": "小村庄..."}
data: [DONE]
```

#### 6. 获取模型列表

```http
GET /api/chat/models
```

### 可用模型

- `moonshot-v1-8k` - 8K上下文长度
- `moonshot-v1-32k` - 32K上下文长度  
- `moonshot-v1-128k` - 128K上下文长度

## 🎨 前端集成

### HTML示例

项目提供了完整的前端调用示例，位于 `frontend-examples/index.html`。您可以直接在浏览器中打开此文件来测试API接口。

### JavaScript SDK

我们提供了封装好的JavaScript SDK (`frontend-examples/kimi-sdk.js`)，方便前端项目集成：

```javascript
// 引入SDK
import KimiClient from './kimi-sdk.js';

// 初始化客户端
const client = new KimiClient({
  baseURL: 'http://localhost:3000',
  apiKey: 'your-api-key' // 可选
});

// 单轮对话
const response = await client.chat('你好');
console.log(response.data.message);

// 多轮对话
const messages = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好！' },
  { role: 'user', content: '今天天气如何？' }
];
const response = await client.chatWithHistory(messages);

// 流式对话
await client.chatStream('写一个故事', {
  onMessage: (content) => console.log(content),
  onComplete: () => console.log('完成'),
  onError: (error) => console.error(error)
});
```

### React示例

```jsx
import React, { useState } from 'react';
import KimiClient from './kimi-sdk.js';

const client = new KimiClient({
  baseURL: 'http://localhost:3000'
});

function ChatComponent() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const result = await client.chat(message);
      setResponse(result.data.message);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="输入您的问题..."
        />
        <button type="submit" disabled={loading}>
          {loading ? '发送中...' : '发送'}
        </button>
      </form>
      {response && (
        <div>
          <h3>回复：</h3>
          <p>{response}</p>
        </div>
      )}
    </div>
  );
}

export default ChatComponent;
```

## 🔐 安全配置

### API Key认证

如需启用API Key认证，在 `.env` 文件中添加：

```env
REQUIRE_API_KEY=true
VALID_API_KEYS=key1,key2,key3
```

前端请求时需要在请求头中包含API Key：

```javascript
// 方式1: 使用 x-api-key 头
headers: {
  'x-api-key': 'your-api-key'
}

// 方式2: 使用 Authorization 头
headers: {
  'Authorization': 'Bearer your-api-key'
}
```

### CORS配置

配置允许的源地址：

```env
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### 速率限制

调整速率限制参数：

```env
RATE_LIMIT_WINDOW_MS=900000  # 时间窗口（毫秒）
RATE_LIMIT_MAX_REQUESTS=100  # 最大请求数
```

## 🚀 部署

### Docker部署

创建 `Dockerfile`：

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

构建和运行：

```bash
docker build -t kimi-backend .
docker run -p 3000:3000 --env-file .env kimi-backend
```

### PM2部署

安装PM2：

```bash
npm install -g pm2
```

创建 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'kimi-backend',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
};
```

启动服务：

```bash
pm2 start ecosystem.config.js
```

## 📝 开发指南

### 项目结构

```
kimi-backend/
├── server.js              # 主服务器文件
├── package.json           # 项目配置
├── .env                   # 环境变量
├── .env.example          # 环境变量示例
├── .gitignore            # Git忽略文件
├── README.md             # 项目文档
├── services/             # 服务层
│   └── kimiService.js    # Kimi API服务
├── routes/               # 路由层
│   └── chat.js          # 聊天相关路由
├── middleware/           # 中间件
│   └── auth.js          # 认证中间件
└── frontend-examples/    # 前端示例
    ├── index.html       # 网页测试界面
    └── kimi-sdk.js      # JavaScript SDK
```

### 添加新功能

1. 在 `services/kimiService.js` 中添加新的服务方法
2. 在 `routes/chat.js` 中添加对应的路由处理
3. 更新前端SDK和示例

### 错误处理

所有API接口都使用统一的错误响应格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

## 🤝 贡献

欢迎提交Issue和Pull Request来改进这个项目。

## 📄 许可证

MIT License

## 📞 支持

如果您在使用过程中遇到问题，请：

1. 查看本README文档
2. 检查环境变量配置
3. 查看服务器日志
4. 在GitHub上提交Issue

---

**享受使用Kimi API的乐趣！** 🎉