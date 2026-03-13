import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════
   HERO VERTEX SHADER — Noise-displaced icosahedron
   ═══════════════════════════════════════════════════════════ */
const heroVertexShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFresnel;

  // Simplex noise (compact)
  vec3 mod289(vec3 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x / 289.0) * 289.0; }
  vec4 permute(vec4 x) { return mod289((x * 34.0 + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main() {
    vNormal = normalize(normalMatrix * normal);
    float n = snoise(position * 1.5 + uTime * 0.15) * 0.14;
    vec3 pos = position + normal * n;
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;

    // Fresnel for rim glow
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    vFresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const heroFragmentShader = `
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vFresnel;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);

    // Gradient based on normal direction
    float upness = dot(vNormal, vec3(0.0, 1.0, 0.0)) * 0.5 + 0.5;
    vec3 baseColor = mix(uColor1, uColor2, upness);

    // Rim glow
    vec3 rimColor = vec3(0.83, 0.46, 0.37);
    vec3 color = mix(baseColor, rimColor, vFresnel * 0.7);

    // Subtle inner glow
    color += uColor1 * 0.1;

    float alpha = 0.75 + vFresnel * 0.25;
    gl_FragColor = vec4(color, alpha);
  }
`;

/* ═══════════════════════════════════════════════════════════
   PARTICLE SHADER — Floating dot field
   ═══════════════════════════════════════════════════════════ */
const particleVertexShader = `
  uniform float uTime;
  attribute float aScale;
  attribute float aSpeed;
  attribute float aOffset;
  varying float vAlpha;

  void main() {
    vec3 pos = position;
    float angle = uTime * aSpeed * 0.3 + aOffset;
    pos.x += sin(angle) * 0.15;
    pos.y += cos(angle * 0.7) * 0.1;
    pos.z += sin(angle * 0.5) * 0.12;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float dist = length(mvPosition.xyz);

    gl_PointSize = aScale * (60.0 / dist);
    gl_PointSize = max(gl_PointSize, 1.0);
    vAlpha = smoothstep(10.0, 2.0, dist);

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const particleFragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;
    float alpha = smoothstep(0.5, 0.15, d) * vAlpha * 0.6;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

/* ═══════════════════════════════════════════════════════════
   HERO ICOSAHEDRON — Main visible form
   ═══════════════════════════════════════════════════════════ */
function HeroIcosahedron() {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.x = t * 0.06;
      meshRef.current.rotation.y = t * 0.1;
    }
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4}>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.1, 24]} />
        <shaderMaterial
          ref={materialRef}
          vertexShader={heroVertexShader}
          fragmentShader={heroFragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uColor1: { value: new THREE.Color("#d4745f") },
            uColor2: { value: new THREE.Color("#8b7ec8") },
          }}
          transparent
          side={THREE.DoubleSide}
        />
      </mesh>
    </Float>
  );
}

/* ═══════════════════════════════════════════════════════════
   WIREFRAME OCTAHEDRON
   ═══════════════════════════════════════════════════════════ */
function WireOctahedron() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.x = -t * 0.06;
      meshRef.current.rotation.z = t * 0.1;
    }
  });

  return (
    <mesh ref={meshRef} position={[1.6, 0.5, -1.2]}>
      <octahedronGeometry args={[0.45, 0]} />
      <meshBasicMaterial color="#d4745f" wireframe transparent opacity={0.25} />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════
   ORBITAL RING
   ═══════════════════════════════════════════════════════════ */
function OrbitalRing() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const t = clock.getElapsedTime();
      meshRef.current.rotation.x = Math.PI / 3 + t * 0.04;
      meshRef.current.rotation.y = t * 0.06;
    }
  });

  return (
    <Float speed={2} rotationIntensity={0.1} floatIntensity={0.2}>
      <mesh ref={meshRef} position={[-1.2, -0.2, -0.4]}>
        <torusGeometry args={[0.55, 0.04, 16, 48]} />
        <meshPhysicalMaterial
          color="#c4b8e8"
          metalness={0.85}
          roughness={0.15}
          transparent
          opacity={0.5}
        />
      </mesh>
    </Float>
  );
}

/* ═══════════════════════════════════════════════════════════
   ACCENT DOTS — Small emissive spheres scattered around
   ═══════════════════════════════════════════════════════════ */
function AccentDots() {
  const groupRef = useRef<THREE.Group>(null);
  const dots = useMemo(() => [
    { pos: [1.2, -0.9, 0.4] as [number, number, number], size: 0.08, color: "#d4745f" },
    { pos: [-0.8, 1.1, -0.2] as [number, number, number], size: 0.06, color: "#9b8abf" },
    { pos: [0.4, 1.2, 0.6] as [number, number, number], size: 0.07, color: "#d4745f" },
    { pos: [-1.5, -0.5, 0.6] as [number, number, number], size: 0.05, color: "#e8b4a0" },
    { pos: [1.8, 0.2, -0.5] as [number, number, number], size: 0.06, color: "#9b8abf" },
  ], []);

  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.children.forEach((child, i) => {
        const t = clock.getElapsedTime();
        (child as THREE.Mesh).position.y = dots[i].pos[1] + Math.sin(t * 0.5 + i) * 0.15;
      });
    }
  });

  return (
    <group ref={groupRef}>
      {dots.map((d, i) => (
        <mesh key={i} position={d.pos}>
          <sphereGeometry args={[d.size, 12, 12]} />
          <meshPhysicalMaterial
            color={d.color}
            emissive={d.color}
            emissiveIntensity={0.5}
            metalness={0.7}
            roughness={0.2}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   PARTICLES — Atmospheric floating dot field
   ═══════════════════════════════════════════════════════════ */
function Particles({ count = 120 }: { count?: number }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { positions, scales, speeds, offsets } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const speeds = new Float32Array(count);
    const offsets = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.4 + Math.random() * 2.0;

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      scales[i] = 0.5 + Math.random() * 2;
      speeds[i] = 0.3 + Math.random() * 0.6;
      offsets[i] = Math.random() * Math.PI * 2;
    }

    return { positions, scales, speeds, offsets };
  }, [count]);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
    }
  });

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[scales, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
        <bufferAttribute attach="attributes-aOffset" args={[offsets, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uColor: { value: new THREE.Color("#d4745f") },
        }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCENE — The actual Three.js scene composition
   ═══════════════════════════════════════════════════════════ */
function Scene() {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.9} color="#fff5ee" />
      <directionalLight position={[-3, 2, -2]} intensity={0.25} color="#d0c4e8" />
      <pointLight position={[0, 0, 3]} intensity={0.4} color="#d4745f" />

      {/* Main form — highly visible shader icosahedron */}
      <HeroIcosahedron />

      {/* Secondary wireframe accent */}
      <WireOctahedron />

      {/* Ring accent */}
      <OrbitalRing />

      {/* Emissive accent dots */}
      <AccentDots />

      {/* Atmospheric particles */}
      <Particles count={60} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   HERO3DSCENE — Exported component
   No scroll dependency — purely ambient visual in hero
   ═══════════════════════════════════════════════════════════ */
export function Hero3DScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  if (reducedMotion) {
    return (
      <div ref={containerRef} className="relative w-full min-h-[400px] lg:min-h-[520px] flex items-center justify-center">
        <div className="w-32 h-32 border border-primary/20 rotate-45 bg-primary/5" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full min-h-[400px] lg:min-h-[520px] transition-opacity duration-1000"
      style={{ opacity: visible ? 1 : 0 }}
    >
      <div className="absolute inset-0">
        <Canvas
          camera={{ position: [0.3, 0, 5.2], fov: 42, near: 0.1, far: 50 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          style={{ background: "transparent", width: "100%", height: "100%" }}
        >
          <Scene />
        </Canvas>
      </div>
    </div>
  );
}
