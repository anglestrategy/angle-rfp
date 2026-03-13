import React, { useRef, useCallback, useEffect } from "react";
import gsap from "gsap";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  /** Color of the glow shadow on hover. Defaults to a warm orange. */
  glowColor?: string;
}

/**
 * TiltCard -- a GSAP-powered 3D tilt-on-hover wrapper.
 *
 * Wraps any content (cards, panels, etc.) and applies a subtle
 * perspective tilt that follows the cursor, plus a warm glow on hover.
 *
 * Uses GSAP `quickTo` for buttery 60fps updates without creating
 * a new tween on every mousemove event.
 */
export function TiltCard({
  children,
  className = "",
  glowColor = "rgba(232,121,59,0.15)",
}: TiltCardProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Persistent quickTo tweens -- created once, reused on every frame.
  const quickRotateX = useRef<gsap.QuickToFunc | null>(null);
  const quickRotateY = useRef<gsap.QuickToFunc | null>(null);

  // ------------------------------------------------------------------
  // Initialise GSAP quickTo targets on mount
  // ------------------------------------------------------------------
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Set initial transform style so GSAP has a baseline
    gsap.set(card, {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      transformPerspective: 800,
    });

    // quickTo creates a reusable setter that interpolates toward
    // the target value at 60fps without allocating a new tween.
    quickRotateX.current = gsap.quickTo(card, "rotateX", {
      duration: 0.4,
      ease: "power2.out",
    });

    quickRotateY.current = gsap.quickTo(card, "rotateY", {
      duration: 0.4,
      ease: "power2.out",
    });
  }, []);

  // ------------------------------------------------------------------
  // Mouse move -- compute tilt angles from cursor position
  // ------------------------------------------------------------------
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card || !quickRotateX.current || !quickRotateY.current) return;

      const rect = card.getBoundingClientRect();

      // Normalise cursor position to -0.5 … +0.5
      const normalX = (e.clientX - rect.left) / rect.width - 0.5;
      const normalY = (e.clientY - rect.top) / rect.height - 0.5;

      // Max tilt: ±2 degrees.  Y-axis mirrors horizontal movement;
      // X-axis mirrors vertical movement (inverted so the card
      // "leans toward" the cursor).
      const tiltX = -normalY * 4; // ±2 deg
      const tiltY = normalX * 4; // ±2 deg

      quickRotateX.current(tiltX);
      quickRotateY.current(tiltY);
    },
    [],
  );

  // ------------------------------------------------------------------
  // Mouse enter -- subtle scale-up + glow shadow
  // ------------------------------------------------------------------
  const handleMouseEnter = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    gsap.to(card, {
      scale: 1.005,
      boxShadow: `0 4px 20px ${glowColor}`,
      duration: 0.4,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, [glowColor]);

  // ------------------------------------------------------------------
  // Mouse leave -- reset tilt, scale, and shadow cleanly
  // ------------------------------------------------------------------
  const handleMouseLeave = useCallback(() => {
    const card = cardRef.current;
    if (!card) return;

    // Kill any in-flight quickTo interpolations so they don't
    // fight the reset tween and cause stuck states.
    gsap.killTweensOf(card, "rotateX,rotateY");

    gsap.to(card, {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      boxShadow: "0 0px 0px rgba(0,0,0,0)",
      duration: 0.5,
      ease: "power2.out",
      overwrite: "auto",
    });
  }, []);

  // ------------------------------------------------------------------
  // Cleanup on unmount -- kill every tween targeting the card
  // ------------------------------------------------------------------
  useEffect(() => {
    const card = cardRef.current;
    return () => {
      if (card) gsap.killTweensOf(card);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{ perspective: 800 }}
      className={className}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={cardRef}
        style={{
          willChange: "transform",
          transformStyle: "preserve-3d",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default TiltCard;
