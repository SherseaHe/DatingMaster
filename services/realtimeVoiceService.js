const WebSocket = require('ws');
const XunfeiAudioService = require('./xunfeiAudioService');
const KimiService = require('./kimiService');

/**
 * 实时语音识别WebSocket服务
 * 支持前端实时录音，后端实时转文字并处理
 */
class RealtimeVoiceService {
  constructor() {
    this.xunfeiService = new XunfeiAudioService();
    this.kimiService = new KimiService();
    this.activeSessions = new Map(); // 存储活跃的语音会话
  }

  /**
   * 创建WebSocket服务器
   * @param {Object} server - HTTP服务器实例
   */
  createWebSocketServer(server) {
    const wss = new WebSocket.Server({ 
      server,
      path: '/api/realtime-voice'
    });

    wss.on('connection', (ws, req) => {
      console.log('🎤 新的实时语音连接建立');
      
      const sessionId = this.generateSessionId();
      const session = {
        id: sessionId,
        ws: ws,
        audioBuffer: Buffer.alloc(0),
        isRecording: false,
        conversationHistory: [],
        language: 'zh_cn',
        model: 'moonshot-v1-8k',
        startTime: Date.now()
      };

      this.activeSessions.set(sessionId, session);

      // 发送连接成功消息
      this.sendMessage(ws, {
        type: 'connected',
        sessionId: sessionId,
        message: '实时语音识别连接已建立'
      });

      // 处理客户端消息
      ws.on('message', async (data) => {
        try {
          await this.handleClientMessage(sessionId, data);
        } catch (error) {
          console.error('处理客户端消息失败:', error);
          this.sendError(ws, '处理消息失败: ' + error.message);
        }
      });

      // 处理连接关闭
      ws.on('close', () => {
        console.log(`🔒 实时语音连接关闭: ${sessionId}`);
        this.activeSessions.delete(sessionId);
      });

      // 处理连接错误
      ws.on('error', (error) => {
        console.error(`❌ WebSocket错误 ${sessionId}:`, error);
        this.activeSessions.delete(sessionId);
      });
    });

    console.log('🌐 实时语音WebSocket服务器已启动: /api/realtime-voice');
    return wss;
  }

  /**
   * 处理客户端消息
   * @param {string} sessionId - 会话ID
   * @param {Buffer|string} data - 客户端数据
   */
  async handleClientMessage(sessionId, data) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // 尝试解析JSON消息
      const message = JSON.parse(data.toString());
      await this.handleControlMessage(sessionId, message);
    } catch (e) {
      // 如果不是JSON，当作音频数据处理
      await this.handleAudioData(sessionId, data);
    }
  }

  /**
   * 处理控制消息
   * @param {string} sessionId - 会话ID
   * @param {Object} message - 控制消息
   */
  async handleControlMessage(sessionId, message) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    switch (message.type) {
      case 'start_recording':
        await this.startRecording(sessionId, message);
        break;
      
      case 'stop_recording':
        await this.stopRecording(sessionId);
        break;
      
      case 'config':
        this.updateConfig(sessionId, message);
        break;
      
      case 'clear_history':
        this.clearHistory(sessionId);
        break;
      
      default:
        console.log(`未知消息类型: ${message.type}`);
    }
  }

  /**
   * 开始录音
   * @param {string} sessionId - 会话ID
   * @param {Object} config - 录音配置
   */
  async startRecording(sessionId, config = {}) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.isRecording = true;
    session.audioBuffer = Buffer.alloc(0);
    session.language = config.language || 'zh_cn';
    session.model = config.model || 'moonshot-v1-8k';
    session.startTime = Date.now();

    this.sendMessage(session.ws, {
      type: 'recording_started',
      message: '开始录音',
      config: {
        language: session.language,
        model: session.model
      }
    });

    console.log(`🎤 开始录音: ${sessionId}`);
  }

  /**
   * 停止录音并处理
   * @param {string} sessionId - 会话ID
   */
  async stopRecording(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isRecording) return;

    session.isRecording = false;

    this.sendMessage(session.ws, {
      type: 'recording_stopped',
      message: '录音结束，处理中...'
    });

    console.log(`🛑 停止录音: ${sessionId}, 音频大小: ${session.audioBuffer.length} 字节`);

    // 处理录音数据
    if (session.audioBuffer.length > 0) {
      await this.processRecordedAudio(sessionId);
    } else {
      this.sendError(session.ws, '录音数据为空');
    }
  }

  /**
   * 处理音频数据
   * @param {string} sessionId - 会话ID
   * @param {Buffer} audioData - 音频数据
   */
  async handleAudioData(sessionId, audioData) {
    const session = this.activeSessions.get(sessionId);
    if (!session || !session.isRecording) return;

    // 累积音频数据
    session.audioBuffer = Buffer.concat([session.audioBuffer, audioData]);

    // 发送录音状态更新
    this.sendMessage(session.ws, {
      type: 'recording_progress',
      audioSize: session.audioBuffer.length,
      duration: Date.now() - session.startTime
    });
  }

  /**
   * 处理录制的音频
   * @param {string} sessionId - 会话ID
   */
  async processRecordedAudio(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    try {
      // 第1步：讯飞语音识别
      this.sendMessage(session.ws, {
        type: 'processing',
        step: 'transcription',
        message: '正在进行语音识别...'
      });

      const audioBuffer = this.convertToWav(session.audioBuffer);
      const transcriptionResult = await this.xunfeiService.transcribe(audioBuffer, {
        language: session.language
      });

      if (!transcriptionResult.success) {
        throw new Error('语音识别失败: ' + transcriptionResult.error);
      }

      const transcribedText = transcriptionResult.text;
      console.log(`📝 识别结果: "${transcribedText}"`);

      // 发送识别结果
      this.sendMessage(session.ws, {
        type: 'transcription_result',
        data: {
          text: transcribedText,
          confidence: transcriptionResult.confidence,
          language: transcriptionResult.language,
          duration: transcriptionResult.duration
        }
      });

      // 第2步：Kimi AI处理
      this.sendMessage(session.ws, {
        type: 'processing',
        step: 'ai_response',
        message: '正在生成AI回复...'
      });

      // 构建对话历史
      const messages = [
        ...session.conversationHistory,
        { role: 'user', content: transcribedText }
      ];

      const chatResult = await this.kimiService.chatWithHistory(messages, session.model);

      if (!chatResult.success) {
        throw new Error('AI对话失败: ' + chatResult.error);
      }

      // 更新对话历史
      session.conversationHistory = [
        ...messages,
        { role: 'assistant', content: chatResult.data.message }
      ];

      console.log('🤖 AI回复生成完成');

      // 发送最终结果
      this.sendMessage(session.ws, {
        type: 'complete_result',
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
          conversationHistory: session.conversationHistory,
          processingTime: Date.now() - session.startTime
        }
      });

    } catch (error) {
      console.error('处理录音失败:', error);
      this.sendError(session.ws, error.message);
    }
  }

  /**
   * 转换音频为WAV格式
   * @param {Buffer} audioBuffer - 原始音频数据
   * @returns {Buffer} WAV格式音频
   */
  convertToWav(audioBuffer) {
    // 如果已经是WAV格式，直接返回
    if (audioBuffer.length > 12 && 
        audioBuffer.toString('ascii', 0, 4) === 'RIFF' && 
        audioBuffer.toString('ascii', 8, 12) === 'WAVE') {
      return audioBuffer;
    }

    // 简单的WAV头部构建（假设16kHz, 16-bit, 单声道）
    const sampleRate = 16000;
    const bitsPerSample = 16;
    const channels = 1;
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;
    const dataSize = audioBuffer.length;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);
    
    // RIFF chunk
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(channels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);

    return Buffer.concat([header, audioBuffer]);
  }

  /**
   * 更新配置
   * @param {string} sessionId - 会话ID
   * @param {Object} config - 新配置
   */
  updateConfig(sessionId, config) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    if (config.language) session.language = config.language;
    if (config.model) session.model = config.model;

    this.sendMessage(session.ws, {
      type: 'config_updated',
      config: {
        language: session.language,
        model: session.model
      }
    });
  }

  /**
   * 清除对话历史
   * @param {string} sessionId - 会话ID
   */
  clearHistory(sessionId) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;

    session.conversationHistory = [];

    this.sendMessage(session.ws, {
      type: 'history_cleared',
      message: '对话历史已清除'
    });
  }

  /**
   * 发送消息给客户端
   * @param {WebSocket} ws - WebSocket连接
   * @param {Object} message - 消息对象
   */
  sendMessage(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString()
      }));
    }
  }

  /**
   * 发送错误消息
   * @param {WebSocket} ws - WebSocket连接
   * @param {string} error - 错误信息
   */
  sendError(ws, error) {
    this.sendMessage(ws, {
      type: 'error',
      error: error
    });
  }

  /**
   * 生成会话ID
   * @returns {string} 会话ID
   */
  generateSessionId() {
    return 'voice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * 获取活跃会话统计
   * @returns {Object} 统计信息
   */
  getSessionStats() {
    return {
      activeSessions: this.activeSessions.size,
      sessions: Array.from(this.activeSessions.values()).map(session => ({
        id: session.id,
        isRecording: session.isRecording,
        audioBufferSize: session.audioBuffer.length,
        conversationLength: session.conversationHistory.length,
        uptime: Date.now() - session.startTime
      }))
    };
  }
}

module.exports = RealtimeVoiceService;