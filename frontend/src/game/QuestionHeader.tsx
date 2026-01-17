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

        // Cleanup when it passes the camera 
        if (currentZ > 8) { 
           onComplete(id)
        }
    }
  })

  return (
    <group ref={groupRef} position={[0, 3.5, initialZ]}>
        <Html transform center position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
            <div className="question-container" style={{ width: '500px', transform: 'scale(1.5)' }}>
                <h3 className="question-text" style={{ fontSize: '1.5rem' }}>
                    {text}
                </h3>
            </div>
        </Html>
    </group>
  )
}
