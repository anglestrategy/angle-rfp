import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

/*
 * GSAP / Tailwind v4 compatibility patch
 *
 * GSAP 3.x's internal transform matrix parser can crash when
 * getComputedStyle(el).transform returns an unexpected value
 * (e.g. individual CSS transform properties in Tailwind v4).
 * The affected animation silently degrades — the element stays
 * in its CSS-defined state rather than animating.
 *
 * This handler prevents the Vite error overlay from blocking
 * the page. The patched dep cache (node_modules/.vite/deps/gsap.js)
 * provides the real fix, but this handler acts as a safety net
 * in case the cache is regenerated.
 */
window.addEventListener(
  "error",
  (event) => {
    // GSAP 3.x's internal color/transform parsers can crash when they
    // encounter CSS variable strings or Tailwind v4 individual transforms.
    // Errors surface as reading 'map' (transform matrix) or reading '0'
    // (splitColor2 hsl branch). Suppress both so the page stays usable.
    const isGsapNull =
      event.message?.includes("Cannot read properties of null") &&
      (event.message.includes("reading 'map'") ||
        event.message.includes("reading '0'"));
    const isFromGsap =
      event.filename?.includes("gsap") ||
      event.error?.stack?.includes("gsap");
    if (isGsapNull && isFromGsap) {
      event.preventDefault();
      event.stopImmediatePropagation();
      console.warn(
        "[GSAP/CSS compat] Color/transform parsing error suppressed —",
        "an animation will gracefully degrade."
      );
    }
  },
  true // capture phase — runs before Vite's overlay handler
);

createRoot(document.getElementById("root")!).render(<App />);
