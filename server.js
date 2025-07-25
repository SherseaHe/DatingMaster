require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// 导入路由
const chatRoutes = require('./routes/chat');
const { authenticateApiKey } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet());

// CORS配置
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true
}));

// 速率限制
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP最多100个请求
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// 解析JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Kimi API Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API信息端点
app.get('/api/info', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Kimi API Backend',
      version: '1.0.0',
      description: 'Node.js backend service integrated with Kimi API',
      endpoints: {
        'POST /api/chat/completion': '单轮对话',
        'POST /api/chat/history': '多轮对话',
        'POST /api/chat/stream': '流式对话',
        'GET /api/chat/models': '获取模型列表'
      }
    }
  });
});

// 应用认证中间件到API路由
app.use('/api/chat', authenticateApiKey, chatRoutes);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// 全局错误处理
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Kimi API Backend server is running on port ${PORT}`);
  console.log(`📖 API Documentation available at: http://localhost:${PORT}/api/info`);
  console.log(`💚 Health check available at: http://localhost:${PORT}/health`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 Running in development mode');
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

module.exports = app;