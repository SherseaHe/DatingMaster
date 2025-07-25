/**
 * 录音处理类
 */
class Recorder {
    constructor(config = {}) {
        this.config = {
            sampleBits: 16,         // 采样位数
            sampleRate: 16000,      // 采样率
            numChannels: 1,         // 声道数
            compiling: false,       // 是否边录边转换
            ...config
        };
        
        this.audioContext = null;
        this.audioInput = null;
        this.recorder = null;
        this.analyser = null;
        this.audioData = {
            size: 0,
            buffer: [],
            inputSampleRate: 48000, // 输入采样率
            inputSampleBits: 16,    // 输入采样位数
            outputSampleRate: this.config.sampleRate, // 输出采样率
            oututSampleBits: this.config.sampleBits,  // 输出采样位数
            clear() {
                this.buffer = [];
                this.size = 0;
            }
        };
        
        this.isRecording = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.totalPauseTime = 0;
        
        this.onprogress = null;  // 录音过程回调
        this.onpause = null;     // 暂停回调
        this.onresume = null;    // 恢复回调
        this.onstop = null;      // 停止回调
        this.onerror = null;     // 错误回调
    }
    
    /**
     * 初始化录音
     */
    async initRecorder() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this._onError('浏览器不支持录音功能');
            return false;
        }
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: this.config.sampleRate,
                    channelCount: this.config.numChannels,
                    echoCancellation: true,      // 回声消除
                    noiseSuppression: true,      // 噪声抑制
                    autoGainControl: true        // 自动增益
                }
            });
            
            // 创建音频上下文
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.audioInput = this.audioContext.createMediaStreamSource(stream);
            this.analyser = this.audioContext.createAnalyser();
            this.recorder = this.audioContext.createScriptProcessor(4096, this.config.numChannels, this.config.numChannels);
            
            // 连接节点
            this.audioInput.connect(this.analyser);
            this.analyser.connect(this.recorder);
            this.recorder.connect(this.audioContext.destination);
            
            // 记录输入采样率
            this.audioData.inputSampleRate = this.audioContext.sampleRate;
            
            // 录音处理
            this.recorder.onaudioprocess = (e) => {
                if (!this.isRecording || this.isPaused) return;
                
                const audioBuffer = e.inputBuffer.getChannelData(0);
                const data = new Float32Array(audioBuffer);
                this.audioData.buffer.push(new Float32Array(data));
                this.audioData.size += data.length;
                
                // 如果边录边转，则直接获取数据
                if (this.config.compiling && this.onprogress) {
                    const wavBlob = this.getWAVBlob();
                    this.onprogress(wavBlob);
                }
            };
            
            return true;
        } catch (error) {
            this._onError(`录音初始化失败: ${error.message}`);
            return false;
        }
    }
    
    /**
     * 开始录音
     */
    async start() {
        if (this.isRecording) return;
        
        const initialized = await this.initRecorder();
        if (!initialized) return;
        
        this.isRecording = true;
        this.isPaused = false;
        this.startTime = Date.now();
        this.totalPauseTime = 0;
        this.audioData.clear();
    }
    
    /**
     * 暂停录音
     */
    pause() {
        if (!this.isRecording || this.isPaused) return;
        
        this.isPaused = true;
        this.pauseTime = Date.now();
        
        if (this.onpause) {
            this.onpause();
        }
    }
    
    /**
     * 恢复录音
     */
    resume() {
        if (!this.isRecording || !this.isPaused) return;
        
        this.isPaused = false;
        this.totalPauseTime += Date.now() - this.pauseTime;
        
        if (this.onresume) {
            this.onresume();
        }
    }
    
    /**
     * 停止录音
     */
    stop() {
        if (!this.isRecording) return;
        
        this.isRecording = false;
        this.isPaused = false;
        
        // 断开连接
        if (this.audioInput) {
            this.audioInput.disconnect();
            this.analyser.disconnect();
            this.recorder.disconnect();
        }
        
        // 关闭音频上下文
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        
        // 停止所有音轨
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
        
        if (this.onstop) {
            const duration = this.getDuration();
            const wavBlob = this.getWAVBlob();
            this.onstop(wavBlob, duration);
        }
    }
    
    /**
     * 获取录音时长（毫秒）
     */
    getDuration() {
        if (!this.startTime) return 0;
        
        if (this.isPaused) {
            return this.pauseTime - this.startTime - this.totalPauseTime;
        } else {
            return Date.now() - this.startTime - this.totalPauseTime;
        }
    }
    
    /**
     * 获取WAV格式的Blob对象
     */
    getWAVBlob() {
        const sampleRate = this.audioData.outputSampleRate;
        const sampleBits = this.audioData.oututSampleBits;
        const buffer = this.audioData.buffer;
        const size = this.audioData.size;
        
        // 合并音频数据
        const data = new Float32Array(size);
        let offset = 0;
        for (let i = 0; i < buffer.length; i++) {
            data.set(buffer[i], offset);
            offset += buffer[i].length;
        }
        
        // 压缩或扩展采样率
        let compression = this.audioData.inputSampleRate / sampleRate;
        let length = Math.floor(size / compression);
        let result = new Float32Array(length);
        let index = 0, j = 0;
        
        while (index < length) {
            result[index] = data[Math.floor(j)];
            j += compression;
            index++;
        }
        
        // 按采样位数重新编码
        let dataLength = result.length * (sampleBits / 8);
        let buffer8 = new ArrayBuffer(dataLength);
        let dataView = new DataView(buffer8);
        let offset8 = 0;
        
        // 写入采样数据
        if (sampleBits === 8) {
            for (let i = 0; i < result.length; i++, offset8++) {
                let val = Math.max(-1, Math.min(1, result[i]));
                val = val < 0 ? val * 0x8000 : val * 0x7FFF;
                val = parseInt(255 / (65535 / (val + 32768)));
                dataView.setInt8(offset8, val, true);
            }
        } else {
            for (let i = 0; i < result.length; i++, offset8 += 2) {
                let val = Math.max(-1, Math.min(1, result[i]));
                val = val < 0 ? val * 0x8000 : val * 0x7FFF;
                dataView.setInt16(offset8, val, true);
            }
        }
        
        // 创建WAV文件
        const WAV_HEAD_SIZE = 44;
        let wav = new ArrayBuffer(WAV_HEAD_SIZE + dataLength);
        let view = new DataView(wav);
        
        // RIFF chunk descriptor
        this._writeString(view, 0, 'RIFF');
        view.setUint32(4, 32 + dataLength, true);
        this._writeString(view, 8, 'WAVE');
        
        // fmt sub-chunk
        this._writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * (sampleBits / 8), true);
        view.setUint16(32, sampleBits / 8, true);
        view.setUint16(34, sampleBits, true);
        
        // data sub-chunk
        this._writeString(view, 36, 'data');
        view.setUint32(40, dataLength, true);
        
        // 写入PCM数据
        for (let i = 0; i < dataLength; i++) {
            view.setUint8(WAV_HEAD_SIZE + i, dataView.getUint8(i));
        }
        
        return new Blob([wav], { type: 'audio/wav' });
    }
    
    /**
     * 写入字符串
     */
    _writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
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