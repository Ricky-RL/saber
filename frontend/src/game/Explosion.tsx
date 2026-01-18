import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

interface ExplosionProps {
  position: [number, number, number]
  color: string
  onComplete?: () => void
}

export function Explosion({ position, color, onComplete }: ExplosionProps) {
  const groupRef = useRef<THREE.Group>(null!)
  
  // EXAGGERATED: 40 Particles (was 15), Faster, Random Scale
  const particles = useMemo(() => {
    return new Array(40).fill(0).map(() => ({
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 15, // Increased from 10
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 20  // More forward/backward spread
      ),
      scale: Math.random() * 0.5 + 0.2, // Slightly larger
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number],
      rotSpeed: [(Math.random()-0.5)*10, (Math.random()-0.5)*10, (Math.random()-0.5)*10]
    }))
  }, [])

  useFrame((_state, delta) => {
    if (groupRef.current) {
      let activeCount = 0
      
      groupRef.current.children.forEach((child, i) => {
        const particle = particles[i]
        
        // Move
        child.position.addScaledVector(particle.velocity, delta)
        
        // Rotate (New)
        child.rotation.x += particle.rotSpeed[0] * delta
        child.rotation.y += particle.rotSpeed[1] * delta
        
        // Gravity
        particle.velocity.y -= 25 * delta // Increased gravity
        
        // Shrink (Slower decay for more impact?)
        // child.scale.multiplyScalar(0.9) 
        // Let's simple reduce scale manually to zero
        const scaleDecay = 1.0 - (4.0 * delta) // Linear decay approx
        child.scale.multiplyScalar(Math.max(0, scaleDecay))

        if (child.scale.x > 0.05) {
            activeCount++
        }
      })

      if (activeCount === 0 && onComplete) {
          onComplete()
      }
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {particles.map((p, i) => (
        <mesh key={i} rotation={p.rotation} scale={p.scale}>
            <boxGeometry args={[0.4, 0.4, 0.4]} />
            {/* EXAGGERATED: Standard Material with Emissive Glow */}
            <meshStandardMaterial 
                color={color} 
                emissive={color}
                emissiveIntensity={4}
                toneMapped={false}
                transparent 
                opacity={1} 
            />
        </mesh>
      ))}
    </group>
  )
}
