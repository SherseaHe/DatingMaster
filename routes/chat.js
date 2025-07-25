const express = require('express');
const router = express.Router();
const KimiService = require('../services/kimiService');

const kimiService = new KimiService();

/**
 * POST /api/chat/completion
 * 单轮对话接口
 */
router.post('/completion', async (req, res) => {
  try {
    const { message, model } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    const result = await kimiService.chatCompletion(message, model);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Chat completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/chat/history
 * 多轮对话接口
 */
router.post('/history', async (req, res) => {
  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required and must not be empty'
      });
    }

    // 验证消息格式
    const isValidMessages = messages.every(msg => 
      msg.role && msg.content && 
      ['user', 'assistant', 'system'].includes(msg.role)
    );

    if (!isValidMessages) {
      return res.status(400).json({
        success: false,
        error: 'Invalid message format. Each message must have role and content'
      });
    }

    const result = await kimiService.chatWithHistory(messages, model);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Chat history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/chat/stream
 * 流式对话接口
 */
router.post('/stream', async (req, res) => {
  try {
    const { messages, model } = req.body;

    if (!messages) {
      return res.status(400).json({
        success: false,
        error: 'Messages is required'
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

    const result = await kimiService.chatStream(messages, model);

    if (result.success) {
      const stream = result.stream;

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } else {
      res.write(`data: ${JSON.stringify({ error: result.error })}\n\n`);
      res.end();
    }
  } catch (error) {
    console.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
    res.end();
  }
});

/**
 * GET /api/chat/models
 * 获取可用模型列表
 */
router.get('/models', async (req, res) => {
  try {
    const result = await kimiService.getModels();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;