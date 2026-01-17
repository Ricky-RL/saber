import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import './UI.css' // Import CSS for styling

interface QuestionHeaderProps {
  id: string
  text: string
  targetTime: number
  audioTime: number
  speed?: number
  onComplete: (id: string) => void
}

export function QuestionHeader({ 
  id,
  text, 
  targetTime,
  audioTime,
  speed = 12,
  onComplete
}: QuestionHeaderProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const HIT_Z = -1.5 

  // Calculate initial Z to prevent "flash" at 0,0,0 on mount
  const timeRemaining = targetTime - audioTime
  const initialZ = HIT_Z - (timeRemaining * speed)

  useFrame(() => {
    if (groupRef.current) {
        // Time Based Positioning (Update)
        const currentRemaining = targetTime - audioTime
        const currentZ = HIT_Z - (currentRemaining * speed)
        
        // Only update Z, keep X and Y fixed
        groupRef.current.position.setZ(currentZ)

        // --- FADE OUT LOGIC ---
        // Header should fade earlier than blocks so it doesn't obstruct view
        // Blocks arrive at Z=0. Camera is at Z=6.
        // We want it to fade out AS it approaches the "Hit Window".
        // Let's fade from Z=-10 to Z=0.
        const FADE_START = -10
        const FADE_END = 0 
        let opacity = 1.0
        
        if (currentZ > FADE_START) {
            opacity = THREE.MathUtils.mapLinear(currentZ, FADE_START, FADE_END, 1.0, 0.0)
            opacity = THREE.MathUtils.clamp(opacity, 0, 1)
        }
        
        // Apply to HTML container 
        const container = document.getElementById(`q-container-${id}`)
        if (container) {
            container.style.opacity = opacity.toString()
        }

        // Cleanup when it passes the camera 
        if (currentZ > 8) { 
           onComplete(id)
        }
    }
  })

  return (
    <group ref={groupRef} position={[0, 3.5, initialZ]}>
        <Html transform center position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
            <div id={`q-container-${id}`} className="question-container" style={{ width: '500px', transform: 'scale(1.5)', fontFamily: "'Orbitron', sans-serif" }}>
                <h3 className="question-text" style={{ fontSize: '1.5rem', textShadow: '0 0 10px white' }}>
                    {text}
                </h3>
            </div>
        </Html>
    </group>
  )
}
