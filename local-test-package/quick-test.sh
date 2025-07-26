#!/bin/bash

echo "🎤 讯飞语音对话本地测试脚本"
echo "================================"

# 检查服务状态
echo "📊 检查服务状态..."
if curl -s http://localhost:3000/health > /dev/null; then
    echo "✅ 服务运行正常"
else
    echo "❌ 服务未运行，请先启动服务: npm start"
    exit 1
fi

# 运行集成测试
echo ""
echo "🧪 运行集成测试..."
curl -s -X POST http://localhost:3000/api/voice-chat/test-integration | grep -q '"success":true' && echo "✅ 集成测试通过" || echo "❌ 集成测试失败"

# 测试音频文件
echo ""
echo "🎵 测试音频文件处理..."
if [ -f "test_audio.wav" ]; then
    echo "📁 找到测试音频文件: test_audio.wav"
    echo "🚀 开始语音对话测试..."
    
    result=$(curl -s -X POST http://localhost:3000/api/voice-chat/process \
        -F "audio=@test_audio.wav" \
        -F "model=moonshot-v1-8k" \
        -F "language=zh_cn")
    
    if echo "$result" | grep -q '"success":true'; then
        echo "✅ 语音对话测试成功！"
        echo ""
        echo "📝 识别结果："
        echo "$result" | grep -o '"text":"[^"]*"' | cut -d'"' -f4
        echo ""
        echo "🤖 AI回复："
        echo "$result" | grep -o '"message":"[^"]*"' | cut -d'"' -f4 | head -c 100
        echo "..."
    else
        echo "❌ 语音对话测试失败"
        echo "错误信息: $result"
    fi
else
    echo "❌ 未找到测试音频文件"
fi

echo ""
echo "🌐 浏览器测试:"
echo "请双击打开 xunfei-voice-chat.html 进行可视化测试"
echo ""
echo "📋 测试完成！"