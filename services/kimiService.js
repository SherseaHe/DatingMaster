const OpenAI = require('openai');

class KimiService {
  constructor() {
    this.client = new OpenAI({
      baseURL: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
      apiKey: process.env.KIMI_API_KEY
    });
  }

  /**
   * 单轮对话
   * @param {string} message - 用户消息
   * @param {string} model - 模型名称，默认为 moonshot-v1-8k
   * @returns {Promise<Object>} 响应结果
   */
  async chatCompletion(message, model = 'moonshot-v1-8k') {
    try {
      const completion = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.3,
      });

      return {
        success: true,
        data: {
          message: completion.choices[0].message.content,
          usage: completion.usage,
          model: completion.model
        }
      };
    } catch (error) {
      console.error('Kimi API Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * 多轮对话
   * @param {Array} messages - 消息历史数组
   * @param {string} model - 模型名称
   * @returns {Promise<Object>} 响应结果
   */
  async chatWithHistory(messages, model = 'moonshot-v1-8k') {
    try {
      // 验证消息格式
      if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages must be a non-empty array');
      }

      const completion = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.3,
      });

      return {
        success: true,
        data: {
          message: completion.choices[0].message.content,
          usage: completion.usage,
          model: completion.model
        }
      };
    } catch (error) {
      console.error('Kimi API Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * 流式对话（实时返回）
   * @param {Array|string} messages - 消息或消息历史
   * @param {string} model - 模型名称
   * @returns {Promise<ReadableStream>} 流式响应
   */
  async chatStream(messages, model = 'moonshot-v1-8k') {
    try {
      // 如果是字符串，转换为消息格式
      if (typeof messages === 'string') {
        messages = [{ role: 'user', content: messages }];
      }

      const stream = await this.client.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.3,
        stream: true,
      });

      return {
        success: true,
        stream: stream
      };
    } catch (error) {
      console.error('Kimi Stream API Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * 获取可用模型列表
   * @returns {Promise<Object>} 模型列表
   */
  async getModels() {
    try {
      const models = await this.client.models.list();
      return {
        success: true,
        data: models.data
      };
    } catch (error) {
      console.error('Get Models Error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error occurred'
      };
    }
  }
}

module.exports = KimiService;