const KimiService = require('./kimiService');

/**
 * 音频转文字 + Kimi对话集成服务
 * 负责协调语音识别和AI对话的完整流程
 */
class AudioToKimiService {
  constructor() {
    this.kimiService = new KimiService();
    // 这里可以配置您的语音识别服务
    this.audioConfig = {
      provider: process.env.AUDIO_PROVIDER || 'default',
      language: process.env.AUDIO_LANGUAGE || 'zh-CN',
      timeout: parseInt(process.env.AUDIO_TIMEOUT) || 30000
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
      console.log('🎤 开始语音对话流程...');
      
      // 第一步：语音转文字
      console.log('📝 步骤1: 语音转文字...');
      const transcriptionResult = await this.transcribeAudio(audioData, options);
      
      if (!transcriptionResult.success) {
        return {
          success: false,
          error: '语音识别失败: ' + transcriptionResult.error,
          step: 'transcription'
        };
      }

      const transcribedText = transcriptionResult.text;
      console.log(`✅ 语音识别结果: "${transcribedText}"`);

      // 第二步：发送给Kimi AI
      console.log('🤖 步骤2: AI对话处理...');
      const chatResult = await this.kimiService.chatCompletion(
        transcribedText,
        options.model || 'moonshot-v1-8k'
      );

      if (!chatResult.success) {
        return {
          success: false,
          error: 'AI对话失败: ' + chatResult.error,
          step: 'chat',
          transcription: transcriptionResult
        };
      }

      console.log('✅ AI回复生成完成');

      // 返回完整结果
      return {
        success: true,
        data: {
          transcription: {
            text: transcribedText,
            confidence: transcriptionResult.confidence,
            language: transcriptionResult.language,
            duration: transcriptionResult.duration
          },
          aiResponse: {
            message: chatResult.data.message,
            usage: chatResult.data.usage,
            model: chatResult.data.model
          },
          workflow: 'voice-to-text-to-ai',
          processingTime: Date.now() - (options.startTime || Date.now())
        }
      };

    } catch (error) {
      console.error('❌ 语音对话流程错误:', error);
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
      console.log('🎤 开始多轮语音对话...');
      
      // 第一步：语音转文字
      const transcriptionResult = await this.transcribeAudio(audioData, options);
      
      if (!transcriptionResult.success) {
        return {
          success: false,
          error: '语音识别失败: ' + transcriptionResult.error
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
          error: 'AI对话失败: ' + chatResult.error,
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
          workflow: 'contextual-voice-chat'
        }
      };

    } catch (error) {
      console.error('❌ 多轮语音对话错误:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 语音转文字处理
   * 这里集成您现有的 audio2text_api
   * @param {Buffer|File} audioData - 音频数据
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 转录结果
   */
  async transcribeAudio(audioData, options = {}) {
    try {
      // TODO: 在这里集成您的 audio2text_api 代码
      // 根据您的实际API接口进行调整
      
      // 示例实现 - 请根据您的实际API替换
      const result = await this.callYourAudio2TextAPI(audioData, options);
      
      return {
        success: true,
        text: result.text || result.transcript || result.content,
        confidence: result.confidence || 0.9,
        language: result.language || options.language || 'zh-CN',
        duration: result.duration || 0,
        provider: this.audioConfig.provider
      };

    } catch (error) {
      console.error('语音转文字错误:', error);
      return {
        success: false,
        error: error.message || '语音识别失败'
      };
    }
  }

  /**
   * 调用您的音频转文字API
   * 请根据您的实际API实现替换此方法
   */
  async callYourAudio2TextAPI(audioData, options = {}) {
    // TODO: 在这里添加您的 audio2text_api 调用逻辑
    
    // 示例代码结构 - 请根据您的实际API调整：
    
    // 方式1: 如果是HTTP API调用
    /*
    const FormData = require('form-data');
    const form = new FormData();
    form.append('audio', audioData, 'audio.wav');
    form.append('language', options.language || 'zh-CN');
    
    const response = await fetch('YOUR_AUDIO2TEXT_API_URL', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': `Bearer ${process.env.AUDIO_API_KEY}`
      }
    });
    
    return await response.json();
    */

    // 方式2: 如果是本地模块调用
    /*
    const { transcribeAudio } = require('../path/to/your/audio2text_api');
    return await transcribeAudio(audioData, options);
    */

    // 方式3: 如果是第三方服务
    /*
    const SpeechToTextV1 = require('ibm-watson/speech-to-text/v1');
    // 或者其他服务的SDK
    */

    // 临时实现 - 请替换为您的实际代码
    throw new Error('请在此处集成您的 audio2text_api 实现');
  }

  /**
   * 流式语音对话处理
   * @param {Buffer|File} audioData - 音频数据
   * @param {Object} options - 选项
   * @param {Function} onTranscription - 语音识别完成回调
   * @param {Function} onAIResponse - AI回复片段回调
   * @param {Function} onComplete - 完成回调
   * @param {Function} onError - 错误回调
   */
  async processVoiceToStreamChat(audioData, options = {}) {
    const { onTranscription, onAIResponse, onComplete, onError } = options;

    try {
      // 第一步：语音转文字
      const transcriptionResult = await this.transcribeAudio(audioData, options);
      
      if (!transcriptionResult.success) {
        onError && onError(new Error('语音识别失败: ' + transcriptionResult.error));
        return;
      }

      // 通知语音识别完成
      onTranscription && onTranscription(transcriptionResult);

      // 第二步：流式AI对话
      const streamResult = await this.kimiService.chatStream(transcriptionResult.text, options.model);

      if (!streamResult.success) {
        onError && onError(new Error('AI对话失败: ' + streamResult.error));
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
        workflow: 'stream-voice-chat'
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
        const result = await this.processVoiceToChat(audioFile, {
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
   * 获取服务状态和配置信息
   * @returns {Object} 服务状态
   */
  getServiceStatus() {
    return {
      audioConfig: this.audioConfig,
      kimiService: 'initialized',
      supportedLanguages: ['zh-CN', 'en-US', 'ja-JP'],
      maxAudioSize: '50MB',
      supportedFormats: ['mp3', 'wav', 'm4a', 'flac', 'ogg']
    };
  }
}

module.exports = AudioToKimiService;