"use client";

import { memo, useCallback, useEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  variant?: "default" | "white";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}
const GlowingEffect = memo(
  ({
    blur = 10,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 120,
    variant = "default",
    glow = false,
    className,
    movementDuration = 0,
    borderWidth = 1,
    disabled = true,
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const lastPosition = useRef({ x: 0, y: 0 });
    const animationFrameRef = useRef<number>(0);

    const handleMove = useCallback(
      (e?: MouseEvent | { x: number; y: number }) => {
        if (!containerRef.current) return;

        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }

        animationFrameRef.current = requestAnimationFrame(() => {
          const element = containerRef.current;
          if (!element) return;

          const { left, top, width, height } = element.getBoundingClientRect();
          const mouseX = e?.x ?? lastPosition.current.x;
          const mouseY = e?.y ?? lastPosition.current.y;

          if (e) {
            lastPosition.current = { x: mouseX, y: mouseY };
          }

          const center = [left + width * 0.5, top + height * 0.5];
          const distanceFromCenter = Math.hypot(
            mouseX - center[0],
            mouseY - center[1]
          );
          const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

          if (distanceFromCenter < inactiveRadius) {
            element.style.setProperty("--active", glow ? "0.12" : "0");
            return;
          }

          const isActive =
            mouseX > left - proximity &&
            mouseX < left + width + proximity &&
            mouseY > top - proximity &&
            mouseY < top + height + proximity;

          element.style.setProperty("--active", isActive ? "0.9" : glow ? "0.12" : "0");
          element.style.setProperty("--x", `${mouseX - left}px`);
          element.style.setProperty("--y", `${mouseY - top}px`);
        });
      },
      [glow, inactiveZone, proximity, movementDuration]
    );

    useEffect(() => {
      if (disabled) return;

      // Respect prefers-reduced-motion — keep a static baseline glow, skip tracking
      const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (motionQuery.matches) {
        if (containerRef.current) {
          containerRef.current.style.setProperty("--active", glow ? "0.12" : "0");
        }
        return;
      }

      const handleScroll = () => handleMove();
      const handlePointerMove = (e: PointerEvent) => handleMove(e);

      window.addEventListener("scroll", handleScroll, { passive: true });
      document.body.addEventListener("pointermove", handlePointerMove, {
        passive: true,
      });

      return () => {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        window.removeEventListener("scroll", handleScroll);
        document.body.removeEventListener("pointermove", handlePointerMove);
      };
    }, [handleMove, disabled, glow]);

    return (
      <div
        ref={containerRef}
        style={
          {
            "--active": glow ? "0.12" : "0",
            "--x": "50%",
            "--y": "50%",
          } as CSSProperties
        }
        className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", className, disabled && "!hidden")}
      >
        <div
          className={cn(
            "absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          )}
          style={
            {
              opacity: "var(--active)",
              padding: `${borderWidth}px`,
              filter: blur > 0 ? `blur(${blur}px)` : undefined,
              background:
                variant === "white"
                  ? `radial-gradient(${spread}px circle at var(--x) var(--y), rgba(255,255,255,0.82), rgba(255,255,255,0.18) 36%, transparent 68%)`
                  : `radial-gradient(${spread}px circle at var(--x) var(--y), rgba(255,90,54,0.85), rgba(255,90,54,0.15) 35%, transparent 70%)`,
              WebkitMask:
                "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
              maskComposite: "exclude",
              boxShadow:
                variant === "white"
                  ? `inset 0 0 0 1px rgba(255,255,255,0.08)`
                  : `inset 0 0 0 ${borderWidth}px rgba(255,255,255,0.04)`,
            } as CSSProperties
          }
        />
      </div>
    );
  }
);

GlowingEffect.displayName = "GlowingEffect";

export { GlowingEffect };
