# 实时语音转文字与智能分析应用

这是一个基于Web的实时语音转文字与智能分析应用，使用科大讯飞语音识别API和星火大模型API实现。

## 功能特点

- 实时录音并转换为文字
- 支持长时间录音
- 实时显示识别结果
- 支持复制、清空和下载识别文本
- 响应式设计，适配移动设备
- 星火大模型智能分析功能：
  - 内容摘要：提取文本主要内容和关键点
  - 情感分析：分析文本情感倾向和强度
  - 关键词提取：提取文本中最重要的关键词
  - 智能问答：基于文本内容回答问题
  - 备选方案：当无法连接星火大模型时，使用本地模拟分析

## 使用方法

1. 克隆或下载本项目
2. 在`app.js`文件中配置您的科大讯飞API信息：
   ```javascript
   const API_CONFIG = {
       appId: '您的AppID',
       apiKey: '您的APIKey',
       apiSecret: '您的APISecret',
       url: 'wss://iat-api.xfyun.cn/v2/iat'
   };
   
   const SPARK_CONFIG = {
       appId: '您的AppID',  // 可以使用同一个AppID
       apiKey: '您的APIKey',  // 可以使用同一个APIKey
       apiSecret: '您的APISecret',  // 可以使用同一个APISecret
       domain: 'generalv3'  // 使用通用大模型V3版本
   };
   ```
3. 在项目根目录下添加CryptoJS库（用于API鉴权）：
   ```html
   <script src="https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js"></script>
   ```
   或者下载后放入项目目录：
   ```html
   <script src="crypto-js.min.js"></script>
   ```
4. 使用Web服务器打开`index.html`文件（例如使用Visual Studio Code的Live Server插件）

## 科大讯飞API申请

1. 访问[科大讯飞开放平台](https://www.xfyun.cn/)
2. 注册并登录账号
3. 创建新应用
4. 添加"实时语音转写"能力和"星火认知大模型"能力
5. 获取AppID、APIKey和APISecret

## 注意事项

- 浏览器需要支持WebRTC和AudioContext
- 使用时需要授予麦克风访问权限
- 建议使用Chrome、Firefox或Edge浏览器
- 实际生产环境中，应将API密钥放在服务端进行鉴权，避免泄露

## 技术栈

- HTML5
- CSS3
- JavaScript (ES6+)
- WebRTC API
- Web Audio API
- WebSocket
- 科大讯飞实时语音转写API
- 科大讯飞星火认知大模型API

## 许可证

MIT 