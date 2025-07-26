const crypto = require('crypto');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

/**
 * 讯飞语音识别服务
 * 基于您现有的audio2text_api代码进行服务端集成
 */
class XunfeiAudioService {
  constructor(config = {}) {
    this.config = {
      appId: config.appId || process.env.XUNFEI_APP_ID || 'fa09b069',
      apiKey: config.apiKey || process.env.XUNFEI_API_KEY || 'a5fb42b10aec04b7b8ea8046a8848761',
      apiSecret: config.apiSecret || process.env.XUNFEI_API_SECRET || 'NDcxY2Q0ODg0ZWNhNTVkMTRiYTUwMTQx',
      url: config.url || process.env.XUNFEI_URL || 'wss://iat-api.xfyun.cn/v2/iat',
      language: config.language || 'zh_cn',
      accent: config.accent || 'mandarin',
      domain: config.domain || 'iat'
    };
  }

  /**
   * 语音转文字 - 主要接口
   * @param {Buffer} audioBuffer - 音频数据 (WAV格式)
   * @param {Object} options - 配置选项
   * @returns {Promise<Object>} 识别结果
   */
  async transcribe(audioBuffer, options = {}) {
    return new Promise((resolve, reject) => {
      try {
        console.log('🎤 开始讯飞语音识别...');
        
        // 验证音频数据
        if (!audioBuffer || audioBuffer.length === 0) {
          throw new Error('音频数据不能为空');
        }

        // 配置参数
        const config = {
          ...this.config,
          language: options.language || this.config.language,
          ...options
        };

        // 获取鉴权URL
        const wsUrl = this._getWebSocketUrl();
        console.log('🔗 连接讯飞API...');

        // 创建WebSocket连接
        const ws = new WebSocket(wsUrl);
        
        let recognitionResult = '';
        let isConnected = false;
        let timeout;

        // 设置超时（30秒）
        timeout = setTimeout(() => {
          ws.close();
          reject(new Error('语音识别超时'));
        }, 30000);

        // 连接成功
        ws.on('open', () => {
          console.log('✅ 讯飞WebSocket连接成功');
          isConnected = true;

          try {
            // 发送开始帧
            this._sendStartFrame(ws);

            // 处理音频数据并发送
            this._processAudioAndSend(ws, audioBuffer);

            // 发送结束帧
            setTimeout(() => {
              this._sendEndFrame(ws);
            }, 1000);

          } catch (error) {
            clearTimeout(timeout);
            reject(new Error(`发送音频数据失败: ${error.message}`));
          }
        });

        // 接收消息
        ws.on('message', (data) => {
          try {
            const response = JSON.parse(data.toString());
            
            // 检查错误
            if (response.code !== 0) {
              clearTimeout(timeout);
              ws.close();
              reject(new Error(`讯飞API错误: ${response.message} (代码: ${response.code})`));
              return;
            }

            // 解析识别结果
            const result = response.data;
            if (result && result.result && result.result.ws) {
              const text = result.result.ws.map(item => {
                return item.cw.map(cw => cw.w).join('');
              }).join('');

              if (result.status === 2) {
                // 最终结果
                recognitionResult += text;
                clearTimeout(timeout);
                ws.close();
                
                console.log(`✅ 讯飞识别完成: "${recognitionResult}"`);
                
                resolve({
                  success: true,
                  text: recognitionResult.trim(),
                  confidence: 0.9, // 讯飞API不直接提供置信度，使用默认值
                  language: config.language,
                  provider: 'xunfei',
                  duration: this._calculateDuration(audioBuffer)
                });
              } else {
                // 中间结果
                console.log(`🔄 识别中: "${text}"`);
              }
            }
          } catch (error) {
            console.error('解析讯飞响应失败:', error);
          }
        });

        // 连接错误
        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.error('讯飞WebSocket错误:', error);
          if (!isConnected) {
            reject(new Error(`讯飞WebSocket连接失败: ${error.message}`));
          }
        });

        // 连接关闭
        ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          console.log(`🔒 讯飞WebSocket连接关闭: ${code} - ${reason}`);
          
          if (!isConnected) {
            reject(new Error('讯飞WebSocket连接被关闭'));
          }
        });

      } catch (error) {
        console.error('讯飞语音识别初始化失败:', error);
        reject(new Error(`讯飞语音识别失败: ${error.message}`));
      }
    });
  }

  /**
   * 生成WebSocket鉴权URL
   * @returns {string} 鉴权URL
   */
  _getWebSocketUrl() {
    const { apiKey, apiSecret, url } = this.config;
    const host = url.replace('wss://', '').replace('ws://', '');
    
    // 当前时间戳
    const date = new Date().toUTCString();
    
    // 拼接字符串
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
    
    // 使用HMAC-SHA256进行加密
    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(signatureOrigin)
      .digest('base64');
    
    // 拼接鉴权信息
    const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
    const authorization = Buffer.from(authorizationOrigin).toString('base64');
    
    // 构建最终URL
    return `${url}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
  }

  /**
   * 发送开始帧
   * @param {WebSocket} ws - WebSocket连接
   */
  _sendStartFrame(ws) {
    const frame = {
      common: {
        app_id: this.config.appId
      },
      business: {
        language: this.config.language,
        domain: this.config.domain,
        accent: this.config.accent,
        vad_eos: 5000,
        dwa: 'wpgs'
      },
      data: {
        status: 0,
        format: 'audio/L16;rate=16000',
        encoding: 'raw'
      }
    };

    ws.send(JSON.stringify(frame));
    console.log('📤 发送开始帧');
  }

  /**
   * 处理音频数据并发送
   * @param {WebSocket} ws - WebSocket连接
   * @param {Buffer} audioBuffer - 音频数据
   */
  _processAudioAndSend(ws, audioBuffer) {
    try {
      // 如果是WAV格式，跳过头部44字节获取PCM数据
      let pcmData;
      if (this._isWavFile(audioBuffer)) {
        pcmData = audioBuffer.slice(44);
        console.log(`🎵 检测到WAV文件，提取PCM数据: ${pcmData.length} 字节`);
      } else {
        pcmData = audioBuffer;
        console.log(`🎵 使用原始音频数据: ${pcmData.length} 字节`);
      }

      // 分块发送音频数据（每次8192字节）
      const chunkSize = 8192;
      for (let i = 0; i < pcmData.length; i += chunkSize) {
        const chunk = pcmData.slice(i, i + chunkSize);
        
        const frame = {
          data: {
            status: 1,
            format: 'audio/L16;rate=16000',
            encoding: 'raw',
            audio: chunk.toString('base64')
          }
        };

        ws.send(JSON.stringify(frame));
        console.log(`📤 发送音频块: ${chunk.length} 字节`);
      }
    } catch (error) {
      throw new Error(`处理音频数据失败: ${error.message}`);
    }
  }

  /**
   * 发送结束帧
   * @param {WebSocket} ws - WebSocket连接
   */
  _sendEndFrame(ws) {
    const frame = {
      data: {
        status: 2,
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: ''
      }
    };

    ws.send(JSON.stringify(frame));
    console.log('📤 发送结束帧');
  }

  /**
   * 检查是否为WAV文件
   * @param {Buffer} buffer - 音频数据
   * @returns {boolean} 是否为WAV文件
   */
  _isWavFile(buffer) {
    if (buffer.length < 12) return false;
    
    // 检查WAV文件头 "RIFF" 和 "WAVE"
    const riff = buffer.toString('ascii', 0, 4);
    const wave = buffer.toString('ascii', 8, 12);
    
    return riff === 'RIFF' && wave === 'WAVE';
  }

  /**
   * 计算音频时长（估算）
   * @param {Buffer} audioBuffer - 音频数据
   * @returns {number} 时长（毫秒）
   */
  _calculateDuration(audioBuffer) {
    try {
      if (this._isWavFile(audioBuffer)) {
        // WAV文件时长计算
        const pcmData = audioBuffer.slice(44);
        const sampleRate = 16000; // 16kHz
        const bytesPerSample = 2; // 16-bit
        const channels = 1; // 单声道
        
        const samples = pcmData.length / (bytesPerSample * channels);
        return Math.round((samples / sampleRate) * 1000);
      } else {
        // 估算时长（假设16kHz单声道16-bit）
        const sampleRate = 16000;
        const bytesPerSample = 2;
        const samples = audioBuffer.length / bytesPerSample;
        return Math.round((samples / sampleRate) * 1000);
      }
    } catch (error) {
      console.warn('计算音频时长失败:', error);
      return 0;
    }
  }

  /**
   * 测试API连接
   * @returns {Promise<Object>} 测试结果
   */
  async testConnection() {
    try {
      // 创建一个短暂的测试音频（1秒的静音）
      const testAudio = this._generateTestAudio();
      
      const result = await this.transcribe(testAudio);
      
      return {
        success: true,
        message: '讯飞API连接测试成功',
        config: {
          appId: this.config.appId.substring(0, 8) + '***',
          language: this.config.language,
          domain: this.config.domain
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `讯飞API连接测试失败: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * 生成测试音频（1秒静音WAV）
   * @returns {Buffer} 测试音频数据
   */
  _generateTestAudio() {
    const sampleRate = 16000;
    const duration = 1; // 1秒
    const samples = sampleRate * duration;
    
    // WAV头部 (44字节)
    const header = Buffer.alloc(44);
    
    // RIFF chunk
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + samples * 2, 4);
    header.write('WAVE', 8);
    
    // fmt chunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);   // PCM
    header.writeUInt16LE(1, 22);   // 单声道
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * 2, 28);
    header.writeUInt16LE(2, 32);   // 块对齐
    header.writeUInt16LE(16, 34);  // 位深度
    
    // data chunk
    header.write('data', 36);
    header.writeUInt32LE(samples * 2, 40);
    
    // 静音数据
    const silenceData = Buffer.alloc(samples * 2, 0);
    
    return Buffer.concat([header, silenceData]);
  }

  /**
   * 获取服务状态
   * @returns {Object} 服务状态信息
   */
  getStatus() {
    return {
      provider: 'xunfei',
      appId: this.config.appId.substring(0, 8) + '***',
      language: this.config.language,
      domain: this.config.domain,
      accent: this.config.accent,
      url: this.config.url,
      supportedFormats: ['wav', 'pcm'],
      maxDuration: '60秒',
      description: '科大讯飞语音识别服务'
    };
  }
}

module.exports = XunfeiAudioService;