#!/usr/bin/env python3
# -*- coding: utf-8 -*-


from RealtimeSTT import AudioToTextRecorder
import time

class SimpleVoiceTest:
    def __init__(self):
        self.recognition_results = []
        

        try:
            
            recorder = AudioToTextRecorder(
                spinner=False,
                model="small",  #
                language="zh",  #
                silero_sensitivity=0.4,
                webrtc_sensitivity=3,
                post_speech_silence_duration=0.5,
                min_length_of_recording=0.5,
                min_gap_between_recordings=0.3,
            )
            
  
            print("=" * 40)
            
            # 持续监听
            while True:
                recorder.text(self.on_text_received)
                
      
    test.start_test()

if __name__ == "__main__":
    main()