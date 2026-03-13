import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Scale, Shield, FileText, FileCheck, Target, Clock } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════════
   SCROLL 3D FEATURES — Immersive scrollytelling showcase

   6 features revealed as user scrolls through pinned section.
   3D sphere morphs on the right, feature cards on the left.
   Camera orbits gently to give each feature a unique angle.
   ═══════════════════════════════════════════════════════════ */

/* ── Feature data ── */
const FEATURES = [
  {
    num: "01",
    title: "Fit Score",
    desc: "Weighted scoring across 6 dimensions with instant go/no-go recommendation.",
    icon: Scale,
    accent: "#d4745f",
  },
  {
    num: "02",
    title: "Risk Register",
    desc: "Every risk ranked by severity with mitigation strategies ready to present.",
    icon: Shield,
    accent: "#c4745f",
  },
  {
    num: "03",
    title: "Executive Brief",
    desc: "One-page PDF summary for leadership sign-off, generated in seconds.",
    icon: FileText,
    accent: "#a07598",
  },
  {
    num: "04",
    title: "Contract Terms",
    desc: "Key clauses, obligations, and red flags surfaced automatically.",
    icon: FileCheck,
    accent: "#9b8abf",
  },
  {
    num: "05",
    title: "Scope Analysis",
    desc: "Deliverables, technical requirements, and resource mapping extracted.",
    icon: Target,
    accent: "#8b7ec8",
  },
  {
    num: "06",
    title: "Submission Guide",
    desc: "Deadlines, format requirements, and compliance checklist at a glance.",
    icon: Clock,
    accent: "#8b7ec8",
  },
];

/* ── Shared scroll state ── */
interface ScrollState {
  progress: number;
  activeFeature: number; // 0-5
  featureProgress: number; // 0-1 within current feature
}

/* ═══════════════════════════════════════════════════════════
   VERTEX DISPLACEMENT SHADER — Morphing geometric mesh
   ═══════════════════════════════════════════════════════════ */
const morphVertexShader = `
  uniform float uTime;
  uniform float uMorph;
  uniform float uNoiseScale;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisplacement;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
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
    float noiseFreq = mix(2.5, 0.8, uMorph);
    float noiseAmp = mix(0.18, 0.04, uMorph);
    float n = snoise(position * noiseFreq + uTime * 0.2) * noiseAmp;
    vec3 pos = position + normal * n * uNoiseScale;
    vDisplacement = n;
    vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const morphFragmentShader = `
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uMorph;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisplacement;

  void main() {
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
    vec3 baseColor = mix(uColor1, uColor2, uMorph);
    vec3 rimColor = mix(vec3(0.83, 0.45, 0.37), vec3(0.65, 0.55, 0.82), uMorph);
    float dispColor = smoothstep(-0.2, 0.2, vDisplacement);
    vec3 color = mix(baseColor, rimColor, fresnel * 0.8 + dispColor * 0.2);
    float alpha = 0.85 + fresnel * 0.15;
    gl_FragColor = vec4(color, alpha);
  }
`;

/* ═══════════════════════════════════════════════════════════
   MORPHING SPHERE — Central object that transforms
   ═══════════════════════════════════════════════════════════ */
function MorphingSphere({ scrollState }: { scrollState: ScrollState }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame(({ clock }) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = clock.getElapsedTime();
      materialRef.current.uniforms.uMorph.value = scrollState.progress;
      materialRef.current.uniforms.uNoiseScale.value = 1.0;
    }
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.08;
      meshRef.current.rotation.x = scrollState.progress * 0.4;
      const s = 1 + scrollState.progress * 0.15;
      meshRef.current.scale.setScalar(s);
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[0.85, 24]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={morphVertexShader}
        fragmentShader={morphFragmentShader}
        uniforms={{
          uTime: { value: 0 },
          uMorph: { value: 0 },
          uNoiseScale: { value: 1.0 },
          uColor1: { value: new THREE.Color("#d4745f") },
          uColor2: { value: new THREE.Color("#8b7ec8") },
        }}
        transparent
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════
   ORBITAL RINGS — Rings that orbit the central sphere
   ═══════════════════════════════════════════════════════════ */
function OrbitalRings({ scrollState }: { scrollState: ScrollState }) {
  const group1Ref = useRef<THREE.Group>(null);
  const group2Ref = useRef<THREE.Group>(null);
  const group3Ref = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const p = scrollState.progress;

    if (group1Ref.current) {
      group1Ref.current.rotation.x = Math.PI / 3 + t * 0.05;
      group1Ref.current.rotation.y = t * 0.03;
      group1Ref.current.scale.setScalar(1 + p * 0.25);
    }
    if (group2Ref.current) {
      group2Ref.current.rotation.x = -Math.PI / 4 + t * 0.04;
      group2Ref.current.rotation.z = t * 0.06;
      group2Ref.current.scale.setScalar(0.9 + p * 0.2);
    }
    if (group3Ref.current) {
      group3Ref.current.rotation.y = Math.PI / 6 + t * 0.07;
      group3Ref.current.rotation.z = -t * 0.03;
      group3Ref.current.scale.setScalar(1.1 + p * 0.15);
    }
  });

  return (
    <>
      <group ref={group1Ref}>
        <mesh>
          <torusGeometry args={[1.3, 0.006, 8, 80]} />
          <meshBasicMaterial color="#d4745f" transparent opacity={0.15} />
        </mesh>
      </group>
      <group ref={group2Ref}>
        <mesh>
          <torusGeometry args={[1.6, 0.005, 8, 80]} />
          <meshBasicMaterial color="#9b8abf" transparent opacity={0.1} />
        </mesh>
      </group>
      <group ref={group3Ref}>
        <mesh>
          <torusGeometry args={[1.05, 0.005, 8, 80]} />
          <meshBasicMaterial color="#e8b4a0" transparent opacity={0.12} />
        </mesh>
      </group>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   DATA POINTS — Scattered nodes that organize on scroll
   ═══════════════════════════════════════════════════════════ */
function DataPoints({ scrollState }: { scrollState: ScrollState }) {
  const groupRef = useRef<THREE.Group>(null);

  const points = useMemo(() => {
    const count = 24;
    const result = [];
    for (let i = 0; i < count; i++) {
      const chaos = new THREE.Vector3(
        (Math.random() - 0.5) * 6,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 3,
      );
      const theta = (i / count) * Math.PI * 2;
      const phi = Math.acos(2 * (i / count) - 1);
      const r = 1.7;
      const organized = new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      );
      result.push({
        chaos,
        organized,
        size: 0.03 + Math.random() * 0.05,
        color: i % 3 === 0 ? "#d4745f" : i % 3 === 1 ? "#9b8abf" : "#e8d5cf",
      });
    }
    return result;
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    const p = scrollState.progress;
    groupRef.current.children.forEach((child, i) => {
      if (i >= points.length) return;
      const mesh = child as THREE.Mesh;
      const point = points[i];
      mesh.position.lerpVectors(point.chaos, point.organized, p);
      const s = THREE.MathUtils.lerp(0.5, 1.2, p);
      mesh.scale.setScalar(s);
    });
  });

  return (
    <group ref={groupRef}>
      {points.map((point, i) => (
        <mesh key={i} position={point.chaos}>
          <sphereGeometry args={[point.size, 8, 8]} />
          <meshPhysicalMaterial
            color={point.color}
            metalness={0.6}
            roughness={0.3}
            emissive={point.color}
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCROLL CAMERA — Cinematic camera orbit through 6 features
   ═══════════════════════════════════════════════════════════ */
function ScrollCamera({ scrollState }: { scrollState: ScrollState }) {
  const { camera } = useThree();

  useFrame(() => {
    const p = scrollState.progress;

    // Gentle continuous orbit — full 360° over the scroll
    const angle = p * Math.PI * 1.5; // 270° orbit total
    const radius = THREE.MathUtils.lerp(5.5, 4.2, p * (1 - p) * 4); // closer in middle, further at edges
    const x = Math.sin(angle) * radius * 0.3;
    const y = THREE.MathUtils.lerp(0.5, 0.2, p) + Math.sin(p * Math.PI) * 0.5;
    const z = Math.cos(angle) * radius * 0.15 + THREE.MathUtils.lerp(5.5, 4.5, p);

    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════
   SCENE — Full scroll-driven 3D composition
   ═══════════════════════════════════════════════════════════ */
function TransitionScene({ scrollState }: { scrollState: ScrollState }) {
  return (
    <>
      <ScrollCamera scrollState={scrollState} />
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 5, 5]} intensity={0.8} color="#fff5ee" />
      <directionalLight position={[-3, -2, 4]} intensity={0.25} color="#d0c4e8" />
      <pointLight position={[0, 0, 2]} intensity={0.4} color="#d4745f" distance={8} />
      <MorphingSphere scrollState={scrollState} />
      <OrbitalRings scrollState={scrollState} />
      <DataPoints scrollState={scrollState} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   FEATURE CARD — Single feature overlay
   ═══════════════════════════════════════════════════════════ */
function FeatureCard({
  feature,
  featureRef,
  index,
}: {
  feature: typeof FEATURES[number];
  featureRef: React.RefObject<HTMLDivElement>;
  index: number;
}) {
  const Icon = feature.icon;
  const isRight = index % 2 === 1;

  return (
    <div
      ref={featureRef}
      className={`absolute top-1/2 -translate-y-1/2 opacity-0 ${
        isRight ? "right-8 md:right-16 text-right" : "left-8 md:left-16 text-left"
      }`}
      style={{ willChange: "transform, opacity" }}
    >
      {/* Feature number */}
      <span className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-primary/60 block mb-3">
        {feature.num} / 06
      </span>

      {/* Icon + title */}
      <div className={`flex items-center gap-3 mb-3 ${isRight ? "justify-end" : ""}`}>
        <div
          className="h-10 w-10 flex items-center justify-center border border-primary/20"
          style={{ backgroundColor: `${feature.accent}10` }}
        >
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h3 className="text-2xl md:text-3xl font-bold tracking-tight">
          {feature.title}
        </h3>
      </div>

      {/* Description */}
      <p className={`text-sm md:text-base text-muted-foreground leading-relaxed max-w-[320px] ${isRight ? "ml-auto" : ""}`}>
        {feature.desc}
      </p>

      {/* Accent line */}
      <div
        className={`h-[2px] w-12 mt-4 ${isRight ? "ml-auto" : ""}`}
        style={{ backgroundColor: feature.accent }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCROLL3DTRANSITION — Exported pinned scroll section
   ═══════════════════════════════════════════════════════════ */
export function Scroll3DTransition() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const scrollStateRef = useRef<ScrollState>({ progress: 0, activeFeature: 0, featureProgress: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [visible, setVisible] = useState(false);

  // Refs for 6 feature cards
  const featureRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  const progressBarRef = useRef<HTMLDivElement>(null);
  const sectionTitleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!sectionRef.current || reducedMotion || isMobile) return;

    const ctx = gsap.context(() => {
      // Helper: fade in/out an element based on scroll progress thresholds
      const fadeCard = (
        el: HTMLElement,
        p: number,
        fadeInStart: number,
        fadeInEnd: number,
        fadeOutStart: number,
        fadeOutEnd: number,
      ) => {
        let opacity = 0;
        let y = 40;

        if (p < fadeInStart) {
          opacity = 0;
          y = 40;
        } else if (p < fadeInEnd) {
          const t = (p - fadeInStart) / (fadeInEnd - fadeInStart);
          const ease = t * t * (3 - 2 * t); // smoothstep
          opacity = ease;
          y = 40 * (1 - ease);
        } else if (p < fadeOutStart) {
          opacity = 1;
          y = 0;
        } else if (p < fadeOutEnd) {
          const t = (p - fadeOutStart) / (fadeOutEnd - fadeOutStart);
          const ease = t * t * (3 - 2 * t);
          opacity = 1 - ease;
          y = -20 * ease;
        } else {
          opacity = 0;
          y = -20;
        }

        el.style.opacity = String(opacity);
        el.style.transform = `translateY(calc(-50% + ${y}px))`;
      };

      // Main scroll trigger — 6 features over 400% scroll distance
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=400%",
        pin: true,
        scrub: 1,
        onUpdate: (self) => {
          const p = self.progress;
          scrollStateRef.current.progress = p;

          // Determine active feature (0-5)
          const featureIndex = Math.min(5, Math.floor(p * 6));
          scrollStateRef.current.activeFeature = featureIndex;
          scrollStateRef.current.featureProgress = (p * 6) - featureIndex;

          // Progress bar
          if (progressBarRef.current) {
            progressBarRef.current.style.transform = `scaleX(${p})`;
          }

          // Section title: fade out once scrolling begins
          if (sectionTitleRef.current) {
            const titleOp = p < 0.02 ? 1 : p < 0.08 ? 1 - ((p - 0.02) / 0.06) : 0;
            sectionTitleRef.current.style.opacity = String(titleOp);
          }

          // Each feature card:
          // Feature N occupies scroll range [N/6, (N+1)/6]
          // Fade in during first 20%, hold 60%, fade out last 20%
          const FEATURE_COUNT = 6;
          for (let i = 0; i < FEATURE_COUNT; i++) {
            const el = featureRefs[i]?.current;
            if (!el) continue;

            const start = i / FEATURE_COUNT;
            const end = (i + 1) / FEATURE_COUNT;
            const duration = end - start;

            const fadeIn = start + duration * 0.05;
            const fadeInDone = start + duration * 0.2;
            const fadeOutStart = start + duration * 0.75;
            const fadeOutDone = start + duration * 0.95;

            fadeCard(el, p, fadeIn, fadeInDone, fadeOutStart, fadeOutDone);
          }
        },
      });
    });

    return () => ctx.revert();
  }, [reducedMotion, isMobile]);

  if (reducedMotion || isMobile) {
    return (
      <section className="py-24 md:py-32">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-4">
            What You Get
          </h2>
          <p className="text-2xl font-bold tracking-tight mb-12">
            Six dimensions of RFP intelligence.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.num} className="border border-foreground/5 p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-bold">{f.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={sectionRef}
      className="relative h-screen overflow-hidden"
    >
      {/* 3D Canvas — fills viewport, offset right via camera */}
      <div
        ref={canvasContainerRef}
        className="absolute inset-0 transition-opacity duration-1000"
        style={{ opacity: visible ? 1 : 0 }}
      >
        <Canvas
          camera={{ position: [0, 0.5, 5.5], fov: 45, near: 0.1, far: 50 }}
          dpr={[1, 1.5]}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 1.1,
          }}
          style={{ background: "transparent" }}
        >
          <TransitionScene scrollState={scrollStateRef.current} />
        </Canvas>
      </div>

      {/* Section intro title — fades out on scroll */}
      <div
        ref={sectionTitleRef}
        className="absolute top-8 left-8 md:left-16 z-10"
        style={{ willChange: "opacity" }}
      >
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2">
          What You Get
        </p>
        <p className="text-lg md:text-xl font-semibold tracking-tight text-foreground/60 max-w-[280px]">
          Six dimensions of intelligence
        </p>
      </div>

      {/* Feature cards — overlaid on 3D, alternating sides */}
      <div className="absolute inset-0 pointer-events-none z-10">
        {FEATURES.map((feature, i) => (
          <FeatureCard
            key={feature.num}
            feature={feature}
            featureRef={featureRefs[i]}
            index={i}
          />
        ))}
      </div>

      {/* Gradient overlays for text readability */}
      <div className="absolute inset-0 pointer-events-none z-[5]">
        <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-background/50 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-background/50 to-transparent" />
        {/* Side gradient for text contrast */}
        <div className="absolute top-0 bottom-0 left-0 w-[45%] bg-gradient-to-r from-background/70 via-background/30 to-transparent" />
        <div className="absolute top-0 bottom-0 right-0 w-[45%] bg-gradient-to-l from-background/70 via-background/30 to-transparent" />
      </div>

      {/* Progress indicator — dot steps */}
      <div className="absolute right-6 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-3">
        {FEATURES.map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-all duration-300"
            style={{
              backgroundColor: `hsl(var(--primary))`,
              opacity: 0.15 + (scrollStateRef.current.activeFeature === i ? 0.85 : 0),
              transform: `scale(${scrollStateRef.current.activeFeature === i ? 1.5 : 1})`,
            }}
          />
        ))}
      </div>

      {/* Bottom progress bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <div className="w-16 h-[2px] bg-foreground/10 overflow-hidden">
          <div
            ref={progressBarRef}
            className="h-full bg-primary origin-left"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
        <span className="font-mono text-[9px] text-muted-foreground/40 uppercase tracking-wider">
          scroll
        </span>
      </div>
    </section>
  );
}
