const express = require('express');
const multer = require('multer');
const router = express.Router();
const SpeechService = require('../services/speechService');

const speechService = new SpeechService();

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 限制
  },
  fileFilter: (req, file, cb) => {
    if (speechService.isValidAudioFormat(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的音频格式'), false);
    }
  }
});

/**
 * POST /api/speech/transcribe
 * 语音转文字接口
 */
router.post('/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传音频文件'
      });
    }

    const { provider, language } = req.body;
    const options = {
      provider: provider || 'openai',
      language: language || 'zh-CN'
    };

    console.log(`开始转换音频文件: ${req.file.originalname}, 大小: ${req.file.size} bytes`);

    const result = await speechService.transcribe(
      req.file.buffer,
      req.file.originalname,
      options
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('语音转文字错误:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/speech/transcribe-and-chat
 * 语音转文字 + AI对话组合接口
 */
router.post('/transcribe-and-chat', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传音频文件'
      });
    }

    const { provider, language, model } = req.body;
    
    // 第一步：语音转文字
    console.log('步骤1: 语音转文字...');
    const transcribeResult = await speechService.transcribe(
      req.file.buffer,
      req.file.originalname,
      { provider, language }
    );

    if (!transcribeResult.success) {
      return res.status(500).json(transcribeResult);
    }

    // 第二步：将转换的文字发送给Kimi
    console.log('步骤2: AI对话处理...');
    const KimiService = require('../services/kimiService');
    const kimiService = new KimiService();
    
    const chatResult = await kimiService.chatCompletion(
      transcribeResult.data.text,
      model || 'moonshot-v1-8k'
    );

    if (chatResult.success) {
      res.json({
        success: true,
        data: {
          transcription: transcribeResult.data,
          response: chatResult.data,
          workflow: 'speech-to-text-to-ai'
        }
      });
    } else {
      res.status(500).json(chatResult);
    }
  } catch (error) {
    console.error('语音对话流程错误:', error);
    res.status(500).json({
      success: false,
      error: 'Speech-to-chat workflow failed'
    });
  }
});

/**
 * GET /api/speech/formats
 * 获取支持的音频格式
 */
router.get('/formats', (req, res) => {
  try {
    const formats = speechService.getSupportedFormats();
    res.json({
      success: true,
      data: formats
    });
  } catch (error) {
    console.error('获取格式列表错误:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get supported formats'
    });
  }
});

/**
 * GET /api/speech/providers
 * 获取可用的语音识别服务提供商
 */
router.get('/providers', (req, res) => {
  try {
    const providers = [
      {
        id: 'openai',
        name: 'OpenAI Whisper',
        description: '高精度多语言语音识别',
        status: process.env.OPENAI_API_KEY ? 'available' : 'requires_api_key'
      },
      {
        id: 'google',
        name: 'Google Speech-to-Text',
        description: 'Google云语音识别服务',
        status: 'not_implemented'
      },
      {
        id: 'azure',
        name: 'Azure Speech Service',
        description: 'Microsoft Azure语音服务',
        status: 'not_implemented'
      },
      {
        id: 'baidu',
        name: '百度语音识别',
        description: '百度AI开放平台语音识别',
        status: 'not_implemented'
      }
    ];

    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('获取服务商列表错误:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get speech providers'
    });
  }
});

/**
 * POST /api/speech/test
 * 语音服务测试接口
 */
router.post('/test', (req, res) => {
  try {
    const { provider } = req.body;
    
    // 检查配置
    const config = {
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
      azure: !!(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION),
      baidu: !!(process.env.BAIDU_APP_ID && process.env.BAIDU_API_KEY)
    };

    res.json({
      success: true,
      data: {
        provider: provider || 'all',
        configuration: config,
        message: '语音服务配置检查完成'
      }
    });
  } catch (error) {
    console.error('语音服务测试错误:', error);
    res.status(500).json({
      success: false,
      error: 'Speech service test failed'
    });
  }
});

module.exports = router;