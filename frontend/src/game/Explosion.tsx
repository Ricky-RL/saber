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
  const particles = useMemo(() => {
    return new Array(15).fill(0).map(() => ({
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      ),
      scale: Math.random() * 0.4 + 0.1,
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0] as [number, number, number]
    }))
  }, [])

  useFrame((state, delta) => {
    if (groupRef.current) {
      let activeCount = 0
      
      groupRef.current.children.forEach((child, i) => {
        const particle = particles[i]
        
        // Move
        child.position.addScaledVector(particle.velocity, delta)
        
        // Gravity
        particle.velocity.y -= 15 * delta
        
        // Shrink
        child.scale.multiplyScalar(0.9)
        
        if (child.scale.x > 0.01) {
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
            <boxGeometry args={[0.5, 0.5, 0.5]} />
            <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}
