@echo off
chcp 65001 > nul
echo 🎤 讯飞语音对话本地测试脚本
echo ================================

echo 📊 检查服务状态...
curl -s http://localhost:3000/health > nul 2>&1
if %errorlevel% == 0 (
    echo ✅ 服务运行正常
) else (
    echo ❌ 服务未运行，请先启动服务: npm start
    pause
    exit /b 1
)

echo.
echo 🧪 运行集成测试...
curl -s -X POST http://localhost:3000/api/voice-chat/test-integration | findstr "success\":true" > nul
if %errorlevel% == 0 (
    echo ✅ 集成测试通过
) else (
    echo ❌ 集成测试失败
)

echo.
echo 🎵 测试音频文件处理...
if exist test_audio.wav (
    echo 📁 找到测试音频文件: test_audio.wav
    echo 🚀 开始语音对话测试...
    
    curl -s -X POST http://localhost:3000/api/voice-chat/process -F "audio=@test_audio.wav" -F "model=moonshot-v1-8k" -F "language=zh_cn" > temp_result.txt
    findstr "success\":true" temp_result.txt > nul
    if %errorlevel% == 0 (
        echo ✅ 语音对话测试成功！
        echo.
        echo 📝 测试结果请查看浏览器界面获得更好体验
    ) else (
        echo ❌ 语音对话测试失败
        type temp_result.txt
    )
    del temp_result.txt > nul 2>&1
) else (
    echo ❌ 未找到测试音频文件
)

echo.
echo 🌐 浏览器测试:
echo 请双击打开 xunfei-voice-chat.html 进行可视化测试
echo.
echo 📋 测试完成！
echo 按任意键继续...
pause > nul