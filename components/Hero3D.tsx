import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Stars, Icosahedron, useTexture } from '@react-three/drei';
import * as THREE from 'three';

// Define types for Three.js elements
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      pointLight: any;
      directionalLight: any;
      group: any;
      meshStandardMaterial: any;
    }
  }
}

const Meteorite = () => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Slow, majestic rotation
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x += 0.001;
      
      // Gentle floating is handled by Float wrapper, but we add subtle scale pulse
      // meshRef.current.scale.setScalar(2 + Math.sin(state.clock.elapsedTime * 0.5) * 0.05);
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.5} floatIntensity={0.5}>
      <Icosahedron args={[1, 1]} scale={2.2} ref={meshRef}>
        <meshStandardMaterial 
          color="#1e1e2e" // Dark grey/blue rock
          roughness={0.7}
          metalness={0.4}
          flatShading={true} // Creates the low-poly faceted rock look
        />
      </Icosahedron>
    </Float>
  );
};

const Debris = () => {
    const groupRef = useRef<THREE.Group>(null);

    useFrame((state) => {
        if (groupRef.current) {
            groupRef.current.rotation.y -= 0.005; // Debris rotates opposite to main rock
        }
    });

    // Create random small rocks
    const rocks = Array.from({ length: 15 }).map((_, i) => ({
        pos: [
            (Math.random() - 0.5) * 8, 
            (Math.random() - 0.5) * 8, 
            (Math.random() - 0.5) * 6
        ] as [number, number, number],
        scale: Math.random() * 0.3 + 0.1,
        speed: Math.random() * 0.02
    }));

    return (
        <group ref={groupRef}>
            {rocks.map((rock, i) => (
                <Float key={i} speed={2} rotationIntensity={2} floatIntensity={2} position={rock.pos}>
                    <Icosahedron args={[1, 0]} scale={rock.scale}>
                        <meshStandardMaterial color="#475569" flatShading roughness={0.8} />
                    </Icosahedron>
                </Float>
            ))}
        </group>
    );
};

const Hero3D: React.FC = () => {
  return (
    <div className="w-full h-full min-h-[500px] relative">
      <Canvas camera={{ position: [0, 0, 6], fov: 45 }} gl={{ antialias: true, alpha: true }}>
        {/* Cinematic Lighting */}
        <ambientLight intensity={0.2} />
        
        {/* Main "Sun" light (Warm) */}
        <directionalLight position={[5, 5, 5]} intensity={2} color="#fbbf24" />
        
        {/* Rim light (Cool Blue/Purple) from behind/side for contrast */}
        <pointLight position={[-5, -2, -5]} intensity={4} color="#6366f1" distance={20} />
        
        {/* Fill light */}
        <pointLight position={[0, -5, 2]} intensity={0.5} color="#c084fc" />

        <group position={[0, 0, 0]}>
            <Meteorite />
            <Debris />
        </group>
        
        {/* Moving Starfield */}
        <Stars radius={100} depth={50} count={3000} factor={4} saturation={0} fade speed={1.5} />
        
        {/* Optional Fog for depth */}
        <fog attach="fog" args={['#050505', 5, 20]} />
      </Canvas>
    </div>
  );
};

export default Hero3D;