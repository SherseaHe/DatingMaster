/**
 * 科大讯飞星火大模型API调用
 */
class SparkAPI {
    constructor(config = {}) {
        this.config = {
            appId: '',
            apiKey: '',
            apiSecret: '',
            domain: 'general',
            url: 'wss://spark-api.xf-yun.com/v1.1/chat', // 使用最稳定的V1.1版本
            ...config
        };
        
        this.ws = null;
        this.messageId = this._generateMessageId();
        
        this.onmessage = null;  // 消息回调
        this.onerror = null;    // 错误回调
        this.onclose = null;    // 关闭回调
    }
    
    /**
     * 发送消息到星火大模型
     * @param {string} text 用户输入文本
     * @param {Array} history 历史对话记录，格式为 [{role: 'user|assistant', content: '内容'}]
     */
    async sendMessage(text, history = []) {
        if (!this.config.appId || !this.config.apiKey || !this.config.apiSecret) {
            this._onError('请先配置星火大模型API信息');
            return;
        }
        
        try {
            // 生成鉴权URL
            const url = this._getWebSocketUrl();
            
            // 关闭之前的连接
            if (this.ws) {
                this.ws.close();
            }
            
            // 创建WebSocket连接
            this.ws = new WebSocket(url);
            
            // 构建消息体
            const messages = [...history];
            messages.push({
                role: 'user',
                content: text
            });
            
            return new Promise((resolve, reject) => {
                let result = '';
                
                // 连接建立
                this.ws.onopen = () => {
                    console.log('星火大模型WebSocket连接已建立');
                    
                    // 发送消息
                    const params = this._buildRequest(messages);
                    this.ws.send(JSON.stringify(params));
                };
                
                // 接收消息
                this.ws.onmessage = (e) => {
                    try {
                        console.log("星火大模型响应:", e.data); // 添加详细日志
                        const response = JSON.parse(e.data);
                        
                        // 处理错误
                        if (response.header.code !== 0) {
                            const errorMsg = `星火大模型错误: ${response.header.message} (错误码: ${response.header.code})`;
                            console.error(errorMsg, response);
                            if (this.onerror) {
                                this.onerror(errorMsg);
                            }
                            reject(errorMsg);
                            return;
                        }
                        
                        // 解析结果 - V1.1版本的响应格式
                        try {
                            // V1.1版本的响应格式
                            if (response.payload && response.payload.choices && response.payload.choices.text) {
                                const content = response.payload.choices.text || '';
                                result += content;
                                
                                // 回调
                                if (this.onmessage) {
                                    this.onmessage({
                                        content,
                                        isEnd: response.header.status === 2,
                                        fullContent: result
                                    });
                                }
                                
                                // 如果是最后一条消息，关闭连接并返回结果
                                if (response.header.status === 2) {
                                    this.ws.close();
                                    resolve(result || '分析完成，但没有返回内容');
                                }
                            } else if (response.header.status === 2) {
                                // 如果是最后一条消息但没有内容，也要关闭连接并返回结果
                                this.ws.close();
                                resolve(result || '分析完成，但没有返回内容');
                            }
                        } catch (parseError) {
                            console.error('解析星火大模型响应内容失败:', parseError, response);
                        }
                    } catch (error) {
                        console.error('处理星火大模型响应失败:', error);
                        reject(error);
                    }
                };
                
                // 连接关闭
                this.ws.onclose = () => {
                    console.log('星火大模型WebSocket连接已关闭');
                    if (this.onclose) {
                        this.onclose();
                    }
                };
                
                // 连接错误
                this.ws.onerror = (e) => {
                    const errorMsg = '星火大模型WebSocket错误';
                    console.error(errorMsg, e);
                    if (this.onerror) {
                        this.onerror(errorMsg);
                    }
                    reject(errorMsg);
                };
            });
        } catch (error) {
            const errorMsg = `星火大模型连接失败: ${error.message}`;
            console.error(errorMsg, error);
            if (this.onerror) {
                this.onerror(errorMsg);
            }
            throw error;
        }
    }
    
    /**
     * 生成WebSocket鉴权URL
     */
    _getWebSocketUrl() {
        // 鉴权参数
        const apiKey = this.config.apiKey;
        const apiSecret = this.config.apiSecret;
        const host = this.config.url.replace('wss://', '').replace('ws://', '');
        
        // 当前时间戳
        const now = Math.floor(Date.now() / 1000);
        
        // 计算RFC1123格式的时间戳
        const date = new Date().toUTCString();
        
        // 拼接字符串 - 注意这里的路径要与URL匹配
        const signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v1.1/chat HTTP/1.1`;
        
        console.log("鉴权原始字符串:", signatureOrigin);
        
        // 使用HMAC-SHA256进行加密
        const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
        const signature = CryptoJS.enc.Base64.stringify(signatureSha);
        
        console.log("签名结果:", signature);
        
        // 拼接鉴权Url
        const authorizationOrigin = `api_key="${apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
        const authorization = btoa(authorizationOrigin);
        
        console.log("Authorization原始值:", authorizationOrigin);
        console.log("Authorization Base64值:", authorization);
        
        // 将鉴权信息放入URL
        const url = `${this.config.url}?authorization=${encodeURIComponent(authorization)}&date=${encodeURIComponent(date)}&host=${encodeURIComponent(host)}`;
        console.log("最终URL:", url);
        return url;
    }
    
    /**
     * 构建请求参数
     */
    _buildRequest(messages) {
        // 获取最后一条用户消息
        let userMessage = "你好";
        if (messages && messages.length > 0) {
            // 找到最后一条用户消息
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    userMessage = messages[i].content;
                    break;
                }
            }
        }
        
        // V1.1版本的请求格式
        return {
            header: {
                app_id: this.config.appId,
                uid: "user_" + Math.random().toString(36).substr(2, 9)
            },
            parameter: {
                chat: {
                    domain: this.config.domain,
                    temperature: 0.5,
                    max_tokens: 1024
                }
            },
            payload: {
                message: {
                    text: userMessage
                }
            }
        };
    }
    
    /**
     * 生成消息ID
     */
    _generateMessageId() {
        return 'message_' + Math.random().toString(36).substr(2, 9);
    }
    
    /**
     * 错误处理
     */
    _onError(message) {
        console.error(message);
        if (this.onerror) {
            this.onerror(message);
        }
    }
} 