import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Lightsaber from './LightsaberGenerator'
import { useGameStore } from './GameManager'

// --- CONFIGURATION ---

// MOVEMENT_SCALE: Calibration multiplier for hand position.
// Controls how "far" the saber moves on screen relative to your physical hand movement.
// Higher Value (e.g. 2.0) = Saber moves a lot for small hand movements (High Sensitivity).
// Lower Value (e.g. 1.0) = Saber moves 1:1 with hand, requires larger physical reach.
const MOVEMENT_SCALE = 1.3       

// SMOOTHING_FACTOR: Linear Interpolation (Lerp) speed for POSITION.
// Controls how "laggy" or "smooth" the saber movement is.
// Higher (e.g. 0.3) = Very snappy, instant response, but might jitter if tracking is noisy.
// Lower (e.g. 0.05) = Very smooth, cinematic, but feels floaty/laggy.
const SMOOTHING_FACTOR = 0.12    

// ROTATION_SENSITIVITY: Multiplier for wrist angle -> saber rotation.
// Controls how much the saber rotates when you twist your wrist.
// Higher (e.g. 1.5) = Small wrist twists cause large saber rotations (Easier to get angles).
// Lower (e.g. 0.5) = Requires physically rotating hand 90 degrees to get 90 degree saber.
// INCREASED based on user feedback requesting more sensitivity.
const ROTATION_SENSITIVITY = 1.3 

// ROLL_MULTIPLIER: Additional multiplier specifically for Z-Axis (Twist) rotation.
// Used to tune the 'flick' rotation independently of general sensitivity.
const ROLL_MULTIPLIER = 1.5

// PITCH_MULTIPLIER: Additional multiplier for X-Axis (Forward/Down) rotation.
// Used to accentuate the "chop" motion when flicking wrist down.
const PITCH_MULTIPLIER = 2.5

// ROTATION_SMOOTHING: Linear Interpolation (Lerp) speed for ROTATION.
// Controls how fast the saber rotates to match your wrist.
// Higher = Instant rotation (Snap).
// Lower = Smooth, weighted rotation.
const ROTATION_SMOOTHING = 0.2   

interface SaberControllerProps {
  side: 'left' | 'right'
  color: string
  isPaused?: boolean
}

export function SaberController({ side, color, isPaused = false }: SaberControllerProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const prevPos = useRef(new THREE.Vector3())
  const velocity = useRef(new THREE.Vector3())
  const { viewport } = useThree()

  // Input Handling Logic
  useFrame((_, delta) => {
    if (isPaused) return // Freeze Movement

    const { leftHandPos, rightHandPos } = useGameStore.getState() // Access latest state directly
    const handPos = side === 'left' ? leftHandPos : rightHandPos

    if (groupRef.current) {
        let x = 0
        let y = 0
        
        if (handPos) {
            // HAND TRACKING MODE
            // HandTracker now sends INVERTED X (0 = Visual Left, 1 = Visual Right)
            // Viewport center is (0,0).
            // x: 0 (Visual Left) -> -Width/2
            // x: 1 (Visual Right) -> +Width/2
            
            x = (handPos.x - 0.5) * viewport.width
            y = -(handPos.y - 0.5) * viewport.height // Invert Y as usual
            
            // Calibration scaling (Hands might not reach corners)
            // Reduced to 1.3 per user request ("moves too much", "closer to each other")
            x *= MOVEMENT_SCALE 
            y *= MOVEMENT_SCALE

        } else {
            // NO HANDS DETECTED - Reset to Center
            // Default stance: Hands slightly apart
            x = side === 'left' ? -1.0 : 1.0 
            y = 0.5 // Chest height?
        }

        // Smooth movement (Lerp)
        // Increased to 0.15 to balance smoothness and responsiveness (User Request: "less laggy")
        groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, x, SMOOTHING_FACTOR)
        groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, y, SMOOTHING_FACTOR)
        
        // 2. Calculate Velocity
        const safeDelta = delta > 0 ? delta : 0.016
        velocity.current.subVectors(groupRef.current.position, prevPos.current).divideScalar(safeDelta)
        prevPos.current.copy(groupRef.current.position)

        // 3. Dynamic Rotation
        
        // BASE TILT from Velocity (Original)
        const velTiltX = velocity.current.y * 0.25 
        
        // WRIST ANGLE (New)
        // Decompose Angle into Pitch (X) and Roll (Z)
        // Hand Angle: 0 = Up, PI/2 = Right, PI = Down, 3PI/2 = Left
        let wristRoll = 0
        let wristPitch = 0
        
        if (handPos && handPos.angle !== undefined) {
             const angle = handPos.angle
             
             // ROLL (Z-Axis): Tilting Left/Right
             // Use SIN to capture Left/Right deviation
             // Sin(0) = 0. Sin(PI/2) = 1. Sin(PI) = 0.
             // User said mirroring was wrong. Let's flip sign to positive.
             // If Tilt Right (Positive Angle), we want Roll Right (Negative Z?). 
             // Try positive mapping first as per "other way around" request.
             wristRoll = Math.sin(angle) * ROTATION_SENSITIVITY * ROLL_MULTIPLIER 

             // PITCH (X-Axis): Flicking Down/Forward
             // Use COS to capture Up/Down
             // Cos(0) = 1 (Up). Cos(PI) = -1 (Down).
             // We want Pitch when Down.
             // If Down (PI), Cos is -1. We want Hit Down (Negative X? Or Positive X?).
             // Usually Forward/Down hit is Negative X (-90 deg).
             // Let's map Down to Negative Pitch.
             if (Math.cos(angle) < 0) { // Only when pointing down
                 // Map -1 (Down) to max pitch. 0 (Side) to 0 pitch.
                 // -cos(angle) is 0..1. 
                 // mult by -1 to get negative pitch.
                 wristPitch = Math.cos(angle) * ROTATION_SENSITIVITY * PITCH_MULTIPLIER 
             }
        }

        // Combine
        const targetRotX = velTiltX + wristPitch
        const targetRotZ = wristRoll // Roll from wrist twist
        
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, ROTATION_SMOOTHING)
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, ROTATION_SMOOTHING)
        
        // Store velocity in userData
        groupRef.current.userData.velocity = velocity.current
        groupRef.current.userData.id = side === 'left' ? 1 : 2 // Simple ID
    }
  })

  return (
    <group ref={groupRef} userData={{ isSaber: true, side, color }}>
       {/* Reverted to High Quality Saber Model with Trails built-in */}
       <Lightsaber 
         color={color} 
         isActive={true} 
         rotation={[0, 0, 0]} // Reset rotation if needed, handled by controller logic
       />
    </group>
  )
}
