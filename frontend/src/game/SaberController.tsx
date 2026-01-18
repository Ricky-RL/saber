import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import Lightsaber from './LightsaberGenerator'
import { useGameStore } from './GameManager'

// --- CONFIGURATION ---
const MOVEMENT_SCALE = 1.3       // Higher = More movement for less hand motion (Sensitivity)
const SMOOTHING_FACTOR = 0.12    // Higher = Faster/Snappier, Lower = Smoother/Laggy
const ROTATION_SENSITIVITY = 0.7 // How much wrist angle affects saber tilt (Higher = steep angle for small wrist bend)
const ROTATION_SMOOTHING = 0.2   // Speed of rotation: Higher = Snappy flick, Lower = Slow/Smooth

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

  const equippedItems = useGameStore(state => state.equippedItems)
  const equippedPair = equippedItems?.saber_pair?.value // e.g., "#FF00FF,#00FFFF"
  
  let saberColor = color;
  if (equippedPair && typeof equippedPair === 'string') {
      const [leftColor, rightColor] = equippedPair.split(',');
      saberColor = side === 'left' ? leftColor : rightColor;
  }
  
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
        const velTiltZ = -velocity.current.x * 0.25 
        
        // WRIST ANGLE (New)
        let wristPitch = 0
        if (handPos && handPos.angle !== undefined) {
            // handPos.angle: 0 = Up, PI/2 = Right (or Left?), PI = Down.
            // Saber: 0 = Up. -PI/2 = Forward.
            // If I tilt hand DOWN (angle -> 3.14), Saber should tilt FORWARD (-PI/2 or -PI?).
            // Let's Map: 0 (Up) -> 0.
            // PI (Down) -> -PI/2 (Forward/Down).
            // So: pitch = -angle * 0.5?
            // If angle = PI (3.14), pitch = -1.57.
            // If angle = 0, pitch = 0.
            wristPitch = -handPos.angle * ROTATION_SENSITIVITY // 0.8 factor to exaggerate/tune
        }

        // Combine
        // If static, follow wrist. If moving fast, velocity adds "drag".
        const targetRotX = wristPitch + velTiltX 
        const targetRotZ = velTiltZ // Side tilt from movement
        
        groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetRotX, ROTATION_SMOOTHING)
        groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetRotZ, ROTATION_SMOOTHING)
        
        // Store velocity in userData
        groupRef.current.userData.velocity = velocity.current
        groupRef.current.userData.id = side === 'left' ? 1 : 2 // Simple ID
    }
  })

  // Render Saber
  return (
    <group ref={groupRef}>
      {/* 
         Visual Offset: 
         Controller/Wrist is at (0,0). Saber Handle should be in hand. 
         Adjusted Y to -0.6 based on testing (Default was 0, felt like holding blade)
      */}
      <Lightsaber 
        position={[0, -0.6, 0]} 
        color={saberColor} 
      />
    </group>
  )
}
