# 🏠 本地测试指南

## 📋 测试前准备

### 1. 确认服务状态
打开终端/命令提示符，运行：
```bash
curl http://localhost:3000/health
```
应该看到：`{"success":true,"message":"Kimi API Backend is running"...}`

### 2. 快速集成测试
```bash
curl -X POST http://localhost:3000/api/voice-chat/test-integration
```

## 🎤 本地测试方法

### 方法1: 浏览器可视化测试 (最简单)

1. **打开测试页面**
   - Windows: 在文件资源管理器中双击 `xunfei-voice-chat.html`
   - Mac: 在Finder中双击 `xunfei-voice-chat.html`
   - Linux: 右键选择"用浏览器打开"

2. **录制测试音频**
   - 使用手机录制5-10秒中文语音
   - 保存为WAV或MP3格式
   - 内容建议："你好，我想测试语音对话功能"

3. **上传测试**
   - 拖拽音频文件到上传区域
   - 或点击选择文件
   - 点击"🚀 开始语音对话"

### 方法2: 命令行测试

1. **准备音频文件**
   ```bash
   # 将您的音频文件放在当前目录，比如 my_audio.wav
   ```

2. **基础语音对话测试**
   ```bash
   curl -X POST http://localhost:3000/api/voice-chat/process \
     -F "audio=@my_audio.wav" \
     -F "model=moonshot-v1-8k" \
     -F "language=zh_cn"
   ```

3. **多轮对话测试**
   ```bash
   curl -X POST http://localhost:3000/api/voice-chat/contextual \
     -F "audio=@my_audio.wav" \
     -F "model=moonshot-v1-8k" \
     -F "language=zh_cn" \
     -F 'conversationHistory=[{"role":"user","content":"你好"},{"role":"assistant","content":"你好！有什么可以帮您的吗？"}]'
   ```

### 方法3: 使用测试音频文件

我们已经为您准备了测试音频文件：

```bash
# 使用准备好的测试音频
curl -X POST http://localhost:3000/api/voice-chat/process \
  -F "audio=@test_audio.wav" \
  -F "model=moonshot-v1-8k" \
  -F "language=zh_cn"
```

## 📱 推荐测试流程

### 第1步：快速验证
```bash
curl -X POST http://localhost:3000/api/voice-chat/test-integration
```

### 第2步：浏览器测试
1. 双击打开 `xunfei-voice-chat.html`
2. 点击"🧪 测试集成"按钮
3. 确认显示"✅ 集成测试成功"

### 第3步：真实音频测试
1. 录制一段中文语音（5-10秒）
2. 上传到测试页面
3. 查看识别结果和AI回复

## 🎯 测试示例

### 录制建议内容：
- "你好，今天天气怎么样？"
- "请帮我介绍一下人工智能"
- "我想了解一下语音识别技术"

### 预期结果：
1. **讯飞识别**: 准确识别您说的中文
2. **Kimi回复**: 智能回答您的问题
3. **处理时间**: 通常3-5秒

## 🔧 故障排除

### 如果测试失败：

1. **检查服务状态**
   ```bash
   curl http://localhost:3000/health
   ```

2. **检查端口占用**
   ```bash
   # Windows
   netstat -an | findstr :3000
   
   # Mac/Linux  
   lsof -i :3000
   ```

3. **重启服务**
   ```bash
   # 停止服务 (Ctrl+C)
   # 重新启动
   npm start
   ```

4. **检查音频格式**
   - 确保使用WAV、MP3、M4A等支持格式
   - 文件大小不超过50MB

## 📊 测试结果解读

成功的测试结果应该包含：

```json
{
  "success": true,
  "data": {
    "transcription": {
      "text": "您说的内容",
      "confidence": 0.9,
      "language": "zh_cn",
      "provider": "xunfei"
    },
    "aiResponse": {
      "message": "Kimi的智能回复",
      "model": "moonshot-v1-8k"
    },
    "workflow": "xunfei-voice-to-kimi-ai"
  }
}
```

## 🎉 开始测试！

现在您可以开始本地测试了：

1. **首选方式**: 双击 `xunfei-voice-chat.html` 开始可视化测试
2. **命令行方式**: 使用上面的curl命令
3. **真实测试**: 录制自己的语音进行测试

**祝您测试愉快！** 🚀