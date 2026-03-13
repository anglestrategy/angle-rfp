// client/src/components/chamber-scroll-state.ts

/**
 * Shared mutable scroll state for the Chamber Dissection scene.
 *
 * Written by GSAP ScrollTrigger (in ChamberSection) and read by
 * R3F useFrame hooks (in all Chamber sub-components).
 *
 * Using a plain mutable object instead of React state means the GSAP
 * onUpdate callback never triggers a React re-render cycle — the 3D
 * scene updates purely through the R3F frame loop.
 */
export const chamberScrollState = {
  progress: 0,
};
