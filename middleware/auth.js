/**
 * 简单的API Key认证中间件
 * 这里提供一个基础的认证框架，可以根据需要扩展
 */
const authenticateApiKey = (req, res, next) => {
  // 从header中获取API key
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

  // 如果是开发环境或没有设置API key要求，则跳过认证
  if (process.env.NODE_ENV === 'development' && !process.env.REQUIRE_API_KEY) {
    return next();
  }

  // 这里可以添加你的API key验证逻辑
  // 例如：从数据库验证、与预设的key比较等
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];

  if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Invalid API key'
    });
  }

  next();
};

module.exports = {
  authenticateApiKey
};