import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

/* ─── Particle Sphere ─── */
function ParticleSphere() {
  const pointsRef = useRef<THREE.Points>(null!);
  const count = 2800;

  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const color1 = new THREE.Color('#2563eb');
    const color2 = new THREE.Color('#06b6d4');
    const color3 = new THREE.Color('#14b8a6');

    for (let i = 0; i < count; i++) {
      // Fibonacci sphere distribution for uniform coverage
      const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;

      // Two layers: inner and outer shell
      const layer = i % 3 === 0 ? 1.0 : i % 3 === 1 ? 1.4 : 1.8;
      const r = layer + (Math.random() - 0.5) * 0.12;

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Gradient color based on Y position
      const t = (positions[i * 3 + 1] + r) / (2 * r);
      const blended = t < 0.5
        ? color1.clone().lerp(color2, t * 2)
        : color2.clone().lerp(color3, (t - 0.5) * 2);

      colors[i * 3]     = blended.r;
      colors[i * 3 + 1] = blended.g;
      colors[i * 3 + 2] = blended.b;
    }

    return { positions, colors };
  }, []);

  useFrame(({ clock, pointer }) => {
    if (!pointsRef.current) return;
    const t = clock.getElapsedTime();
    pointsRef.current.rotation.y = t * 0.18;
    pointsRef.current.rotation.x = Math.sin(t * 0.12) * 0.15 + pointer.y * 0.1;
    pointsRef.current.rotation.z = Math.cos(t * 0.08) * 0.08 + pointer.x * 0.08;
  });

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [positions, colors]);

  const material = useMemo(() => {
    const tex = new THREE.TextureLoader().load(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAHqSURBVFiF7ZdNSwJRFIafO/dOMxpmWpFJVBZUEEVQkH9A1y6CaKNo0cL/0KJdu6CNFi3aBEGLwOgHWBRBQRSRFYJlFWVqpuX0oYkP5t67c8eBXnjhwDnnfTj3cM8dREQ4R0REcBY7gAAAA...'
    );

    return new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, []);

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

/* ─── Central Glowing Orb ─── */
function CentralOrb() {
  const meshRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y = clock.getElapsedTime() * 0.3;
    meshRef.current.rotation.x = clock.getElapsedTime() * 0.15;
  });

  return (
    <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.5, 64, 64]} />
        <MeshDistortMaterial
          color="#2563eb"
          emissive="#1d4ed8"
          emissiveIntensity={0.4}
          roughness={0.1}
          metalness={0.8}
          distort={0.35}
          speed={2}
          transparent
          opacity={0.9}
        />
      </mesh>
    </Float>
  );
}

/* ─── Orbiting Rings ─── */
function OrbitRing({ radius, color, speed, tilt }: {
  radius: number;
  color: string;
  speed: number;
  tilt: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null!);

  useFrame(({ clock }) => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z = clock.getElapsedTime() * speed;
  });

  return (
    <mesh ref={ringRef} rotation={[tilt, 0, 0]}>
      <torusGeometry args={[radius, 0.008, 16, 120]} />
      <meshBasicMaterial color={color} transparent opacity={0.35} />
    </mesh>
  );
}

/* ─── Scene Content ─── */
function SceneContent() {
  const { size } = useThree();
  const isMobile = size.width < 640;

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} color="#ffffff" />
      <pointLight position={[-3, 3, 3]} intensity={0.8} color="#2563eb" />
      <pointLight position={[3, -3, -3]} intensity={0.5} color="#06b6d4" />
      <pointLight position={[0, 0, 4]} intensity={0.6} color="#14b8a6" />

      <Stars radius={8} depth={3} count={300} factor={0.6} saturation={0.5} fade speed={1} />

      <ParticleSphere />
      <CentralOrb />
      <OrbitRing radius={1.6} color="#2563eb" speed={0.4} tilt={Math.PI / 6} />
      <OrbitRing radius={2.0} color="#06b6d4" speed={-0.28} tilt={Math.PI / 3} />
      <OrbitRing radius={2.3} color="#14b8a6" speed={0.18} tilt={Math.PI / 2.2} />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.8}
        maxPolarAngle={Math.PI * 0.65}
        minPolarAngle={Math.PI * 0.35}
      />
    </>
  );
}

/* ─── Main Export ─── */
const Hero3D: React.FC = () => {
  return (
    <Canvas
      camera={{ position: [0, 0, 5], fov: 55 }}
      dpr={[1, 1.5]}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      style={{ background: 'transparent', width: '100%', height: '100%' }}
    >
      <SceneContent />
    </Canvas>
  );
};

export default Hero3D;
