#!/usr/bin/env python3
# -*- coding: utf-8 -*-


from RealtimeSTT import AudioToTextRecorder
import time
import sys

def simple_low_latency_test():
   
    
    
    # 核心低延迟参数
    recorder = AudioToTextRecorder(
        model="tiny",           
        language="zh",          
        
        
        silero_sensitivity=0.1,              
        webrtc_sensitivity=1,                
        post_speech_silence_duration=0.05,   
        min_length_of_recording=0.1,         #
        
        
        enable_realtime_transcription=True,
        realtime_processing_pause=0.01,      
    
   
    results = []
    
    try:
        while True:
            start_time = time.time()
            
            
            def process_text(text):
                elapsed = (time.time() - start_time) * 1000
                print(f"\n⏱️  延迟: {elapsed:.0f}ms")
                print(f"📝 识别: {text}")
                
                
                    
                
                results.append(elapsed)
            
            recorder.text(process_text)
            
    except KeyboardInterrupt:
        print("\n\n统计:")
        if results:
            avg_latency = sum(results) / len(results)
            min_latency = min(results)
            max_latency = max(results)
            
            

def streaming_test():
   
    
    
    partial_text = [""]  
    
    def on_partial(text):
        
        if text and text != partial_text[0]:
            partial_text[0] = text
            # 清除当前行并重写
            sys.stdout.write('\r' + ' ' * 80 + '\r')
            sys.stdout.write(f"💬 {text}")
            sys.stdout.flush()
    
    def on_final(text):
       
        sys.stdout.write('\r' + ' ' * 80 + '\r')
       
        
    
    recorder = AudioToTextRecorder(
        model="tiny",
        language="zh",
        spinner=False,
        
        # 流式参数
        enable_realtime_transcription=True,
        realtime_processing_pause=0.01,
        on_realtime_transcription_update=on_partial,
        
        # 快速响应
        silero_sensitivity=0.05,
        post_speech_silence_duration=0.02,
        min_length_of_recording=0.05,
    )
    
    
    
    try:
        while True:
            recorder.text(on_final)
    except KeyboardInterrupt:
        print("\n\n结")

def benchmark_mode():
  
  
    
    test_configs = [
        {
            "name": "极速配置",
            "silero_sensitivity": 0.05,
            "post_speech_silence_duration": 0.02,
            "min_length_of_recording": 0.05,
        },
        {
            "name": "平衡配置",
            "silero_sensitivity": 0.2,
            "post_speech_silence_duration": 0.1,
            "min_length_of_recording": 0.2,
        },
        {
            "name": "准确配置",
            "silero_sensitivity": 0.4,
            "post_speech_silence_duration": 0.3,
            "min_length_of_recording": 0.3,
        }
    ]
    
    for config in test_configs:
        print(f"\ {config['name']}...")
        
        recorder = AudioToTextRecorder(
            model="tiny",
            language="zh",
            spinner=False,
            webrtc_sensitivity=1,
            min_gap_between_recordings=0.01,
            **{k: v for k, v in config.items() if k != 'name'}
        )
        
        latencies = []
        
       
        
        for i in range(3):
            start = time.time()
            text = recorder.text()
            latency = (time.time() - start) * 1000
            latencies.append(latency)
            
            print(f"  第{i+1}次: {latency:.0f}ms - {text}")
        
        if latencies:
            avg = sum(latencies) / len(latencies)
            print(f"  迟: {avg:.0f}ms")

def check_environment():
 
 
    
    try:
        import torch
        print(f"✅ PyTorch: {torch.__version__}")
        print(f"✅ CUDA: {'可用' if torch.cuda.is_available() else '不可用'}")
    except:
   
    
  
        
   

def main():
    
   
    print("=" * 40)
    
    # 环境检查
    check_environment()
    
   
    
    choice = input("\n(1-4): ").strip()
    
    if choice == "1":
        simple_low_latency_test()
    elif choice == "2":
        streaming_test()
    elif choice == "3":
        benchmark_mode()
    elif choice == "4":
        print("见！")
    else:
        print("")

if __name__ == "__main__":
    main()