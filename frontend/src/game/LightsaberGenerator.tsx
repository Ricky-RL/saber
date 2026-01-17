import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface LightsaberProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  color?: string;
  scale?: number;
  isActive?: boolean;
}

function Lightsaber({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = "#00ffff",
  scale = 1,
  isActive = true,
}: LightsaberProps) {
  const bladeRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((state) => {
    // Pulsing glow effect
    if (glowRef.current && isActive) {
      const pulse = Math.sin(state.clock.elapsedTime * 10) * 0.1 + 0.9;
      glowRef.current.scale.x = pulse;
      glowRef.current.scale.z = pulse;
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {/* Hilt - bottom cylinder */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1.5, 32]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Hilt grip details */}
      <mesh position={[0, -1.5, 0]}>
        <cylinderGeometry args={[0.16, 0.16, 0.8, 32]} />
        <meshStandardMaterial color="#0f0f0f" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Emitter (top of hilt) */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.18, 0.15, 0.3, 32]} />
        <meshStandardMaterial
          color="#2a2a2a"
          metalness={0.95}
          roughness={0.1}
        />
      </mesh>

      {/* Lightsaber blade */}


      {/* Lightsaber blade with Thick Trail */}
      {isActive && (
        <>
            <mesh ref={bladeRef} position={[0, 1.5, 0]}>
                <cylinderGeometry args={[0.08, 0.08, 3.5, 32]} />
                <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={2}
                transparent
                opacity={0.9}
                />
            </mesh>

          {/* Outer glow layer */}
          <mesh ref={glowRef} position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.15, 0.15, 3.5, 32]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.3}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Bright tip */}
          <mesh position={[0, 3.3, 0]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>

          {/* Point light for illumination */}
          <pointLight
            position={[0, 1.5, 0]}
            color={color}
            intensity={2}
            distance={8}
          />
        </>
      )}
    </group>
  );
}

export default Lightsaber;
