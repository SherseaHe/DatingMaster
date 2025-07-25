/**
 * Kimi API Frontend SDK
 * 用于前端项目集成Kimi API的JavaScript SDK
 */
class KimiClient {
  /**
   * 初始化客户端
   * @param {Object} config - 配置选项
   * @param {string} config.baseURL - API基础URL
   * @param {string} config.apiKey - API密钥（可选）
   * @param {number} config.timeout - 请求超时时间（毫秒）
   */
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'http://localhost:3000';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  /**
   * 获取请求头
   * @returns {Object} 请求头对象
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };
    
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    
    return headers;
  }

  /**
   * 发送HTTP请求
   * @param {string} endpoint - 端点路径
   * @param {Object} options - 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: this.getHeaders(),
      ...options
    };

    // 添加超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      
      throw error;
    }
  }

  /**
   * 单轮对话
   * @param {string} message - 用户消息
   * @param {Object} options - 选项
   * @param {string} options.model - 模型名称
   * @returns {Promise<Object>} 响应结果
   */
  async chat(message, options = {}) {
    return await this.request('/api/chat/completion', {
      method: 'POST',
      body: JSON.stringify({
        message,
        model: options.model || 'moonshot-v1-8k'
      })
    });
  }

  /**
   * 多轮对话
   * @param {Array} messages - 消息历史
   * @param {Object} options - 选项
   * @param {string} options.model - 模型名称
   * @returns {Promise<Object>} 响应结果
   */
  async chatWithHistory(messages, options = {}) {
    return await this.request('/api/chat/history', {
      method: 'POST',
      body: JSON.stringify({
        messages,
        model: options.model || 'moonshot-v1-8k'
      })
    });
  }

  /**
   * 流式对话
   * @param {string|Array} messages - 消息或消息历史
   * @param {Object} options - 选项
   * @param {string} options.model - 模型名称
   * @param {Function} options.onMessage - 收到消息片段时的回调
   * @param {Function} options.onComplete - 完成时的回调
   * @param {Function} options.onError - 错误时的回调
   * @returns {Promise<void>}
   */
  async chatStream(messages, options = {}) {
    const {
      model = 'moonshot-v1-8k',
      onMessage,
      onComplete,
      onError
    } = options;

    try {
      const response = await fetch(`${this.baseURL}/api/chat/stream`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ messages, model })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // 保留不完整的行

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              onComplete && onComplete();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content && onMessage) {
                onMessage(parsed.content);
              } else if (parsed.error && onError) {
                onError(new Error(parsed.error));
                return;
              }
            } catch (e) {
              // 忽略JSON解析错误
            }
          }
        }
      }
    } catch (error) {
      onError && onError(error);
    }
  }

  /**
   * 获取可用模型列表
   * @returns {Promise<Object>} 模型列表
   */
  async getModels() {
    return await this.request('/api/chat/models', {
      method: 'GET'
    });
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 服务状态
   */
  async healthCheck() {
    return await this.request('/health', {
      method: 'GET'
    });
  }

  /**
   * 获取API信息
   * @returns {Promise<Object>} API信息
   */
  async getApiInfo() {
    return await this.request('/api/info', {
      method: 'GET'
    });
  }
}

// 浏览器环境和Node.js环境兼容
if (typeof module !== 'undefined' && module.exports) {
  module.exports = KimiClient;
} else if (typeof window !== 'undefined') {
  window.KimiClient = KimiClient;
}

// 使用示例：
/*
// 1. 初始化客户端
const client = new KimiClient({
  baseURL: 'http://localhost:3000',
  apiKey: 'your-api-key' // 可选
});

// 2. 单轮对话
try {
  const response = await client.chat('你好，请介绍一下你自己');
  console.log(response.data.message);
} catch (error) {
  console.error('Error:', error.message);
}

// 3. 多轮对话
const messages = [
  { role: 'user', content: '你好' },
  { role: 'assistant', content: '你好！我是Kimi。' },
  { role: 'user', content: '请告诉我今天的天气' }
];

try {
  const response = await client.chatWithHistory(messages);
  console.log(response.data.message);
} catch (error) {
  console.error('Error:', error.message);
}

// 4. 流式对话
await client.chatStream('请写一个简短的故事', {
  onMessage: (content) => {
    console.log(content); // 实时输出内容片段
  },
  onComplete: () => {
    console.log('对话完成');
  },
  onError: (error) => {
    console.error('流式对话错误:', error);
  }
});

// 5. 获取模型列表
try {
  const models = await client.getModels();
  console.log('可用模型:', models.data);
} catch (error) {
  console.error('Error:', error.message);
}
*/