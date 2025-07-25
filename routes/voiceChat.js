const express = require('express');
const multer = require('multer');
const router = express.Router();
const AudioToKimiService = require('../services/audioToKimiService');

const audioToKimiService = new AudioToKimiService();

// 配置文件上传
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/ogg', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的音频格式'), false);
    }
  }
});

/**
 * POST /api/voice-chat/process
 * 语音转文字 + AI对话 - 完整流程
 */
router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传音频文件'
      });
    }

    const { model, language } = req.body;
    const options = {
      model: model || 'moonshot-v1-8k',
      language: language || 'zh-CN',
      startTime: Date.now()
    };

    console.log(`🎤 开始处理语音文件: ${req.file.originalname}, 大小: ${req.file.size} bytes`);

    const result = await audioToKimiService.processVoiceToChat(req.file.buffer, options);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('语音对话处理错误:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/voice-chat/contextual
 * 多轮语音对话
 */
router.post('/contextual', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传音频文件'
      });
    }

    const { model, language, conversationHistory } = req.body;
    
    // 解析对话历史
    let history = [];
    if (conversationHistory) {
      try {
        history = typeof conversationHistory === 'string' 
          ? JSON.parse(conversationHistory) 
          : conversationHistory;
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: '对话历史格式错误'
        });
      }
    }

    const options = {
      model: model || 'moonshot-v1-8k',
      language: language || 'zh-CN',
      startTime: Date.now()
    };

    console.log(`🔄 多轮语音对话 - 历史消息数: ${history.length}`);

    const result = await audioToKimiService.processVoiceToContextualChat(
      req.file.buffer, 
      history, 
      options
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('多轮语音对话错误:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/voice-chat/stream
 * 流式语音对话
 */
router.post('/stream', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: '请上传音频文件'
      });
    }

    // 设置SSE响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const { model, language } = req.body;
    const options = {
      model: model || 'moonshot-v1-8k',
      language: language || 'zh-CN',
      
      // 语音识别完成回调
      onTranscription: (transcription) => {
        res.write(`data: ${JSON.stringify({
          type: 'transcription',
          data: transcription
        })}\n\n`);
      },
      
      // AI回复片段回调
      onAIResponse: (content) => {
        res.write(`data: ${JSON.stringify({
          type: 'ai_response',
          content: content
        })}\n\n`);
      },
      
      // 完成回调
      onComplete: (result) => {
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          data: result
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      },
      
      // 错误回调
      onError: (error) => {
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: error.message
        })}\n\n`);
        res.end();
      }
    };

    console.log(`🌊 流式语音对话处理开始...`);

    await audioToKimiService.processVoiceToStreamChat(req.file.buffer, options);

  } catch (error) {
    console.error('流式语音对话错误:', error);
    res.write(`data: ${JSON.stringify({
      type: 'error',
      error: 'Internal server error'
    })}\n\n`);
    res.end();
  }
});

/**
 * POST /api/voice-chat/batch
 * 批量语音处理
 */
router.post('/batch', upload.array('audio', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: '请上传音频文件'
      });
    }

    const { model, language } = req.body;
    const options = {
      model: model || 'moonshot-v1-8k',
      language: language || 'zh-CN'
    };

    console.log(`📦 批量处理 ${req.files.length} 个音频文件...`);

    // 转换文件格式
    const audioFiles = req.files.map(file => ({
      buffer: file.buffer,
      filename: file.originalname,
      size: file.size
    }));

    const results = await audioToKimiService.processBatchVoiceToChat(audioFiles, options);

    res.json({
      success: true,
      data: {
        totalFiles: audioFiles.length,
        results: results,
        summary: {
          successful: results.filter(r => r.result.success).length,
          failed: results.filter(r => !r.result.success).length
        }
      }
    });

  } catch (error) {
    console.error('批量语音处理错误:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/voice-chat/status
 * 获取语音对话服务状态
 */
router.get('/status', (req, res) => {
  try {
    const status = audioToKimiService.getServiceStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('获取服务状态错误:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service status'
    });
  }
});

/**
 * POST /api/voice-chat/test-integration
 * 测试语音转文字和Kimi API的集成
 */
router.post('/test-integration', (req, res) => {
  try {
    // 测试配置
    const testResult = {
      audioService: 'pending', // 待您集成audio2text_api
      kimiService: 'available',
      integration: 'ready',
      message: '集成框架已就绪，请在 audioToKimiService.js 中添加您的 audio2text_api 实现'
    };

    res.json({
      success: true,
      data: testResult
    });
  } catch (error) {
    console.error('集成测试错误:', error);
    res.status(500).json({
      success: false,
      error: 'Integration test failed'
    });
  }
});

/**
 * 错误处理中间件
 */
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: '文件大小超过限制 (50MB)'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        error: '文件数量超过限制 (10个)'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message || 'Unknown error'
  });
});

module.exports = router;