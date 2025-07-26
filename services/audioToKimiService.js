const KimiService = require('./kimiService');
const XunfeiAudioService = require('./xunfeiAudioService');

/**
 * 音频转文字 + Kimi对话集成服务
 * 基于讯飞语音识别API和Kimi AI的完整语音对话系统
 */
class AudioToKimiService {
  constructor() {
    this.kimiService = new KimiService();
    this.xunfeiService = new XunfeiAudioService();
    
    this.audioConfig = {
      provider: 'xunfei',
      language: 'zh_cn',
      timeout: 30000
    };
  }

  /**
   * 处理语音文件并生成AI回复
   * @param {Buffer|File} audioData - 音频数据
   * @param {Object} options - 选项配置
   * @returns {Promise<Object>} 完整的处理结果
   */
  async processVoiceToChat(audioData, options = {}) {
    try {
      console.log('🎤 开始讯飞语音对话流程...');
      
      // 第一步：讯飞语音转文字
      console.log('📝 步骤1: 讯飞语音识别...');
      const transcriptionResult = await this.transcribeAudio(audioData, options);
      
      if (!transcriptionResult.success) {
        return {
          success: false,
          error: '讯飞语音识别失败: ' + transcriptionResult.error,
          step: 'transcription'
        };
      }

      const transcribedText = transcriptionResult.text;
      console.log(`✅ 讯飞识别结果: "${transcribedText}"`);

      // 第二步：发送给Kimi AI
      console.log('🤖 步骤2: Kimi AI对话处理...');
      const chatResult = await this.kimiService.chatCompletion(
        transcribedText,
        options.model || 'moonshot-v1-8k'
      );

      if (!chatResult.success) {
        return {
          success: false,
          error: 'Kimi AI对话失败: ' + chatResult.error,
          step: 'chat',
          transcription: transcriptionResult
        };
      }

      console.log('✅ Kimi AI回复生成完成');

      // 返回完整结果
      return {
        success: true,
        data: {
          transcription: {
            text: transcribedText,
            confidence: transcriptionResult.confidence,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration,
            provider: 'xunfei'
          },
          aiResponse: {
            message: chatResult.data.message,
            usage: chatResult.data.usage,
            model: chatResult.data.model
          },
          workflow: 'xunfei-voice-to-kimi-ai',
          processingTime: Date.now() - (options.startTime || Date.now())
        }
      };

    } catch (error) {
      console.error('❌ 讯飞语音对话流程错误:', error);
      return {
        success: false,
        error: error.message || '语音对话处理失败',
        step: 'unknown'
      };
    }
  }

  /**
   * 多轮语音对话
   * @param {Buffer|File} audioData - 音频数据
   * @param {Array} conversationHistory - 对话历史
   * @param {Object} options - 选项配置
   * @returns {Promise<Object>} 处理结果
   */
  async processVoiceToContextualChat(audioData, conversationHistory = [], options = {}) {
    try {
      console.log('🎤 开始多轮讯飞语音对话...');
      
      // 第一步：讯飞语音转文字
      const transcriptionResult = await this.transcribeAudio(audioData, options);
      
      if (!transcriptionResult.success) {
        return {
          success: false,
          error: '讯飞语音识别失败: ' + transcriptionResult.error
        };
      }

      // 第二步：构建对话历史
      const messages = [
        ...conversationHistory,
        {
          role: 'user',
          content: transcriptionResult.text
        }
      ];

      // 第三步：发送给Kimi AI
      const chatResult = await this.kimiService.chatWithHistory(
        messages,
        options.model || 'moonshot-v1-8k'
      );

      if (!chatResult.success) {
        return {
          success: false,
          error: 'Kimi AI对话失败: ' + chatResult.error,
          transcription: transcriptionResult
        };
      }

      // 更新对话历史
      const updatedHistory = [
        ...messages,
        {
          role: 'assistant',
          content: chatResult.data.message
        }
      ];

      return {
        success: true,
        data: {
          transcription: transcriptionResult,
          aiResponse: chatResult.data,
          conversationHistory: updatedHistory,
          workflow: 'contextual-xunfei-voice-chat'
        }
      };

    } catch (error) {
      console.error('❌ 多轮讯飞语音对话错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 流式语音对话处理
   * @param {Buffer|File} audioData - 音频数据
   * @param {Object} options - 选项
   */
  async processVoiceToStreamChat(audioData, options = {}) {
    const { onTranscription, onAIResponse, onComplete, onError } = options;

    try {
      // 第一步：讯飞语音转文字
      const transcriptionResult = await this.transcribeAudio(audioData, options);
      
      if (!transcriptionResult.success) {
        onError && onError(new Error('讯飞语音识别失败: ' + transcriptionResult.error));
        return;
      }

      // 通知语音识别完成
      onTranscription && onTranscription(transcriptionResult);

      // 第二步：流式Kimi AI对话
      const streamResult = await this.kimiService.chatStream(transcriptionResult.text, options.model);

      if (!streamResult.success) {
        onError && onError(new Error('Kimi AI对话失败: ' + streamResult.error));
        return;
      }

      // 处理流式响应
      const stream = streamResult.stream;
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content && onAIResponse) {
          onAIResponse(content);
        }
      }

      onComplete && onComplete({
        transcription: transcriptionResult,
        workflow: 'stream-xunfei-voice-chat'
      });

    } catch (error) {
      onError && onError(error);
    }
  }

  /**
   * 批量处理多个音频文件
   * @param {Array} audioFiles - 音频文件数组
   * @param {Object} options - 选项
   * @returns {Promise<Array>} 处理结果数组
   */
  async processBatchVoiceToChat(audioFiles, options = {}) {
    const results = [];
    
    for (let i = 0; i < audioFiles.length; i++) {
      const audioFile = audioFiles[i];
      console.log(`🔄 处理第 ${i + 1}/${audioFiles.length} 个音频文件...`);
      
      try {
        const result = await this.processVoiceToChat(audioFile.buffer || audioFile, {
          ...options,
          startTime: Date.now()
        });
        
        results.push({
          index: i,
          filename: audioFile.filename || `audio_${i}`,
          result
        });
        
      } catch (error) {
        results.push({
          index: i,
          filename: audioFile.filename || `audio_${i}`,
          result: {
            success: false,
            error: error.message
          }
        });
      }
    }
    
    return results;
  }

  /**
   * 讯飞语音转文字处理 - 核心集成方法
   * @param {Buffer|File} audioData - 音频数据
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 转录结果
   */
  async transcribeAudio(audioData, options = {}) {
    try {
      console.log('🎤 调用讯飞语音识别...');
      
      // 处理音频数据
      let audioBuffer;
      if (Buffer.isBuffer(audioData)) {
        audioBuffer = audioData;
      } else if (audioData.buffer) {
        audioBuffer = audioData.buffer;
      } else {
        throw new Error('无效的音频数据格式');
      }

      // 调用讯飞语音识别服务
      const result = await this.xunfeiService.transcribe(audioBuffer, {
        language: options.language || 'zh_cn'
      });

      return {
        success: true,
        text: result.text,
        confidence: result.confidence,
        language: result.language,
        duration: result.duration,
        provider: result.provider
      };

    } catch (error) {
      console.error('讯飞语音转文字错误:', error);
      return {
        success: false,
        error: error.message || '讯飞语音识别失败'
      };
    }
  }

  /**
   * 测试讯飞API和Kimi API的集成
   * @returns {Promise<Object>} 测试结果
   */
  async testIntegration() {
    try {
      console.log('🧪 开始集成测试...');
      
      // 1. 测试讯飞API连接
      console.log('1️⃣ 测试讯飞API...');
      const xunfeiTest = await this.xunfeiService.testConnection();
      
      if (!xunfeiTest.success) {
        return {
          success: false,
          error: '讯飞API测试失败: ' + xunfeiTest.message,
          details: { xunfei: xunfeiTest }
        };
      }

      // 2. 测试Kimi API连接
      console.log('2️⃣ 测试Kimi API...');
      const kimiTest = await this.kimiService.chatCompletion('测试连接', 'moonshot-v1-8k');
      
      if (!kimiTest.success) {
        return {
          success: false,
          error: 'Kimi API测试失败: ' + kimiTest.error,
          details: { xunfei: xunfeiTest, kimi: kimiTest }
        };
      }

      console.log('✅ 集成测试全部通过');
      
      return {
        success: true,
        message: '讯飞语音识别+Kimi AI集成测试成功',
        details: {
          xunfei: xunfeiTest,
          kimi: {
            success: true,
            message: 'Kimi API连接正常',
            response: kimiTest.data.message.substring(0, 50) + '...'
          },
          integration: 'ready'
        }
      };

    } catch (error) {
      console.error('❌ 集成测试失败:', error);
      return {
        success: false,
        error: '集成测试失败: ' + error.message
      };
    }
  }

  /**
   * 获取服务状态和配置信息
   * @returns {Object} 服务状态
   */
  getServiceStatus() {
    return {
      audioService: this.xunfeiService.getStatus(),
      kimiService: 'initialized',
      integration: 'xunfei + kimi',
      supportedLanguages: ['zh_cn', 'en_us'],
      maxAudioSize: '50MB',
      supportedFormats: ['wav', 'mp3', 'm4a', 'flac'],
      workflow: [
        '1. 音频上传',
        '2. 讯飞语音识别',
        '3. Kimi AI对话',
        '4. 返回结果'
      ]
    };
  }
}

module.exports = AudioToKimiService;