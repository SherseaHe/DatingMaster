import cv2
import time
import datetime
import json
from deepface import DeepFace

# 全局常量设置
EMOTION_COLORS = {
    'Happy': (0, 255, 0),
    'Sad': (255, 0, 0),
    'Angry': (0, 0, 255),
    'Surprise': (0, 255, 255),
    'Fear': (255, 0, 255),
    'Disgust': (0, 165, 255),
    'Neutral': (128, 128, 128)
}
EMOTION_EMOJIS = {
    'Happy': '😊',
    'Sad': '😢',
    'Angry': '😠',
    'Surprise': '😲',
    'Fear': '😨',
    'Disgust': '🤢',
    'Neutral': '😐'
}
CAMERA_INDEX = 1
ANALYZE_INTERVAL = 3
CONFIDENCE_THRESHOLD = 0.5
MIN_FACE_SIZE = (50, 50)
SAVE_SCREENSHOTS = True


# 设置和优化摄像头
def setup_camera(index):
    print(f"what the heck  {index}...")
    cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        # 抛出错误提示无法打开摄像头
        raise ValueError(f"opps!what the F {index} 呢")

    # 这里对摄像头做一些优化设置
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # 减少延迟
    cap.set(cv2.CAP_PROP_FPS, 30)

    
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    print(f"here i am so serious: {width}x{height} @ {fps:.1f}fps")
    return cap



def process_frame(frame, face_cascade):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=MIN_FACE_SIZE,
        flags=cv2.CASCADE_SCALE_IMAGE
    )

    results = []
    for (x, y, w, h) in faces:
       
        padding = 20
        x_start = max(0, x - padding)
        y_start = max(0, y - padding)
        x_end = min(frame.shape[1], x + w + padding)
        y_end = min(frame.shape[0], y + h + padding)

        face_roi = frame[y_start:y_end, x_start:x_end]

       
        if face_roi.shape[0] < 50 or face_roi.shape[1] < 50:
            continue

        try:
            
            analysis = DeepFace.analyze(
                face_roi,
                actions=['emotion', 'age', 'gender'],
                enforce_detection=False,
                silent=True
            )

            if isinstance(analysis, list):
                analysis = analysis[0]

            
            dominant_emotion = analysis['dominant_emotion']
            emotion_scores = analysis['emotion']
            confidence = emotion_scores[dominant_emotion]

            
            if confidence >= CONFIDENCE_THRESHOLD:
                results.append({
                    'box': (x, y, w, h),
                    'emotion': dominant_emotion,
                    'emotions': emotion_scores,
                    'confidence': confidence,
                    'age': analysis['age'],
                    'gender': analysis['dominant_gender'],
                    'gender_confidence': analysis['gender'][analysis['dominant_gender']]
                })

        except Exception as e:
            print(f"⚠️  人脸分析出错啦: {e}")

    return results


def draw_results(frame, results, show_details=True):
    for result in results:
        x, y, w, h = result['box']
        emotion = result['emotion']
        confidence = result['confidence']
        color = EMOTION_COLORS.get(emotion, (255, 255, 255))
        emoji = EMOTION_EMOJIS.get(emotion, '🤔')

        
        thickness = max(2, int(confidence / 20))
        cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)

        
        label_height = 80 if show_details else 40
        cv2.rectangle(frame, (x, y - label_height), (x + w, y), color, -1)

        
        main_text = f"{emoji} {emotion.upper()}"
        cv2.putText(frame, main_text, (x + 5, y - 45),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        
        conf_text = f"{confidence:.1f}%"
        cv2.putText(frame, conf_text, (x + 5, y - 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 2)

        if show_details:
            
            demo_text = f"{result['gender']}, {result['age']}"
            cv2.putText(frame, demo_text, (x + 5, y - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)

           
            y_offset = y + h + 25
            top_emotions = sorted(result['emotions'].items(),
                                  key=lambda x: x[1], reverse=True)[:3]

            for i, (emo, score) in enumerate(top_emotions):
                if score > 5:  
                    bar_width = int(score * 2)
                    emo_color = EMOTION_COLORS.get(emo, (255, 255, 255))

                   
                    cv2.rectangle(frame, (x, y_offset),
                                  (x + bar_width, y_offset + 12),
                                  emo_color, -1)

                    
                    cv2.putText(frame, f"{emo}: {score:.1f}%",
                                (x + bar_width + 5, y_offset + 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.35, emo_color, 1)
                    y_offset += 18



def draw_ui(frame, stats, fps, frame_count, show_stats=True):
    h, w = frame.shape[:2]

   
    cv2.rectangle(frame, (0, 0), (w, 60), (0, 0, 0), -1)

    
    cv2.putText(frame, f"FPS: {fps:.1f}", (10, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
    cv2.putText(frame, f"Frame: {frame_count}", (10, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    
    cv2.putText(frame, "Vision Pro + DeepFace", (w - 300, 25),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
    cv2.putText(frame, datetime.now().strftime('%H:%M:%S'), (w - 120, 50),
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)

    
    if show_stats and stats:
        total = sum(stats.values())
        if total > 0:
            y_pos = 80
            cv2.putText(frame, "Emotion Stats:", (w - 200, y_pos),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2)
            y_pos += 25

            for emotion, count in sorted(stats.items(),
                                         key=lambda x: x[1], reverse=True)[:5]:
                percentage = (count / total) * 100
                color = EMOTION_COLORS.get(emotion, (255, 255, 255))
                emoji = EMOTION_EMOJIS.get(emotion, '🤔')

                text = f"{emoji} {emotion}: {percentage:.1f}%"
                cv2.putText(frame, text, (w - 200, y_pos),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
                y_pos += 20


# 保存会话数据
def save_session_data(emotion_stats, total_frames, session_start):
    session_data = {
        't': session_start.isoformat(),
        'end': datetime.now().isoformat(),
        'total_frames': total_frames,
        'emotion_statistics': emotion_stats,
        'total_detections': sum(emotion_stats.values())
    }

    filename = f"one_shot_two_shot_{session_start.strftime('%Y%m%d_%H%M%S')}.json"
    with open(filename, 'w') as f:
        json.dump(session_data, f, indent=2)

    print(f"my name is bob why so serious: {filename}")


def main():
    print("whayt do you want to do?")
    print("=" * 40)

    
    set_up_all_cameras_if_uou_ddddd_x = setup_camera(CAMERA_INDEX)


    facial_cascade  = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

    
    s_for_emotions = {
        'Happy': 0,
        'Sad': 0,
        'Angry': 0,
        'Surprise': 0,
        'Fear': 0,
        'Disgust': 0,
        'Neutral': 0
    }

    
    total_frames = 0
    session_start = datetime.now()


    