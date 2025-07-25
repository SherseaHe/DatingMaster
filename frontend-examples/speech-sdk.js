/**
 * Speech API Frontend SDK
 * 语音转文字功能的前端SDK
 */
class SpeechClient {
  /**
   * 初始化语音客户端
   * @param {Object} config - 配置选项
   * @param {string} config.baseURL - API基础URL
   * @param {string} config.apiKey - API密钥（可选）
   * @param {number} config.timeout - 请求超时时间（毫秒）
   */
  constructor(config = {}) {
    this.baseURL = config.baseURL || 'http://localhost:3000';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 60000; // 语音处理需要更长时间
  }

  /**
   * 获取请求头
   * @returns {Object} 请求头对象
   */
  getHeaders() {
    const headers = {};
    
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    
    return headers;
  }

  /**
   * 语音转文字
   * @param {File|Blob} audioFile - 音频文件
   * @param {Object} options - 选项
   * @param {string} options.provider - 语音识别服务商
   * @param {string} options.language - 语言设置
   * @returns {Promise<Object>} 转换结果
   */
  async transcribe(audioFile, options = {}) {
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      if (options.provider) {
        formData.append('provider', options.provider);
      }
      if (options.language) {
        formData.append('language', options.language);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/api/speech/transcribe`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请尝试较小的音频文件');
      }
      throw error;
    }
  }

  /**
   * 语音对话（语音转文字 + AI回复）
   * @param {File|Blob} audioFile - 音频文件
   * @param {Object} options - 选项
   * @param {string} options.provider - 语音识别服务商
   * @param {string} options.language - 语言设置
   * @param {string} options.model - AI模型
   * @returns {Promise<Object>} 对话结果
   */
  async transcribeAndChat(audioFile, options = {}) {
    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      
      if (options.provider) {
        formData.append('provider', options.provider);
      }
      if (options.language) {
        formData.append('language', options.language);
      }
      if (options.model) {
        formData.append('model', options.model);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseURL}/api/speech/transcribe-and-chat`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时，请尝试较小的音频文件');
      }
      throw error;
    }
  }

  /**
   * 获取支持的音频格式
   * @returns {Promise<Object>} 格式列表
   */
  async getSupportedFormats() {
    try {
      const response = await fetch(`${this.baseURL}/api/speech/formats`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  /**
   * 获取可用的语音识别服务商
   * @returns {Promise<Object>} 服务商列表
   */
  async getProviders() {
    try {
      const response = await fetch(`${this.baseURL}/api/speech/providers`, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  }

  /**
   * 录制音频（使用浏览器API）
   * @param {Object} options - 录制选项
   * @param {number} options.maxDuration - 最大录制时长（秒）
   * @returns {Promise<Object>} 录制控制对象
   */
  async startRecording(options = {}) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true
        } 
      });

      const mediaRecorder = new MediaRecorder(stream);
      const audioChunks = [];
      const maxDuration = (options.maxDuration || 60) * 1000; // 转换为毫秒

      return new Promise((resolve, reject) => {
        mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          stream.getTracks().forEach(track => track.stop()); // 停止麦克风
          resolve({
            audioBlob,
            duration: Date.now() - startTime,
            size: audioBlob.size
          });
        };

        mediaRecorder.onerror = error => {
          stream.getTracks().forEach(track => track.stop());
          reject(error);
        };

        const startTime = Date.now();
        mediaRecorder.start();

        // 自动停止录制
        const stopTimer = setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, maxDuration);

        // 返回控制对象
        resolve({
          stop: () => {
            clearTimeout(stopTimer);
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.stop();
            }
          },
          pause: () => {
            if (mediaRecorder.state === 'recording') {
              mediaRecorder.pause();
            }
          },
          resume: () => {
            if (mediaRecorder.state === 'paused') {
              mediaRecorder.resume();
            }
          },
          getState: () => mediaRecorder.state
        });
      });
    } catch (error) {
      throw new Error(`无法访问麦克风: ${error.message}`);
    }
  }

  /**
   * 验证音频文件
   * @param {File} file - 音频文件
   * @returns {Object} 验证结果
   */
  validateAudioFile(file) {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const supportedTypes = [
      'audio/mp3', 'audio/mpeg',
      'audio/wav', 'audio/wave',
      'audio/m4a', 'audio/mp4',
      'audio/flac',
      'audio/ogg',
      'audio/webm'
    ];

    const result = {
      valid: true,
      errors: []
    };

    if (!file) {
      result.valid = false;
      result.errors.push('请选择音频文件');
      return result;
    }

    if (file.size > maxSize) {
      result.valid = false;
      result.errors.push(`文件大小超过限制 (${Math.round(maxSize / 1024 / 1024)}MB)`);
    }

    if (!supportedTypes.includes(file.type) && !this.isValidAudioExtension(file.name)) {
      result.valid = false;
      result.errors.push('不支持的音频格式');
    }

    return result;
  }

  /**
   * 检查文件扩展名
   * @param {string} filename - 文件名
   * @returns {boolean} 是否支持
   */
  isValidAudioExtension(filename) {
    const supportedExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.ogg', '.webm'];
    const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    return supportedExtensions.includes(ext);
  }

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string} 格式化后的大小
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 格式化持续时间
   * @param {number} milliseconds - 毫秒数
   * @returns {string} 格式化后的时间
   */
  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${remainingSeconds}秒`;
    }
  }
}

// 浏览器环境和Node.js环境兼容
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SpeechClient;
} else if (typeof window !== 'undefined') {
  window.SpeechClient = SpeechClient;
}

// 使用示例：
/*
// 1. 初始化客户端
const speechClient = new SpeechClient({
  baseURL: 'http://localhost:3000'
});

// 2. 语音转文字
const fileInput = document.getElementById('audioFile');
const file = fileInput.files[0];

try {
  const result = await speechClient.transcribe(file, {
    provider: 'openai',
    language: 'zh-CN'
  });
  console.log('转换结果:', result.data.text);
} catch (error) {
  console.error('转换失败:', error.message);
}

// 3. 语音对话
try {
  const result = await speechClient.transcribeAndChat(file, {
    provider: 'openai',
    language: 'zh-CN',
    model: 'moonshot-v1-8k'
  });
  console.log('识别文字:', result.data.transcription.text);
  console.log('AI回复:', result.data.response.message);
} catch (error) {
  console.error('对话失败:', error.message);
}

// 4. 录制音频
try {
  const recorder = await speechClient.startRecording({ maxDuration: 30 });
  
  // 手动停止录制
  setTimeout(() => {
    recorder.stop();
  }, 10000); // 10秒后停止
  
  const result = await recorder; // 等待录制完成
  console.log('录制完成:', result.audioBlob);
} catch (error) {
  console.error('录制失败:', error.message);
}
*/