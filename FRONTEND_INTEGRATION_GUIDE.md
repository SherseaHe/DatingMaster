# 🎤 前端实时录音集成指南

## 📋 功能概述

为前端同事提供的实时录音语音识别+AI对话解决方案。按下录音按钮开始录音，松开自动调用讯飞模型转文字，然后交给Kimi处理生成回复。

## 🔌 WebSocket连接

### **连接地址**
```javascript
const wsUrl = `ws://localhost:3000/api/realtime-voice`;
// 生产环境: wss://your-domain.com/api/realtime-voice
```

### **连接示例**
```javascript
const ws = new WebSocket('ws://localhost:3000/api/realtime-voice');

ws.onopen = () => {
    console.log('实时语音连接已建立');
};

ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    handleMessage(message);
};
```

## 🎙️ 录音流程

### **1. 开始录音**
```javascript
// 发送开始录音消息
ws.send(JSON.stringify({
    type: 'start_recording',
    language: 'zh_cn',  // 或 'en_us'
    model: 'moonshot-v1-8k'  // Kimi模型
}));

// 开始媒体录音
mediaRecorder.start(100); // 每100ms发送一次数据
```

### **2. 发送音频数据**
```javascript
mediaRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
        // 直接发送音频Blob数据
        ws.send(event.data);
    }
};
```

### **3. 停止录音**
```javascript
// 停止媒体录音
mediaRecorder.stop();

// 发送停止录音消息
ws.send(JSON.stringify({
    type: 'stop_recording'
}));
```

## 📨 消息协议

### **发送消息格式**

#### **开始录音**
```json
{
    "type": "start_recording",
    "language": "zh_cn",
    "model": "moonshot-v1-8k",
    "streamMode": false
}
```

#### **切换录音状态（实时模式）**
```json
{
    "type": "toggle_recording",
    "language": "zh_cn",
    "model": "moonshot-v1-8k",
    "streamMode": true
}
```

#### **停止录音**
```json
{
    "type": "stop_recording"
}
```

#### **清除历史**
```json
{
    "type": "clear_history"
}
```

#### **更新配置**
```json
{
    "type": "config",
    "language": "zh_cn",
    "model": "moonshot-v1-32k"
}
```

### **接收消息格式**

#### **连接成功**
```json
{
    "type": "connected",
    "sessionId": "voice_1234567890_abc123",
    "message": "实时语音识别连接已建立",
    "timestamp": "2024-01-01T12:00:00.000Z"
}
```

#### **录音开始**
```json
{
    "type": "recording_started",
    "message": "开始录音",
    "config": {
        "language": "zh_cn",
        "model": "moonshot-v1-8k"
    }
}
```

#### **录音进度**
```json
{
    "type": "recording_progress",
    "audioSize": 12345,
    "duration": 2500
}
```

#### **处理状态**
```json
{
    "type": "processing",
    "step": "transcription",
    "message": "正在进行语音识别..."
}
```

#### **识别结果**
```json
{
    "type": "transcription_result",
    "data": {
        "text": "您说的内容",
        "confidence": 0.95,
        "language": "zh_cn",
        "duration": 2500
    }
}
```

#### **实时识别结果**
```json
{
    "type": "stream_transcription",
    "data": {
        "text": "部分识别内容",
        "confidence": 0.85,
        "isPartial": true,
        "timestamp": 1704067200000
    }
}
```

#### **最终识别结果**
```json
{
    "type": "final_transcription",
    "data": {
        "text": "完整识别内容",
        "partialCount": 3,
        "totalDuration": 5000
    }
}
```

#### **完整结果（传统模式）**
```json
{
    "type": "complete_result",
    "data": {
        "transcription": {
            "text": "您说的内容",
            "confidence": 0.95,
            "language": "zh_cn",
            "duration": 2500
        },
        "aiResponse": {
            "message": "Kimi的智能回复",
            "usage": {
                "prompt_tokens": 10,
                "completion_tokens": 50,
                "total_tokens": 60
            },
            "model": "moonshot-v1-8k"
        },
        "conversationHistory": [
            {"role": "user", "content": "您说的内容"},
            {"role": "assistant", "content": "Kimi的智能回复"}
        ],
        "processingTime": 3500
    }
}
```

#### **流式完整结果**
```json
{
    "type": "stream_complete_result",
    "data": {
        "transcription": {
            "text": "最终合并的识别内容",
            "partialResults": [
                {"text": "部分1", "timestamp": 1704067200000},
                {"text": "部分2", "timestamp": 1704067202000}
            ],
            "totalDuration": 5000
        },
        "aiResponse": {
            "message": "Kimi的智能回复",
            "usage": {...},
            "model": "moonshot-v1-8k"
        },
        "conversationHistory": [...],
        "processingTime": 5500
    }
}
```

#### **错误消息**
```json
{
    "type": "error",
    "error": "错误描述信息"
}
```

## 🎤 前端录音实现

### **获取麦克风权限**
```javascript
async function setupMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            }
        });
        
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        return true;
    } catch (error) {
        console.error('无法访问麦克风:', error);
        return false;
    }
}
```

### **录音按钮实现**
```javascript
const recordButton = document.getElementById('recordButton');

// 按下开始录音
recordButton.addEventListener('mousedown', () => {
    startRecording();
});

// 松开停止录音
recordButton.addEventListener('mouseup', () => {
    stopRecording();
});

// 处理触摸设备
recordButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startRecording();
});

recordButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopRecording();
});
```

## 📱 React集成示例

```jsx
import React, { useState, useEffect, useRef } from 'react';

const VoiceChat = () => {
    const [ws, setWs] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [status, setStatus] = useState('disconnected');
    const [messages, setMessages] = useState([]);
    const [currentTranscription, setCurrentTranscription] = useState('');
    const [streamMode, setStreamMode] = useState(true);
    const mediaRecorderRef = useRef(null);

    useEffect(() => {
        // 初始化WebSocket
        const websocket = new WebSocket('ws://localhost:3000/api/realtime-voice');
        
        websocket.onopen = () => {
            setStatus('connected');
            setWs(websocket);
        };
        
        websocket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            handleMessage(message);
        };
        
        websocket.onclose = () => {
            setStatus('disconnected');
        };

        return () => {
            websocket.close();
        };
    }, []);

    const handleMessage = (message) => {
        switch (message.type) {
            case 'complete_result':
            case 'stream_complete_result':
                setMessages(prev => [
                    ...prev,
                    { type: 'user', content: message.data.transcription.text },
                    { type: 'assistant', content: message.data.aiResponse.message }
                ]);
                break;
            case 'stream_transcription':
                // 显示实时识别结果
                setCurrentTranscription(message.data.text);
                break;
            case 'final_transcription':
                // 清除实时识别，显示最终结果
                setCurrentTranscription('');
                break;
            case 'error':
                console.error('语音识别错误:', message.error);
                break;
        }
    };

    const toggleRecording = async () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        if (isRecording) {
            // 停止录音
            if (mediaRecorderRef.current) {
                mediaRecorderRef.current.stop();
            }
            
            if (streamMode) {
                ws.send(JSON.stringify({ type: 'toggle_recording' }));
            } else {
                ws.send(JSON.stringify({ type: 'stop_recording' }));
            }
            
            setIsRecording(false);
        } else {
            // 开始录音
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                const mediaRecorder = new MediaRecorder(stream);
                mediaRecorderRef.current = mediaRecorder;

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        ws.send(event.data);
                    }
                };

                // 发送开始录音消息
                ws.send(JSON.stringify({
                    type: streamMode ? 'toggle_recording' : 'start_recording',
                    language: 'zh_cn',
                    model: 'moonshot-v1-8k',
                    streamMode: streamMode
                }));

                mediaRecorder.start(100);
                setIsRecording(true);
            } catch (error) {
                console.error('开始录音失败:', error);
            }
        }
    };

    return (
        <div>
            <div>状态: {status}</div>
            
            <div>
                <label>
                    <input 
                        type="checkbox" 
                        checked={streamMode} 
                        onChange={(e) => setStreamMode(e.target.checked)} 
                    />
                    实时流式识别
                </label>
            </div>
            
            <button
                onClick={toggleRecording}
                disabled={status !== 'connected'}
                style={{
                    backgroundColor: isRecording ? 'red' : 'green',
                    color: 'white',
                    border: 'none',
                    borderRadius: '50%',
                    width: '100px',
                    height: '100px',
                    fontSize: '24px'
                }}
            >
                {isRecording ? (streamMode ? '⏹️' : '🔴') : '🎤'}
            </button>
            
            <div>{streamMode ? '点击录音，实时识别' : '按住录音，松开处理'}</div>

            <div>
                {currentTranscription && (
                    <div style={{
                        padding: '10px',
                        margin: '5px',
                        backgroundColor: '#fff3cd',
                        borderRadius: '8px',
                        fontStyle: 'italic',
                        border: '2px dashed #ffc107'
                    }}>
                        <strong>👤 您 (实时):</strong> {currentTranscription}
                    </div>
                )}
                
                {messages.map((msg, index) => (
                    <div key={index} style={{
                        padding: '10px',
                        margin: '5px',
                        backgroundColor: msg.type === 'user' ? '#e3f2fd' : '#f1f8e9',
                        borderRadius: '8px'
                    }}>
                        <strong>{msg.type === 'user' ? '👤 您' : '🤖 Kimi'}:</strong> {msg.content}
                    </div>
                ))}
            </div>
        </div>
    );
};

export default VoiceChat;
```

## 🎯 Vue.js集成示例

```vue
<template>
  <div class="voice-chat">
    <div class="status">状态: {{ status }}</div>
    
    <button
      @mousedown="startRecording"
      @mouseup="stopRecording"
      :disabled="status !== 'connected'"
      :class="{ recording: isRecording }"
      class="record-button"
    >
      {{ isRecording ? '🔴' : '🎤' }}
    </button>

    <div class="messages">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="['message', message.type]"
      >
        <strong>{{ message.type === 'user' ? '👤 您' : '🤖 Kimi' }}:</strong>
        {{ message.content }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'VoiceChat',
  data() {
    return {
      ws: null,
      isRecording: false,
      status: 'disconnected',
      messages: [],
      mediaRecorder: null
    };
  },
  mounted() {
    this.initWebSocket();
  },
  beforeDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  },
  methods: {
    initWebSocket() {
      this.ws = new WebSocket('ws://localhost:3000/api/realtime-voice');
      
      this.ws.onopen = () => {
        this.status = 'connected';
      };
      
      this.ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      };
      
      this.ws.onclose = () => {
        this.status = 'disconnected';
      };
    },
    
    handleMessage(message) {
      if (message.type === 'complete_result') {
        this.messages.push(
          { type: 'user', content: message.data.transcription.text },
          { type: 'assistant', content: message.data.aiResponse.message }
        );
      }
    },
    
    async startRecording() {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.mediaRecorder = new MediaRecorder(stream);

        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.ws.send(event.data);
          }
        };

        this.ws.send(JSON.stringify({
          type: 'start_recording',
          language: 'zh_cn',
          model: 'moonshot-v1-8k'
        }));

        this.mediaRecorder.start(100);
        this.isRecording = true;
      } catch (error) {
        console.error('开始录音失败:', error);
      }
    },
    
    stopRecording() {
      if (this.mediaRecorder) {
        this.mediaRecorder.stop();
      }
      
      if (this.ws) {
        this.ws.send(JSON.stringify({ type: 'stop_recording' }));
      }
      
      this.isRecording = false;
    }
  }
};
</script>

<style>
.record-button {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  border: none;
  background: green;
  color: white;
  font-size: 24px;
  cursor: pointer;
}

.record-button.recording {
  background: red;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

.message.user {
  background: #e3f2fd;
  text-align: right;
}

.message.assistant {
  background: #f1f8e9;
}
</style>
```

## 🔧 配置选项

### **语言支持**
- `zh_cn`: 中文
- `en_us`: 英文

### **AI模型**
- `moonshot-v1-8k`: 8K上下文
- `moonshot-v1-32k`: 32K上下文  
- `moonshot-v1-128k`: 128K上下文

### **音频设置**
- 采样率: 16kHz (推荐)
- 声道: 单声道
- 格式: WebM/Opus

## 🚀 开始使用

1. **确保后端服务运行**: `npm start`
2. **打开测试页面**: `frontend-examples/realtime-voice-chat.html`
3. **允许麦克风权限**
4. **按住录音按钮开始对话**

## 📞 技术支持

如果在集成过程中遇到问题：

1. 检查WebSocket连接状态
2. 确认麦克风权限已授予
3. 查看浏览器控制台错误信息
4. 测试网络连接和服务器状态

**现在您的前端同事可以轻松集成实时录音语音对话功能了！** 🎉