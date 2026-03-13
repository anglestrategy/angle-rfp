import { useRef, useMemo, useEffect, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTheme } from "@/hooks/use-theme";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════
   AMBIENT PARTICLES — Full-page atmospheric WebGL layer
   Very lightweight — just floating dots for depth + mood.
   Fixed behind all content, responds to scroll position.
   ═══════════════════════════════════════════════════════════ */

const vertexShader = `
  uniform float uTime;
  uniform float uScroll;
  attribute float aSize;
  attribute float aPhase;
  attribute float aSpeed;
  varying float vAlpha;

  void main() {
    vec3 pos = position;

    // Gentle drift
    float t = uTime * aSpeed;
    pos.x += sin(t + aPhase) * 0.08;
    pos.y += cos(t * 0.7 + aPhase * 2.0) * 0.06;

    // Scroll causes slow upward drift
    pos.y += uScroll * 0.3;

    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
    float dist = -mvPosition.z;

    gl_PointSize = aSize * (50.0 / max(dist, 1.0));
    gl_PointSize = clamp(gl_PointSize, 0.5, 8.0);

    vAlpha = smoothstep(15.0, 3.0, dist) * 0.5;

    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = `
  uniform vec3 uColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - vec2(0.5));
    if (d > 0.5) discard;

    float alpha = smoothstep(0.5, 0.1, d) * vAlpha;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function FloatingDots({ color, count = 80 }: { color: string; count?: number }) {
  const meshRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const scrollRef = useRef(0);

  const { positions, sizes, phases, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const phases = new Float32Array(count);
    const speeds = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Wide spread in X/Y, shallow in Z
      positions[i * 3] = (Math.random() - 0.5) * 16;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 12;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 2;

      sizes[i] = 0.5 + Math.random() * 2;
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = 0.2 + Math.random() * 0.5;
    }

    return { positions, sizes, phases, speeds };
  }, [count]);

  useEffect(() => {
    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => {
        scrollRef.current = self.progress;
      },
    });

    return () => trigger.kill();
  }, []);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      materialRef.current.uniforms.uScroll.value = scrollRef.current;
    }
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uScroll: { value: 0 },
          uColor: { value: new THREE.Color(color) },
        }}
        transparent
        depthWrite={false}
      />
    </points>
  );
}

export function AmbientParticles() {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);

    // Delay mount for perf
    const timer = setTimeout(() => setVisible(true), 500);

    return () => {
      mql.removeEventListener("change", handler);
      clearTimeout(timer);
    };
  }, []);

  // Check for mobile — skip 3D on small screens
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (reducedMotion || !visible || isMobile) return null;

  // Dark mode: more particles, brighter orange, higher opacity (glass aesthetic)
  const isDark = theme === "dark";
  const particleColor = isDark ? "#e8793b" : "#d4745f";
  const particleCount = isDark ? 140 : 80;
  const containerOpacity = isDark ? 0.85 : 0.6;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[1] print:hidden"
      style={{ opacity: containerOpacity }}
    >
      <Canvas
        camera={{ position: [0, 0, 8], fov: 50 }}
        dpr={[1, 1]}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: "low-power",
        }}
        style={{ background: "transparent", pointerEvents: "none" }}
      >
        <FloatingDots color={particleColor} count={particleCount} />
      </Canvas>
    </div>
  );
}
