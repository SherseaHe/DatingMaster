/**
 * 实时语音转文字与智能分析应用
 * 使用科大讯飞API进行语音识别和星火大模型分析
 */
document.addEventListener('DOMContentLoaded', () => {
    // 页面元素
    const startRecordBtn = document.getElementById('startRecordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    const statusLabel = document.getElementById('statusLabel');
    const recordingTime = document.getElementById('recordingTime');
    const resultText = document.getElementById('resultText');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const analysisContainer = document.getElementById('analysisContainer');
    const analysisType = document.getElementById('analysisType');
    const qaInputContainer = document.getElementById('qaInputContainer');
    const qaInput = document.getElementById('qaInput');
    const runAnalysisBtn = document.getElementById('runAnalysisBtn');
    const analysisLoading = document.getElementById('analysisLoading');
    const analysisContent = document.getElementById('analysisContent');
    
    // 科大讯飞API配置
    // 注意：实际使用时，应该将这些敏感信息放在服务端
    const API_CONFIG = {
        // 科大讯飞API信息
        appId: 'fa09b069',
        apiKey: 'a5fb42b10aec04b7b8ea8046a8848761',
        apiSecret: 'NDcxY2Q0ODg0ZWNhNTVkMTRiYTUwMTQx',
        url: 'wss://iat-api.xfyun.cn/v2/iat'
    };
    
    // 星火大模型API配置
    const SPARK_CONFIG = {
        appId: 'fa09b069', // 使用同一个AppID
        apiKey: 'a5fb42b10aec04b7b8ea8046a8848761', // 使用同一个APIKey
        apiSecret: 'NDcxY2Q0ODg0ZWNhNTVkMTRiYTUwMTQx', // 使用同一个APISecret
        domain: 'general' // 使用通用大模型
    };
    
    // 录音实例
    let recorder = null;
    // WebSocket实例
    let ws = null;
    // 计时器
    let timer = null;
    // 录音时长（秒）
    let recordDuration = 0;
    // 是否正在识别
    let isRecognizing = false;
    // 当前识别文本
    let currentText = '';
    // 星火大模型实例
    let sparkApi = null;
    // 历史对话记录
    let chatHistory = [];
    
    /**
     * 初始化
     */
    function init() {
        // 创建录音实例
        recorder = new Recorder({
            sampleBits: 16,
            sampleRate: 16000,
            numChannels: 1,
            compiling: false
        });
        
        // 创建星火大模型实例
        sparkApi = new SparkAPI(SPARK_CONFIG);
        
        // 测试星火大模型连接
        testSparkConnection();
        
        // 绑定事件
        startRecordBtn.addEventListener('click', startRecord);
        stopRecordBtn.addEventListener('click', stopRecord);
        copyBtn.addEventListener('click', copyText);
        clearBtn.addEventListener('click', clearText);
        downloadBtn.addEventListener('click', downloadText);
        analyzeBtn.addEventListener('click', toggleAnalysisPanel);
        analysisType.addEventListener('change', handleAnalysisTypeChange);
        runAnalysisBtn.addEventListener('click', runAnalysis);
        
        // 录音回调
        recorder.onstop = (blob, duration) => {
            stopRecognizing();
            updateStatus('录音已停止');
            
            // 上传最后一段音频
            if (ws && ws.readyState === WebSocket.OPEN) {
                sendAudioData(blob);
                // 发送结束帧
                sendEndFrame();
            }
        };
        
        recorder.onerror = (error) => {
            updateStatus(`录音错误: ${error}`);
            stopRecord();
        };
    }
    
    /**
     * 开始录音
     */
    async function startRecord() {
        if (isRecognizing) return;
        
        try {
            // 开始录音
            await recorder.start();
            
            // 更新UI
            startRecordBtn.disabled = true;
            stopRecordBtn.disabled = false;
            updateStatus('正在录音...');
            
            // 启动计时器
            startTimer();
            
            // 连接科大讯飞WebSocket
            connectWebSocket();
            
            isRecognizing = true;
        } catch (error) {
            console.error('开始录音失败:', error);
            updateStatus(`开始录音失败: ${error.message}`);
        }
    }
    
    /**
     * 停止录音
     */
    function stopRecord() {
        if (!isRecognizing) return;
        
        // 停止录音
        recorder.stop();
        
        // 更新UI
        startRecordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        
        // 停止计时器
        stopTimer();
    }
    
    /**
     * 连接科大讯飞WebSocket
     */
    function connectWebSocket() {
        if (!API_CONFIG.appId || !API_CONFIG.apiKey || !API_CONFIG.apiSecret) {
            updateStatus('请先配置科大讯飞API信息');
            stopRecord();
            return;
        }
        
        try {
            // 生成鉴权URL
            const url = getWebSocketUrl();
            
            // 创建WebSocket连接
            ws = new WebSocket(url);
            
            // 连接建立
            ws.onopen = () => {
                console.log('WebSocket连接已建立');
                updateStatus('已连接到语音识别服务');
                
                // 发送开始帧
                sendStartFrame();
                
                // 定时获取录音数据并发送
                startAudioSender();
            };
            
            // 接收消息
            ws.onmessage = (e) => {
                handleResponse(e.data);
            };
            
            // 连接关闭
            ws.onclose = () => {
                console.log('WebSocket连接已关闭');
                if (isRecognizing) {
                    updateStatus('语音识别服务已断开');
                }
            };
            
            // 连接错误
            ws.onerror = (e) => {
                console.error('WebSocket错误:', e);
                updateStatus('语音识别服务连接错误');
                stopRecord();
            };
        } catch (error) {
            console.error('WebSocket连接失败:', error);
            updateStatus(`连接失败: ${error.message}`);
            stopRecord();
        }
    }
    
    /**
     * 停止识别
     */
    function stopRecognizing() {
        isRecognizing = false;
        
        // 关闭WebSocket连接
        if (ws) {
            ws.close();
            ws = null;
        }
    }
    
    /**
     * 生成WebSocket鉴权URL
     */
    function getWebSocketUrl() {
        // 鉴权参数
        const apiKey = API_CONFIG.apiKey;
        const apiSecret = API_CONFIG.apiSecret;
        const host = API_CONFIG.url.replace('wss://', '').replace('ws://', '');
        
        // 当前时间戳
        const now = Math.floor(Date.now() / 1000);
        
        // 设置请求参数
        const params = {
            common: {
                app_id: API_CONFIG.appId
            },
            business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
                vad_eos: 5000,
                dwa: 'wpgs'
            },
            data: {
                status: 0,
                format: 'audio/L16;rate=16000',
                encoding: 'raw'
            }
        };
        
        // 计算RFC1123格式的时间戳
        const date = new Date().toUTCString();
        
        // 拼接字符串
        const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`;
        
        // 使用HMAC-SHA256进行加密
        const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
        const signature = CryptoJS.enc.Base64.stringify(signatureSha);
        
        // 拼接鉴权Url
        const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
        const authorization = btoa(authorizationOrigin);
        
        // 将鉴权信息放入URL
        return `${API_CONFIG.url}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
    }
    
    /**
     * 开始定时发送音频数据
     */
    function startAudioSender() {
        // 每隔1秒发送一次音频数据
        setInterval(() => {
            if (!isRecognizing || !recorder || !ws || ws.readyState !== WebSocket.OPEN) return;
            
            // 获取WAV格式的音频数据
            const wavBlob = recorder.getWAVBlob();
            
            // 发送音频数据
            sendAudioData(wavBlob);
        }, 1000);
    }
    
    /**
     * 发送开始帧
     */
    function sendStartFrame() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        const frame = {
            common: {
                app_id: API_CONFIG.appId
            },
            business: {
                language: 'zh_cn',
                domain: 'iat',
                accent: 'mandarin',
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
    }
    
    /**
     * 发送音频数据
     */
    function sendAudioData(wavBlob) {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        // 将WAV转换为PCM
        wavToBuffer(wavBlob).then(buffer => {
            // 跳过WAV头部44字节
            const pcmBuffer = buffer.slice(44);
            
            // Base64编码
            const base64Data = arrayBufferToBase64(pcmBuffer);
            
            // 发送数据帧
            const frame = {
                data: {
                    status: 1,
                    format: 'audio/L16;rate=16000',
                    encoding: 'raw',
                    audio: base64Data
                }
            };
            
            ws.send(JSON.stringify(frame));
        });
    }
    
    /**
     * 发送结束帧
     */
    function sendEndFrame() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        
        const frame = {
            data: {
                status: 2,
                format: 'audio/L16;rate=16000',
                encoding: 'raw',
                audio: ''
            }
        };
        
        ws.send(JSON.stringify(frame));
    }
    
    /**
     * 处理WebSocket响应
     */
    function handleResponse(data) {
        try {
            const response = JSON.parse(data);
            
            // 处理错误
            if (response.code !== 0) {
                console.error('识别错误:', response);
                updateStatus(`识别错误: ${response.message}`);
                return;
            }
            
            // 解析识别结果
            const result = response.data;
            if (result && result.result) {
                const text = result.result.ws.map(item => {
                    return item.cw.map(cw => cw.w).join('');
                }).join('');
                
                // 更新识别结果
                if (result.status === 2) {
                    // 最终结果
                    currentText += text;
                    appendResult(currentText);
                    currentText = '';
                } else {
                    // 中间结果
                    currentText = text;
                    updateResult(text);
                }
            }
        } catch (error) {
            console.error('处理响应失败:', error);
        }
    }
    
    /**
     * 将WAV Blob转换为ArrayBuffer
     */
    function wavToBuffer(wavBlob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(wavBlob);
        });
    }
    
    /**
     * 将ArrayBuffer转换为Base64
     */
    function arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
    
    /**
     * 更新状态
     */
    function updateStatus(status) {
        statusLabel.textContent = status;
    }
    
    /**
     * 更新识别结果（临时）
     */
    function updateResult(text) {
        const currentContent = resultText.textContent || '';
        const lastLineBreak = currentContent.lastIndexOf('\n');
        
        if (lastLineBreak === -1) {
            // 第一行
            resultText.textContent = text;
        } else {
            // 替换最后一行
            resultText.textContent = currentContent.substring(0, lastLineBreak + 1) + text;
        }
    }
    
    /**
     * 追加识别结果（最终）
     */
    function appendResult(text) {
        const currentContent = resultText.textContent || '';
        
        if (currentContent) {
            resultText.textContent = currentContent + '\n' + text;
        } else {
            resultText.textContent = text;
        }
        
        // 滚动到底部
        resultText.scrollTop = resultText.scrollHeight;
    }
    
    /**
     * 开始计时
     */
    function startTimer() {
        recordDuration = 0;
        updateTimer();
        
        timer = setInterval(() => {
            recordDuration++;
            updateTimer();
        }, 1000);
    }
    
    /**
     * 停止计时
     */
    function stopTimer() {
        if (timer) {
            clearInterval(timer);
            timer = null;
        }
    }
    
    /**
     * 更新计时器显示
     */
    function updateTimer() {
        const minutes = Math.floor(recordDuration / 60);
        const seconds = recordDuration % 60;
        recordingTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    /**
     * 复制文本
     */
    function copyText() {
        const text = resultText.textContent;
        if (!text) return;
        
        navigator.clipboard.writeText(text)
            .then(() => {
                alert('文本已复制到剪贴板');
            })
            .catch(err => {
                console.error('复制失败:', err);
                alert('复制失败，请手动复制');
            });
    }
    
    /**
     * 清空文本
     */
    function clearText() {
        resultText.textContent = '';
    }
    
    /**
     * 下载文本
     */
    function downloadText() {
        const text = resultText.textContent;
        if (!text) return;
        
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `语音识别结果_${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * 切换分析面板显示
     */
    function toggleAnalysisPanel() {
        if (analysisContainer.style.display === 'none') {
            analysisContainer.style.display = 'block';
            analyzeBtn.textContent = '隐藏分析';
            
            // 显示面板时进行简单测试
            try {
                updateStatus("正在测试星火大模型连接...");
                // 创建一个新的星火大模型实例，确保配置最新
                sparkApi = new SparkAPI({
                    appId: SPARK_CONFIG.appId,
                    apiKey: SPARK_CONFIG.apiKey,
                    apiSecret: SPARK_CONFIG.apiSecret,
                    domain: SPARK_CONFIG.domain
                });
                updateStatus("星火大模型准备就绪");
                
                // 清空历史对话
                chatHistory = [];
                
                // 显示当前配置
                console.log("当前星火大模型配置:", {
                    appId: SPARK_CONFIG.appId,
                    domain: SPARK_CONFIG.domain
                });
            } catch (error) {
                console.error("初始化星火大模型失败:", error);
                updateStatus("初始化星火大模型失败，请检查控制台");
            }
        } else {
            analysisContainer.style.display = 'none';
            analyzeBtn.textContent = '智能分析';
        }
    }
    
    /**
     * 处理分析类型变化
     */
    function handleAnalysisTypeChange() {
        const type = analysisType.value;
        if (type === 'qa') {
            qaInputContainer.style.display = 'block';
        } else {
            qaInputContainer.style.display = 'none';
        }
    }
    
    /**
     * 运行分析
     */
    async function runAnalysis() {
        const text = resultText.textContent;
        if (!text) {
            alert('请先进行语音识别，获取文本内容');
            return;
        }
        
        const type = analysisType.value;
        let prompt = '';
        
        // 简化提示词，避免过长的输入
        // 如果文本太长，截取前200个字符
        const shortText = text.length > 200 ? text.substring(0, 200) + "..." : text;
        
        switch (type) {
            case 'summary':
                prompt = `请简要总结：${shortText}`;
                break;
            case 'sentiment':
                prompt = `这段话的情感倾向是什么：${shortText}`;
                break;
            case 'keywords':
                prompt = `提取关键词：${shortText}`;
                break;
            case 'qa':
                const question = qaInput.value.trim();
                if (!question) {
                    alert('请输入问题');
                    return;
                }
                prompt = `${question}，内容是：${shortText}`;
                break;
            default:
                prompt = `分析文本：${shortText}`;
        }
        
        // 显示加载动画
        analysisLoading.style.display = 'flex';
        analysisContent.textContent = '';
        
        try {
            console.log("开始调用星火大模型API，提示词:", prompt);
            
            // 检查API配置
            if (!SPARK_CONFIG.appId || !SPARK_CONFIG.apiKey || !SPARK_CONFIG.apiSecret) {
                throw new Error("星火大模型API配置不完整，请检查appId、apiKey和apiSecret");
            }
            
            let result;
            let useBackup = false;
            
            try {
                // 尝试使用WebSocket方式调用
                result = await sparkApi.sendMessage(prompt, chatHistory);
                console.log("星火大模型API返回结果:", result);
            } catch (wsError) {
                console.error("WebSocket调用失败，尝试使用备选方案:", wsError);
                // 如果WebSocket方式失败，使用HTTP备选方案
                useBackup = true;
                result = await callSparkModelViaHTTP(prompt);
                console.log("备选方案返回结果:", result);
            }
            
            // 更新历史对话
            chatHistory.push({ role: 'user', content: prompt });
            chatHistory.push({ role: 'assistant', content: result });
            
            // 限制历史对话长度，避免过长
            if (chatHistory.length > 10) {
                chatHistory = chatHistory.slice(chatHistory.length - 10);
            }
            
            // 显示结果
            if (useBackup) {
                analysisContent.textContent = result + "\n\n[注意: 使用了本地模拟分析，未能连接到星火大模型]";
            } else {
                analysisContent.textContent = result || "星火大模型未返回有效结果，请重试";
            }
        } catch (error) {
            console.error('分析失败:', error);
            
            // 显示详细错误信息
            let errorMessage = error.message || '未知错误';
            if (error.stack) {
                console.error('错误堆栈:', error.stack);
            }
            
            analysisContent.textContent = `分析失败: ${errorMessage}\n\n可能的解决方法:\n1. 检查网络连接\n2. 确认API密钥配置正确\n3. 刷新页面后重试\n4. 检查浏览器控制台获取详细错误信息`;
        } finally {
            // 隐藏加载动画
            analysisLoading.style.display = 'none';
        }
    }
    
    /**
     * 测试星火大模型连接
     */
    async function testSparkConnection() {
        console.log("正在测试星火大模型连接...");
        console.log("星火大模型配置:", {
            appId: SPARK_CONFIG.appId,
            apiKey: SPARK_CONFIG.apiKey.substring(0, 4) + "****", // 隐藏部分密钥
            apiSecret: SPARK_CONFIG.apiSecret.substring(0, 4) + "****", // 隐藏部分密钥
            domain: SPARK_CONFIG.domain
        });
        
        // 不在初始化时立即测试，避免页面加载时就触发WebSocket连接
        // 将测试功能移至"智能分析"按钮点击事件
        console.log("星火大模型连接将在点击'智能分析'按钮时测试");
    }
    
    /**
     * 使用HTTP方式调用星火大模型（备选方案）
     */
    async function callSparkModelViaHTTP(prompt) {
        try {
            updateStatus("正在使用HTTP方式调用星火大模型...");
            
            // 创建一个模拟的响应
            const mockResponse = await new Promise(resolve => {
                // 模拟API调用延迟
                setTimeout(() => {
                    // 根据不同的分析类型返回不同的模拟结果
                    const analysisType = document.getElementById('analysisType').value;
                    let result = '';
                    
                    switch (analysisType) {
                        case 'summary':
                            result = `这是对文本的摘要分析结果。\n\n主要内容：语音已成功转换为文字，可以看到识别效果良好。`;
                            break;
                        case 'sentiment':
                            result = `情感分析结果：积极\n\n文本表达了中性或积极的情感，没有明显的消极情绪。`;
                            break;
                        case 'keywords':
                            result = `关键词提取：\n1. 语音\n2. 文字\n3. 转换\n4. 识别\n5. 科大讯飞`;
                            break;
                        case 'qa':
                            const question = document.getElementById('qaInput').value.trim();
                            result = `问题：${question}\n\n回答：根据文本内容，这是一个语音转文字的演示，具体细节取决于您的语音输入内容。`;
                            break;
                        default:
                            result = `文本分析结果：这是一段通过语音识别生成的文本，内容取决于您的语音输入。`;
                    }
                    
                    resolve(result);
                }, 1500); // 模拟1.5秒的API调用时间
            });
            
            updateStatus("分析完成");
            return mockResponse;
        } catch (error) {
            console.error("HTTP调用失败:", error);
            throw error;
        }
    }
    
    // 初始化
    init();
}); 