import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'


// ... existing code ...

      {/* 3D Text above the cube */}
    //   <Billboard position={[0, 2, 0]}>
    //     <group ref={textRef}>
    //       <Text
    //         font={FONT_URL}
    //         fontSize={0.5}
    //         color={primaryColor}
    //         anchorX="center"
    //         anchorY="middle"
    //         letterSpacing={0.1}
    //       >
    //         Hi {playerName}
    //         <meshBasicMaterial color={primaryColor} toneMapped={false} />
    //       </Text>
    //     </group>
    //   </Billboard>


interface HelloCubeProps {
  playerName?: string;
  primaryColor?: string;
  secondaryColor?: string;
}

const FONT_URL = 'https://fonts.gstatic.com/s/orbitron/v35/yMJMMIlzdpvBhQQL_SC3X9yhF25-T1ny_Cmxpg.ttf';

function InternalStars({ color }: { color: string }) {
  const points = useRef<THREE.Points>(null);
  const count = 100;
  const positions = new Float32Array(count * 3);
  
  for(let i=0; i<count; i++) {
    positions[i*3] = (Math.random() - 0.5) * 1.8; // inside the inner cube
    positions[i*3+1] = (Math.random() - 0.5) * 1.8;
    positions[i*3+2] = (Math.random() - 0.5) * 1.8;
  }

  useFrame((_, delta) => {
    if (points.current) {
        points.current.rotation.y -= delta * 0.1;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial size={0.03} color={color} transparent opacity={0.6} toneMapped={false} />
    </points>
  )
}

export function HelloCube({ 
  playerName = "Traveller", 
  primaryColor = "#ff00ff", 
  secondaryColor = "#00f0ff" 
}: HelloCubeProps) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const textRef = useRef<THREE.Group>(null!)

  // Animate the cube rotation
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.2
      meshRef.current.rotation.y += delta * 0.3
    }
    if (textRef.current) {
      textRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.2
    }
  })

  return (
    <group position={[0, -1, 0]}>
      {/* Rotating holographic cube */}
      <mesh ref={meshRef} position={[0, 0, 0]} scale={2.2}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial 
          color={primaryColor} 
          wireframe={true}
          transparent={true}
          opacity={0.8}
          toneMapped={false}
        />
        <InternalStars color={secondaryColor} />
      </mesh>
      
      {/* Inner cube for depth */}
      <mesh rotation={[0.5, 0.5, 0]} scale={1.5}>
         <boxGeometry args={[1, 1, 1]} />
         <meshBasicMaterial 
            color={secondaryColor} 
            wireframe={true}
            transparent={true}
            opacity={0.3}
            toneMapped={false}
         />
      </mesh>

      {/* 3D Text above the cube */}
      <Billboard position={[0, 2, 0]}>
        <group ref={textRef}>
          <Text
            font={FONT_URL}
            fontSize={0.5}
            color={secondaryColor}
            anchorX="center"
            anchorY="middle"
            letterSpacing={0.1}
          >
            Hi {playerName}
            <meshBasicMaterial color={primaryColor} toneMapped={false} />
          </Text>
        </group>
      </Billboard>

      {/* <EffectComposer>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} />
      </EffectComposer> */}
    </group>
  )
}
