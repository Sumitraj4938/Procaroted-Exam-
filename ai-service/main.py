from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import cv2
import mediapipe as mp
import numpy as np
import base64
import json
import time

app = FastAPI(title="AI Proctoring Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

mp_face_detection = mp.solutions.face_detection
mp_face_mesh = mp.solutions.face_mesh

def process_frame(frame_bytes):
    # Decode base64 image
    img_data = base64.b64decode(frame_bytes)
    nparr = np.frombuffer(img_data, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        return {"status": "error", "message": "Invalid frame"}

    # Convert to RGB for MediaPipe
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    result = {
        "faces_detected": 0,
        "head_movement": "normal",
        "eye_gaze": "center",
        "warnings": []
    }

    # Face Detection
    with mp_face_detection.FaceDetection(min_detection_confidence=0.5) as face_detection:
        results = face_detection.process(img_rgb)
        if results.detections:
            result["faces_detected"] = len(results.detections)
            if result["faces_detected"] > 1:
                result["warnings"].append("Multiple faces detected")
        else:
            result["warnings"].append("No face detected")

    # Head Pose Estimation (Simplified)
    if result["faces_detected"] == 1:
        with mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5) as face_mesh:
            mesh_results = face_mesh.process(img_rgb)
            if mesh_results.multi_face_landmarks:
                face_landmarks = mesh_results.multi_face_landmarks[0]
                
                # Get 3D coordinates of specific landmarks (nose, chin, eyes)
                # Calculate pitch, yaw, roll (simplified logic for demonstration)
                nose_tip = face_landmarks.landmark[1]
                left_eye = face_landmarks.landmark[33]
                right_eye = face_landmarks.landmark[263]
                
                # Basic yaw calculation (looking left/right)
                eye_center_x = (left_eye.x + right_eye.x) / 2
                if nose_tip.x < eye_center_x - 0.05:
                    result["head_movement"] = "looking_right"
                    result["warnings"].append("Head turned right")
                elif nose_tip.x > eye_center_x + 0.05:
                    result["head_movement"] = "looking_left"
                    result["warnings"].append("Head turned left")
                    
                # Basic pitch calculation (looking up/down)
                eye_center_y = (left_eye.y + right_eye.y) / 2
                if nose_tip.y < eye_center_y - 0.05:
                    result["head_movement"] = "looking_up"
                    result["warnings"].append("Head turned up")
                elif nose_tip.y > eye_center_y + 0.1:
                    result["head_movement"] = "looking_down"
                    result["warnings"].append("Head turned down")

    return result

@app.websocket("/ws/proctor/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            if "frame" in payload:
                # Process the frame
                # frame should be a base64 encoded jpeg
                frame_data = payload["frame"].split(",")[1] if "," in payload["frame"] else payload["frame"]
                analysis_result = process_frame(frame_data)
                
                # Add timestamp
                analysis_result["timestamp"] = time.time()
                
                # Send result back to client
                await websocket.send_json(analysis_result)
                
    except WebSocketDisconnect:
        print(f"Client {session_id} disconnected")
    except Exception as e:
        print(f"Error: {e}")
        try:
            await websocket.send_json({"status": "error", "message": str(e)})
        except:
            pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
