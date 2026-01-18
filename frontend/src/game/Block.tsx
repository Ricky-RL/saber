import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'

// --- BLOCK CONSTANTS ---

// BLOCK_TARGET_Z: The Z-depth where the block crosses the "Beat Line".
// -1.5 is just in front of the player (Visual target).
const BLOCK_TARGET_Z = -1.5

// BLOCK_MISS_Z_THRESHOLD: How far behind the player (positive Z) the block goes before being "missed".
// +4 means it's well behind the camera.
const BLOCK_MISS_Z_THRESHOLD = 4

// BLOCK_DEFAULT_SIZE: Size of the block if not specified.
const BLOCK_DEFAULT_SIZE: [number, number, number] = [1.3, 1.3, 1.3]

interface BlockProps {
  id: string
  position: [number, number, number] 
  color: string
  text?: string
  isCorrect?: boolean
  targetTime: number 
  startTime: number 
  audioTime: number 
  speed?: number 
  onMiss?: (id: string) => void
  type?: 'true_false' | 'mcq' | 'text_header' | 'true_false_pair' | 'true_false_split'
  answers?: any[]
  invisible?: boolean 
  splitAxis?: 'horizontal' | 'vertical'
  labelA?: string
  labelB?: string
  size?: [number, number, number]
  showHitbox?: boolean
}

// User Requested Font from Lightsaber/UI.tsx
// const FONT_URL = '/fonts/Orbitron-Bold.ttf' 

function DebugHitbox({ size, visible }: { size: [number, number, number], visible: boolean }) {
  if (!visible) return null
  return (
    <group>
      {/* Wireframe Outline */}
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial color="#ff0000" wireframe />
      </mesh>
      {/* Semi-transparent Solid Fill */}
      <mesh>
        <boxGeometry args={size} />
        <meshBasicMaterial color="#ff0000" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

export function Block({ 
  id,
  position, 
  color, 
  text, 
  targetTime,
  startTime, 
  audioTime,
  speed = 12, 
  onMiss,
  type = 'mcq',
  isCorrect,
  invisible = false,
  splitAxis = 'horizontal',
  labelA = 'T',
  labelB = 'F',
  size = BLOCK_DEFAULT_SIZE,
  showHitbox = false,
  hitboxSize // New Prop
}: BlockProps & { hitboxSize?: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null!)
  const innerMeshRef = useRef<any>(null!) 
  const textRef = useRef<THREE.Group>(null!)

  const initialRotation = useMemo(() => [
    Math.random() * 0.2, 
    Math.random() * 0.2, 
    Math.random() * 0.2
  ], [])


  useFrame((state, delta) => {
    if (groupRef.current) {
        // Time Based Positioning
        const timeRemaining = targetTime - audioTime
        let idealZ = BLOCK_TARGET_Z - (timeRemaining * speed)

        // --- STYLISTIC SPAWN ANIMATION (User Request) ---
        // "Really fast then slow down" + "Noticeable"
        // Increased duration to 0.3s and Offset to 60. Added Scale Pop.
        const timeAlive = audioTime - startTime
        
        let scale = 1.0
        
        if (timeAlive < 0.3) {
            // Decay from 0 to 1 over 0.3s
            const progress = timeAlive / 0.3
            // Inverse: 1 to 0
            const decay = 1 - progress
            // Quadratic Ease Out
            const offset = (decay * decay) * 60
            idealZ -= offset
            
            // Scale Animation: Pop from 0.1 to 1.0
            // Ease Out: 1 - decay^2 ?? 
            // Simple Linear Scale or Ease Out Back?
            // Let's use simple ease out: moves fast to 1.
            scale = 0.1 + (0.9 * (1 - decay * decay))
        }

        groupRef.current.position.set(position[0], position[1], idealZ)
        groupRef.current.scale.set(scale, scale, scale)

        // Miss Logic
        if (idealZ > BLOCK_MISS_Z_THRESHOLD) { 
           if (onMiss) onMiss(id)
        }
    }

    // --- SPIN LOGIC (Requested for Variations) ---
    // Spin if it's a Pair Block or Split Block (inner mesh)
    if (innerMeshRef.current && (type === 'true_false_pair' || type === 'true_false_split')) {
        innerMeshRef.current.rotation.z += delta * 2
        innerMeshRef.current.rotation.x += delta * 1
    }

    // --- PULSE LOGIC (Requested for Split Variation Text) ---
    if (textRef.current && type === 'true_false_split') {
        const intensity = 2.5 + Math.sin(state.clock.elapsedTime * 5) * 1.0 
        
        const trueText = textRef.current.children[0] as any
        const falseText = textRef.current.children[1] as any

        if (trueText && trueText.material && trueText.material.color) {
             trueText.material.color.set('#00ffff').multiplyScalar(intensity)
        }
        if (falseText && falseText.material && falseText.material.color) {
             falseText.material.color.set('#ff00ff').multiplyScalar(intensity)
        }
    }
  })

  // --- 1. HEADER (Question Prompt) ---
  if (type === 'text_header') {
      return (
          <group ref={groupRef} position={position}>
              <RoundedBox args={[8, 1.5, 0.2]} radius={0.1} smoothness={4}>
                  <meshBasicMaterial color="#000000" transparent opacity={0.8} />
              </RoundedBox>
              
              <Text
                position={[0, 0, 0.11]} 
                fontSize={0.6}
                color="white"
                anchorX="center"
                anchorY="middle"
                maxWidth={7.5}
                textAlign="center"
                // font={FONT_URL} // disabling to prevent 404 block
              >
                  {text}
              </Text>
          </group>
      )
  }

  // --- 2. SPLIT VARIATION ---
  // Single White Block + Floating T/F Sides
  if (type === 'true_false_split') {
     const isVertical = splitAxis === 'vertical'
     const posA: [number, number, number] = isVertical ? [0, 1.8, 0] : [-1.8, 0, 0]
     const posB: [number, number, number] = isVertical ? [0, -1.8, 0] : [1.8, 0, 0]

     return (
       <group ref={groupRef} position={position} userData={{ isBlock: false, id, isCorrect: true }} visible={!invisible}> 
           {/* Floating Text (Static relative to block, pulsing) */}
            <group ref={textRef}>
                <Text position={posA} fontSize={1.0} color="#00ffff" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black" renderOrder={10} material-toneMapped={false}>{labelA}</Text>
                <Text position={posB} fontSize={1.0} color="#ff00ff" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black" renderOrder={10} material-toneMapped={false}>{labelB}</Text>
            </group>

           {/* The Block (Spins) */}
           <group ref={innerMeshRef}>
               {/* Single White Glowing Block (BIGGER) */}
               <RoundedBox args={[1.3, 1.3, 1.3]} radius={0.15} smoothness={4}>
                   <meshStandardMaterial 
                        color="#1a1a1a"
                        emissive="#ffffff" // Glowing White
                        emissiveIntensity={2} 
                        roughness={0.1} // High Gloss
                        metalness={1.0} // Full Metal
                        toneMapped={false} 
                    />
               </RoundedBox>
           </group>

           {/* Debug Hitbox for Visual Center Block - using standard size approx */}
           <DebugHitbox size={[1.3, 1.3, 1.3]} visible={showHitbox} />
       </group>
     )
  }

  // --- 3. PAIR VARIATION ---
  // Cube with Text on ALL SIDES + SPIN
  if (type === 'true_false_pair') {
      return (
        <group>
          <group 
            ref={groupRef} 
            rotation={initialRotation as [number, number, number]}
            userData={{ isBlock: true, id, isCorrect, size, hitboxSize }} 
          >
            {/* BIGGER BOX + SPIN */}
            <group ref={innerMeshRef}>
                <RoundedBox args={[1.3, 1.3, 1.3]} radius={0.2} smoothness={4}>
                    <meshStandardMaterial 
                        color="#1a1a1a"
                        emissive={color}
                        emissiveIntensity={3}
                        roughness={0.1} // High Gloss
                        metalness={1.0} // Full Metal
                        toneMapped={false}
                    />
                </RoundedBox>

                {/* Front */}
                <Text position={[0, 0, 0.75]} renderOrder={10} material-toneMapped={false} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black">{text}</Text>
                {/* Back */}
                <Text position={[0, 0, -0.75]} renderOrder={10} material-toneMapped={false} rotation={[0, Math.PI, 0]} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black">{text}</Text>
                {/* Top */}
                <Text position={[0, 0.75, 0]} renderOrder={10} material-toneMapped={false} rotation={[-Math.PI/2, 0, 0]} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black">{text}</Text>
                {/* Bottom */}
                <Text position={[0, -0.75, 0]} renderOrder={10} material-toneMapped={false} rotation={[Math.PI/2, 0, 0]} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black">{text}</Text>
                {/* Left */}
                <Text position={[-0.75, 0, 0]} renderOrder={10} material-toneMapped={false} rotation={[0, -Math.PI/2, 0]} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black">{text}</Text>
            {/* Right */}
            <Text position={[0.75, 0, 0]} renderOrder={10} material-toneMapped={false} rotation={[0, Math.PI/2, 0]} fontSize={0.6} color="white" anchorX="center" anchorY="middle" outlineWidth={0.2} outlineColor="black">{text}</Text>
        </group>

        {/* Debug Hitbox for Pair (Rotated with group) */}
        <DebugHitbox size={hitboxSize || [1.3, 1.3, 1.3]} visible={showHitbox} />

      </group>
    </group>
      )
  }

  // --- 4. MCQ / STANDARD ---
  return (
    <group>
      <group 
        ref={groupRef} 
        visible={!invisible || showHitbox} // Visibile if not hidden OR debug enabled
        rotation={initialRotation as [number, number, number]}
        userData={{ isBlock: true, id, isCorrect, size, hitboxSize }} 
      >
        {/* BIGGER BOX or Custom Size */}
        <RoundedBox ref={innerMeshRef} args={size} radius={0.2} smoothness={4}>
            <meshStandardMaterial 
                color={!invisible ? "#1a1a1a" : color} // If debug visual, use actual color
                emissive={!invisible ? color : "#000000"} // No emissive for debug
                emissiveIntensity={!invisible ? 4 : 0} 
                roughness={0.1} 
                metalness={1.0} 
                toneMapped={false}
                transparent={invisible}
                opacity={invisible ? 0.6 : 1.0} // More visible for debug
                wireframe={false} // Solid so it's easier to see
            />
        </RoundedBox>

        {!invisible && (
          <Text
              position={[0, 0, (size[2]/2) + 0.03]} 
              renderOrder={10}
              material-toneMapped={false}
              fontSize={0.6} // Reduced from 0.9 to match style better (was "too big")
              color="white"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.2}
              outlineColor="black"
          >
              {text}
          </Text>
        )}

        {/* Debug Hitbox for Generic/MCQ/Invisible */}
        <DebugHitbox size={hitboxSize || size} visible={showHitbox} />
        
      </group>
    </group>
  )
}
