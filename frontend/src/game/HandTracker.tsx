import { useEffect, useRef, useState } from 'react'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

interface HandTrackerProps {
    onHandsDetected?: (left: {x: number, y: number, angle: number} | null, right: {x: number, y: number, angle: number} | null) => void;
}

export const HandTracker = ({ onHandsDetected }: HandTrackerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null)
    const requestRef = useRef<number>()
    const streamRef = useRef<MediaStream | null>(null)
    const isRunningRef = useRef<boolean>(false)

    useEffect(() => {
        const createHandLandmarker = async () => {
            try {
                const vision = await FilesetResolver.forVisionTasks(
                    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
                );
                const handLandmarker = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
                        delegate: "GPU"
                    },
                    runningMode: "VIDEO",
                    numHands: 2
                });
                setLandmarker(handLandmarker);
            } catch (error) {
                console.error("Error loading HandLandmarker:", error);
            }
        };
        createHandLandmarker();

        return () => {
             stopCamera();
        }
    }, []);

    const stopCamera = () => {
        isRunningRef.current = false;
        if (requestRef.current) {
            cancelAnimationFrame(requestRef.current);
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const enableCam = async () => {
        if (!landmarker) {
            console.log("Wait! landmarker not loaded yet.");
            return;
        }

        if (isRunningRef.current) {
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                // Wait for metadata to load to know dimensions
                videoRef.current.onloadedmetadata = () => {
                   if (videoRef.current && canvasRef.current) {
                        canvasRef.current.width = videoRef.current.videoWidth;
                        canvasRef.current.height = videoRef.current.videoHeight;
                        isRunningRef.current = true;
                        predictWebcam();
                   }
                };
            }
        } catch (error) {
            console.error("Error accessing webcam:", error);
            alert("Could not access webcam. Please check permissions.");
        }
    };

    const predictWebcam = async () => {
        if (!isRunningRef.current || !videoRef.current || !canvasRef.current || !landmarker) return;
        
        const video = videoRef.current;
        const canvas = canvasRef.current;
        const canvasCtx = canvas.getContext("2d");
        
        if (!canvasCtx) return;

        // SAFU CHECK: Ensure video has dimensions (Fixes MediaPipe Crash)
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            // Video readyState might be enough but dimensions are critical for ROI
             if (isRunningRef.current) {
                requestRef.current = requestAnimationFrame(predictWebcam);
             }
             return;
        }

        let startTimeMs = performance.now();
        
        try {
            const result = landmarker.detectForVideo(video, startTimeMs);
            
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            let leftHand = null;
            let rightHand = null;

            if (result.landmarks && result.handedness) {
                for (let i = 0; i < result.landmarks.length; i++) {
                    const landmarks = result.landmarks[i];
                    const handedness = result.handedness[i][0];
                    drawLandmarks(canvasCtx, landmarks);
                    
                    const point = landmarks[8]; // Tip of index finger
                    const wrist = landmarks[0]; // Wrist
                    const middleMcp = landmarks[9]; // Middle Finger Knuckle

                    // MIRROR HANDLING
                    const mirroredX = 1 - point.x; 
                    
                    // CALCULATE ROTATION (For "Flick")
                    // Use Wrist -> Knuckle vector.
                    // MediaPipe Y is 0 at top, 1 at bottom.
                    // Wrist (x, y) -> Middle (x, y).
                    // We need mirrored X for angle calculation too if we want it to match visual?
                    // Actually, let's use raw MediaPipe coords to get the "Physical" angle, then flip logic if needed.
                    // Vector V = Middle - Wrist.
                    // dy = middle.y - wrist.y (Positive = Down)
                    // dx = middle.x - wrist.x (Positive = Right in Frame -> Left in Mirror)
                    
                    const dy = middleMcp.y - wrist.y;
                    const dx = middleMcp.x - wrist.x;
                    
                    // Angle in radians. 
                    // If hand is UP: middle.y < wrist.y => dy is negative. dx ~ 0. atan2(-1, 0) = -PI/2 (-90 deg)
                    // If hand is DOWN: middle.y > wrist.y => dy is positive. atan2(1, 0) = PI/2 (90 deg)
                    // If hand is FORWARD (towards camera): Z depth matters, but in 2D it looks like foreshortening.
                    // If hand is HORIZONTAL (flicked forward/down visually):
                    // Let's normalize so 0 = UP.
                    // Current: Up = -1.57. Down = 1.57. 
                    // We want logical pitch: 0 = Up, positive = Forward/Down.
                    
                    let angle = Math.atan2(dy, dx);
                    
                    // Normalize: -PI/2 (Up) -> 0. 
                    // angle + PI/2. 
                    // Up (-1.57) + 1.57 = 0.
                    // Horizontal Right (0) + 1.57 = 1.57.
                    // Down (1.57) + 1.57 = 3.14.
                    
                    // Correction for Mirroring? 
                    // If I flick straight down, X doesn't matter much.
                    // If I tilt sideways, X matters.
                    // Let's stick to this 2D projection angle for now.
                    // However, for right vs left hand, the thumb side is different.
                    
                    const normalizedAngle = angle + (Math.PI / 2);

                    if (handedness.categoryName === "Left") {
                        // Originally leftHand. Swapping to RIGHT based on user feedback.
                        rightHand = { x: mirroredX, y: point.y, angle: normalizedAngle }; 
                    } else {
                        // Originally rightHand. Swapping to LEFT.
                        leftHand = { x: mirroredX, y: point.y, angle: normalizedAngle };
                    }
                }
                
                if (onHandsDetected) {
                     onHandsDetected(leftHand, rightHand);
                }
            }
        } catch (e) {
            console.error("Tracking error:", e);
        }

        if (isRunningRef.current) {
            requestRef.current = requestAnimationFrame(predictWebcam);
        }
    };

    const drawLandmarks = (ctx: CanvasRenderingContext2D, landmarks: any[]) => {
        for (const point of landmarks) {
             ctx.beginPath();
             ctx.arc(point.x * ctx.canvas.width, point.y * ctx.canvas.height, 8, 0, 2 * Math.PI);
             ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
             ctx.fill();
             ctx.strokeStyle = "white";
             ctx.lineWidth = 2;
             ctx.stroke();
        }
    };

    // Auto-start when landmarker is ready
    useEffect(() => {
        if (landmarker) {
            enableCam();
        }
    }, [landmarker]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
             {/* Wrapper video to cover */}
             <video 
                 ref={videoRef} 
                 autoPlay 
                 playsInline 
                 style={{ 
                     width: '100%', 
                     height: '100%', 
                     objectFit: 'cover', 
                     transform: 'scaleX(-1)',
                     display: 'block'
                 }}
             ></video>
             <canvas 
                 ref={canvasRef} 
                 style={{ 
                     position: 'absolute', 
                     left: 0, 
                     top: 0, 
                     width: '100%', 
                     height: '100%', 
                     objectFit: 'cover', // Canvas doesn't use object-fit the same way, we must sync resolution
                     transform: 'scaleX(-1)',
                     pointerEvents: 'none' 
                 }}
             ></canvas>
             {!landmarker && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', background: 'rgba(0,0,0,0.5)', padding: '10px' }}>Loading AI Model...</div>}
        </div>
    )
}
