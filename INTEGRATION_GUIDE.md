# 🔄 Audio2Text API 集成指南

## 📋 集成概述

您已经成功创建了语音转文字+Kimi对话的完整框架！现在需要将您现有的`audio2text_api`代码集成到框架中。

### 🎯 集成目标
```
🎤 音频输入 → 📝 您的audio2text_api → 💬 Kimi AI → 🤖 智能回复
```

## 🛠️ 集成步骤

### 步骤1: 找到集成位置

在文件 `services/audioToKimiService.js` 中，找到这个方法：

```javascript
async callYourAudio2TextAPI(audioData, options = {}) {
  // TODO: 在这里添加您的 audio2text_api 调用逻辑
  throw new Error('请在此处集成您的 audio2text_api 实现');
}
```

### 步骤2: 集成您的代码

根据您的`audio2text_api`实现方式，选择对应的集成方法：

#### 方式A: 如果您的audio2text_api是HTTP服务

```javascript
async callYourAudio2TextAPI(audioData, options = {}) {
  const FormData = require('form-data');
  const fetch = require('node-fetch'); // 如需要，请安装: npm install node-fetch
  
  try {
    const form = new FormData();
    form.append('audio', audioData, 'audio.wav');
    form.append('language', options.language || 'zh-CN');
    
    const response = await fetch('http://your-audio2text-api-url/transcribe', {
      method: 'POST',
      body: form,
      headers: {
        'Authorization': `Bearer ${process.env.AUDIO2TEXT_API_KEY}`,
        ...form.getHeaders()
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    return {
      text: result.text || result.transcript,
      confidence: result.confidence || 0.9,
      language: result.language,
      duration: result.duration
    };
  } catch (error) {
    throw new Error(`Audio2Text API调用失败: ${error.message}`);
  }
}
```

#### 方式B: 如果您的audio2text_api是本地模块

```javascript
async callYourAudio2TextAPI(audioData, options = {}) {
  try {
    // 导入您的audio2text模块
    const { transcribeAudio } = require('../path/to/your/audio2text_api');
    // 或者
    const Audio2TextService = require('../path/to/your/audio2text_service');
    
    // 调用您的API
    const result = await transcribeAudio(audioData, {
      language: options.language || 'zh-CN',
      format: 'wav'
    });
    
    return {
      text: result.text || result.transcript,
      confidence: result.confidence || 0.9,
      language: result.language,
      duration: result.duration
    };
  } catch (error) {
    throw new Error(`Audio2Text本地API调用失败: ${error.message}`);
  }
}
```

#### 方式C: 如果您使用第三方服务（如百度、腾讯云等）

```javascript
async callYourAudio2TextAPI(audioData, options = {}) {
  try {
    // 百度语音识别示例
    const BaiduSpeech = require('baidu-speech'); // 示例包名
    
    const client = new BaiduSpeech({
      appId: process.env.BAIDU_APP_ID,
      apiKey: process.env.BAIDU_API_KEY,
      secretKey: process.env.BAIDU_SECRET_KEY
    });
    
    const result = await client.recognize(audioData, {
      format: 'wav',
      rate: 16000,
      channel: 1,
      lan: options.language === 'zh-CN' ? 'zh' : 'en'
    });
    
    return {
      text: result.result?.[0] || '',
      confidence: result.confidence || 0.9,
      language: options.language,
      duration: result.duration
    };
  } catch (error) {
    throw new Error(`百度语音API调用失败: ${error.message}`);
  }
}
```

### 步骤3: 更新环境变量

在 `.env` 文件中添加您的API配置：

```env
# Audio2Text API Configuration
AUDIO_PROVIDER=your_provider_name
AUDIO_LANGUAGE=zh-CN
AUDIO_TIMEOUT=30000

# 如果使用HTTP API
AUDIO2TEXT_API_URL=http://your-api-url
AUDIO2TEXT_API_KEY=your_api_key

# 如果使用百度语音
BAIDU_APP_ID=your_baidu_app_id
BAIDU_API_KEY=your_baidu_api_key
BAIDU_SECRET_KEY=your_baidu_secret_key

# 如果使用腾讯云
TENCENT_SECRET_ID=your_secret_id
TENCENT_SECRET_KEY=your_secret_key

# 如果使用阿里云
ALIBABA_ACCESS_KEY_ID=your_access_key_id
ALIBABA_ACCESS_KEY_SECRET=your_access_key_secret
```

## 🧪 测试集成

### 1. 启动服务器
```bash
npm start
```

### 2. 测试集成状态
```bash
curl http://localhost:3000/api/voice-chat/test-integration
```

### 3. 测试完整流程
```bash
# 上传音频文件测试
curl -X POST http://localhost:3000/api/voice-chat/process \
  -F "audio=@your_audio_file.wav" \
  -F "model=moonshot-v1-8k" \
  -F "language=zh-CN"
```

## 📱 前端集成示例

创建前端页面测试语音对话功能：

```html
<!DOCTYPE html>
<html>
<head>
    <title>语音对话测试</title>
</head>
<body>
    <h2>🎤 语音对话测试</h2>
    
    <div>
        <input type="file" id="audioFile" accept="audio/*">
        <button onclick="processVoiceChat()">开始语音对话</button>
    </div>
    
    <div id="result"></div>

    <script>
        async function processVoiceChat() {
            const fileInput = document.getElementById('audioFile');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('请选择音频文件');
                return;
            }

            const formData = new FormData();
            formData.append('audio', file);
            formData.append('model', 'moonshot-v1-8k');
            formData.append('language', 'zh-CN');

            try {
                const response = await fetch('/api/voice-chat/process', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                
                if (result.success) {
                    document.getElementById('result').innerHTML = `
                        <h3>✅ 语音对话成功</h3>
                        <p><strong>您说：</strong>${result.data.transcription.text}</p>
                        <p><strong>Kimi回复：</strong>${result.data.aiResponse.message}</p>
                        <p><strong>处理时间：</strong>${result.data.processingTime}ms</p>
                    `;
                } else {
                    document.getElementById('result').innerHTML = `
                        <h3>❌ 处理失败</h3>
                        <p>${result.error}</p>
                    `;
                }
            } catch (error) {
                alert('请求失败: ' + error.message);
            }
        }
    </script>
</body>
</html>
```

## 🔧 常见问题解决

### 1. 音频格式问题
确保您的audio2text_api支持以下格式：
- WAV
- MP3  
- M4A
- FLAC
- OGG

### 2. 文件大小限制
当前限制为50MB，如需调整：
```javascript
// 在 routes/voiceChat.js 中修改
const upload = multer({
  limits: {
    fileSize: 100 * 1024 * 1024, // 改为100MB
  }
});
```

### 3. 超时设置
```javascript
// 在 services/audioToKimiService.js 中调整
this.audioConfig = {
  timeout: 60000, // 60秒超时
};
```

## 📊 API接口说明

集成完成后，您将拥有以下API接口：

| 接口 | 功能 | 说明 |
|------|------|------|
| `POST /api/voice-chat/process` | 基础语音对话 | 音频→文字→AI回复 |
| `POST /api/voice-chat/contextual` | 多轮语音对话 | 支持对话历史上下文 |
| `POST /api/voice-chat/stream` | 流式语音对话 | 实时流式AI回复 |
| `POST /api/voice-chat/batch` | 批量语音处理 | 同时处理多个音频文件 |
| `GET /api/voice-chat/status` | 服务状态 | 检查集成状态 |

## 🎯 下一步行动

1. **✅ 当前状态**: 集成框架已完成
2. **🔧 您需要做**: 在`callYourAudio2TextAPI`方法中添加您的audio2text_api代码
3. **🧪 测试**: 使用提供的测试接口验证集成
4. **🚀 部署**: 推送到GitHub并部署使用

完成集成后，您就拥有了一个完整的语音对话系统！🎉

---

**需要帮助？** 请告诉我您的audio2text_api的具体实现方式，我可以提供更详细的集成指导。