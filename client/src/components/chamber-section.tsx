import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ChamberStage2D } from "./chamber-stage-2d";
import { chamberScrollState } from "./chamber-scroll-state";

gsap.registerPlugin(ScrollTrigger);

export function ChamberSection() {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const trigger = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: "bottom bottom",
      scrub: 1,
      onUpdate: (self) => {
        chamberScrollState.progress = self.progress;
      },
    });

    return () => {
      trigger.kill();
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      style={{ height: "1500vh", position: "relative" }}
      aria-label="Analysis Chamber"
    >
      <div
        style={{
          position: "sticky",
          top: 0,
          width: "100%",
          height: "100vh",
          overflow: "hidden",
          background: "#0a0908",
        }}
      >
        <ChamberStage2D />
      </div>
    </section>
  );
}
