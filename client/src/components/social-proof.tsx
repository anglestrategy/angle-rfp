import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * Social proof strip — compact credibility section
 * with animated stat counters and key trust signals.
 */

const PROOF_ITEMS = [
  { value: "500+", label: "RFPs Analyzed" },
  { value: "45s", label: "Avg. Processing" },
  { value: "97%", label: "Accuracy Rate" },
  { value: "4.9", label: "User Rating" },
];

export function SocialProof() {
  const sectionRef = useRef<HTMLElement>(null);
  const itemRefs = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Fade in the whole strip
      gsap.fromTo(
        sectionRef.current,
        { opacity: 0 },
        {
          opacity: 1,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );

      // Stagger items
      if (itemRefs.current.length > 0) {
        gsap.fromTo(
          itemRefs.current,
          { y: 20, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            stagger: 0.1,
            duration: 0.5,
            ease: "power3.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 80%",
              toggleActions: "play none none none",
            },
          }
        );
      }
    }, sectionRef.current);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-12 border-t border-b border-foreground/[0.04] bg-foreground/[0.01] relative overflow-hidden"
      style={{ opacity: 0 }}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Header */}
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground/40 mb-8">
          Trusted by proposal teams worldwide
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          {PROOF_ITEMS.map((item, i) => (
            <div
              key={item.label}
              ref={(el) => {
                if (el) itemRefs.current[i] = el;
              }}
              className="text-center"
              style={{ willChange: "transform, opacity" }}
            >
              <p className="text-2xl md:text-3xl font-black tracking-tight text-foreground/90 mb-1">
                {item.value}
              </p>
              <p className="font-mono text-[10px] text-muted-foreground/50 uppercase tracking-[0.15em]">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
