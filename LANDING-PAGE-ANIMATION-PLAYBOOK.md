# Premium Landing Page Animation Playbook
## Deep Technical Analysis of 6 Award-Winning Sites

---

## SITE 1: Virtual Well-being Hub (virtualwellbeinghub.ca)
**Awwwards Honorable Mention (Aug 2025)**

### Section Structure (top to bottom)
1. **Hero / Intro** -- Immersive fullscreen opening with narrative text
2. **Six Wellness Dimensions** -- Interactive cards/panels for each wellness pillar
3. **Personalized Tools Section** -- Interactive tool discovery
4. **Services Showcase** -- Scroll-driven service reveals
5. **Student Testimonials / Social Proof**
6. **CTA / Footer**

### Scroll Animation Patterns
- **Smooth colorful interactions**: Background color transitions triggered by scroll position; each wellness dimension has its own color palette that bleeds into the viewport as the user scrolls
- **Narrative in motion**: Text and visual elements animate in sequence as the user scrolls, creating a storytelling flow; text splits and reveals character-by-character or line-by-line
- **Scroll-linked section transitions**: Sections morph and cross-fade rather than hard-cutting; smooth opacity and transform transitions tied to scroll progress

### 3D / WebGL Elements
- Canvas-based animated backgrounds that respond to scroll
- Particle/organic shape animations for each wellness dimension
- No heavy Three.js scene -- relies on 2D canvas + CSS transforms for depth illusion

### Visual Design Language
- **Colors**: Vibrant, warm palette cycling through wellness dimensions (greens, blues, oranges, purples)
- **Typography**: Large display type, likely variable-weight sans-serif
- **Glass effects**: Frosted glass cards with backdrop-blur
- **Gradients**: Multi-color radial gradients that shift per section

### Hero Section Approach
- Full-viewport immersive intro with large typographic statement
- Animated color washes that signal interactivity
- Scroll-down indicator with subtle bounce animation

### Key Signature Techniques
1. **Color palette morphing on scroll** -- each section smoothly transitions the entire page background color
2. **Narrative-driven scroll storytelling** -- the page reads like a guided journey through wellness dimensions

### Implementable Pattern
```js
// Color transition on scroll with GSAP ScrollTrigger
gsap.to("body", {
  backgroundColor: "#2D5F3A",
  scrollTrigger: {
    trigger: ".wellness-section-2",
    start: "top center",
    end: "bottom center",
    scrub: 1,
  }
});
```

---

## SITE 2: Madar Platform (madarplatform.com/en)
**Unified Logistics Platform -- Saudi Arabia**

### Section Structure (top to bottom)
1. **Hero** -- Bold headline with logistics-themed animation
2. **Platform Overview** -- Animated icon/illustration panels
3. **Features Carousel/Grid** -- Route optimization, KPIs, shipment scheduling
4. **Case Study (Yamama Cement)** -- Scroll-triggered story reveal
5. **Digital Payments Section** -- Digital Wallet + Digital Invoicing
6. **KPI Dashboard Preview** -- Animated dashboard mockup
7. **Request a Demo CTA**
8. **Footer**

### Scroll Animation Patterns
- **Staggered card reveals**: Feature cards animate in with staggered delays as they enter the viewport
- **Horizontal scroll section**: Feature showcase uses horizontal scroll-within-vertical-scroll pattern (pin + horizontal translate)
- **Read More expand animations**: Sections use collapsible panels with smooth height transitions
- **Parallax depth on images**: Product screenshots have slight parallax offset from their text descriptions

### 3D / WebGL Elements
- No heavy 3D -- relies on Lottie-style icon animations and CSS transforms
- Animated SVG illustrations for logistics concepts
- Possible Rive/Lottie animations for truck routes and delivery flows

### Visual Design Language
- **Colors**: Deep navy/dark blue primary, vibrant teal/cyan accents, white text
- **Typography**: Clean geometric sans-serif, large bold headlines
- **Layout**: Card-based grid system with generous whitespace
- **Textures**: Subtle noise/grain overlay on dark sections

### Hero Section Approach
- Large statement headline about logistics transformation
- Animated background elements (routes, connections)
- CTA button with hover glow effect

### Key Signature Techniques
1. **Horizontal scroll feature showcase** -- pinned section that scrolls features left-to-right
2. **Staggered reveal with intersection observer** -- cards cascade in with offset timing

### Implementable Pattern
```js
// Horizontal scroll section (pin + scrub)
const sections = gsap.utils.toArray(".feature-panel");
gsap.to(sections, {
  xPercent: -100 * (sections.length - 1),
  ease: "none",
  scrollTrigger: {
    trigger: ".features-container",
    pin: true,
    scrub: 1,
    end: () => "+=" + document.querySelector(".features-container").offsetWidth,
  }
});
```

---

## SITE 3: WMF 5000 S+ Coffee Machine (wmf-coffeemachines.com)
**Premium Product Page**

### Section Structure (top to bottom)
1. **Hero** -- Product name + rotating/interactive 3D model viewer
2. **Tagline Section** -- "Elegant design. Blazing speed." with word-by-word text reveal
3. **3D Model Viewer** -- "Take a closer look / View it in your space" with AR QR code
4. **Milk Options** -- 2-Milk Solution feature highlight
5. **Feature Carousel** -- Hotspot-style feature breakdown (AutoClean, AutoSteam, display, powder hopper)
6. **Consistent Quality** -- Quality assurance section
7. **Chilled Coffee** -- Cold brew capabilities
8. **CoffeConnect** -- Digital solutions integration
9. **Specs / Technical Details**
10. **Footer / Related Products**

### Scroll Animation Patterns
- **Word-by-word text reveal**: The tagline animates with each word appearing sequentially, scrubbed to scroll position. The raw HTML confirms individual words wrapped in separate elements.
- **3D model rotation on scroll**: The coffee machine 3D model rotates as the user scrolls, revealing different angles
- **Hotspot feature reveals**: Feature callouts appear with connecting lines to the 3D model as you scroll through sections
- **Pin-and-scrub product showcase**: The 3D model stays pinned while feature descriptions scroll alongside

### 3D / WebGL Elements
- **Interactive 3D product model**: WebGL/Three.js based model viewer with orbit controls
- **AR integration**: "View it in your space" with QR code for mobile AR
- **Scroll-linked camera rotation**: Camera orbits the product model as scroll progress changes

### Visual Design Language
- **Colors**: Pure black background, white text, silver/metallic product renders
- **Typography**: Clean sans-serif, word-spaced reveal animations
- **Layout**: Full-bleed product imagery, generous vertical spacing
- **Effects**: High-contrast product photography with studio lighting

### Hero Section Approach
- Dark, premium product photography filling the viewport
- Product title with subtle entrance animation
- 3D model as the centerpiece that immediately signals interactivity

### Key Signature Techniques
1. **Scroll-scrubbed 3D product rotation** -- the machine rotates like Apple product pages
2. **Word-by-word text reveal** -- individual words animate in sequence tied to scroll progress

### Implementable Pattern
```js
// Word-by-word reveal scrubbed to scroll
const words = gsap.utils.toArray(".tagline .word");
gsap.from(words, {
  opacity: 0.15,
  stagger: 0.05,
  scrollTrigger: {
    trigger: ".tagline-section",
    start: "top 80%",
    end: "top 20%",
    scrub: true,
  }
});

// 3D model rotation pinned to scroll
gsap.to(camera.position, {
  scrollTrigger: {
    trigger: ".product-showcase",
    start: "top top",
    end: "+=300%",
    pin: true,
    scrub: 1,
    onUpdate: (self) => {
      model.rotation.y = Math.PI * 2 * self.progress;
    }
  }
});
```

---

## SITE 4: Relats Top Tier (toptier.relats.com)
**Awwwards Site of the Day (Oct 21, 2025) -- Score 7.46/10, Dev Award 7.5/10**

### Section Structure (top to bottom)
1. **Loading Screen** -- Progress counter (0%)
2. **Hero** -- "Protection sleeves for the mobility of tomorrow" with zoom-out parallax
3. **360 Partner Statement** -- "Your 360 partner for safety in electromobility"
4. **Product Showcase** -- E-mobility solutions with technical specs (Revitex WSX45, VSC25, VSCTF)
5. **Temperature/Specs Grid** -- "Up to 1,000C", "Electrical Insulation" with animated counters
6. **Product Detail Cards** -- Expandable cards with operating temp, flammability, thermal runaway data
7. **Industries Section** -- "We make mobility safer across all industries"
8. **Industry Cards** -- Construction, Hybrid/Electric, Buses/Trucks, Rail
9. **Full View / Overview toggle**
10. **Footer / Contact**

### Scroll Animation Patterns
- **Zoom-out parallax hero** (THE signature technique): Hero image starts scaled up (zoomed in) and scales down as user scrolls, revealing the full composition -- creates a dramatic depth effect. A dedicated YouTube tutorial (by Olivier Larose / Smooth Scrolling channel) recreates this exact technique.
- **Pinned sections with scrubbed animations**: Product sections pin while spec data animates in
- **Parallax depth layers**: Multiple image/text layers move at different speeds creating depth
- **Counter animations**: Temperature values and spec numbers count up as they enter viewport
- **Scroll-linked storytelling**: Linear narrative from problem to solution to products to industries
- **Image parallax cards**: Product images have parallax offset from their containing cards

### 3D / WebGL Elements
- No Three.js -- achieves the 3D feel through pure CSS transforms and GSAP
- Scale transforms + parallax create a convincing depth illusion
- Possible WebGL shader for image distortion effects on scroll

### Visual Design Language
- **Colors**: 2-color palette (deep dark near-black + accent color, likely orange/copper)
- **Typography**: Industrial, bold sans-serif -- fits the technical/engineering product
- **Layout**: Full-bleed imagery, technical data grids, generous spacing
- **Textures**: Industrial photography, close-up material textures

### Hero Section Approach
- Zoomed-in product/material photography that slowly zooms out on scroll
- Bold display typography overlaid on the imagery
- Loading progress counter builds anticipation
- "Scroll down" indicator

### Key Signature Techniques
1. **Zoom-out parallax on scroll** -- hero starts at scale(2-3) and scrubs down to scale(1), the single most impactful effect
2. **Industrial storytelling flow** -- technical data presented as a narrative scroll journey

### Implementable Pattern
```js
// Zoom-out parallax hero (the Relats signature effect)
gsap.fromTo(".hero-image",
  { scale: 2.5 },
  {
    scale: 1,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero-section",
      start: "top top",
      end: "bottom top",
      scrub: 1,
      pin: true,
    }
  }
);

// Parallax depth layers at different speeds
gsap.utils.toArray(".parallax-layer").forEach((layer, i) => {
  const depth = layer.dataset.depth || (i + 1) * 0.2;
  gsap.to(layer, {
    yPercent: -50 * depth,
    ease: "none",
    scrollTrigger: {
      trigger: layer.parentElement,
      start: "top bottom",
      end: "bottom top",
      scrub: true,
    }
  });
});

// Counter animation on scroll
gsap.to(".temp-counter", {
  innerText: 1000,
  snap: { innerText: 1 },
  scrollTrigger: {
    trigger: ".specs-section",
    start: "top 70%",
    end: "top 30%",
    scrub: 1,
  }
});
```

---

## SITE 5: Who Is Guilty (promo.whoisguilty.com)
**Awwwards Site of the Day (May 4, 2025) -- Score 7.28/10, Dev Award 7.55/10**

### Section Structure (top to bottom)
1. **Preloader** -- Custom loading animation with sound toggle prompt
2. **Hero** -- "Who is guilty" title with illustrated characters
3. **Narrative Setup** -- "This is a story about a designer and a developer..."
4. **Conflict Introduction** -- "Who screwed up the project?"
5. **Timeline Scene: "A few months earlier..."** -- 15:00 SALTBOOT office
6. **Designer & Dev Kickoff** -- Illustrated dialogue with scroll-triggered speech bubbles
7. **Prototyping Phase** -- "Prototyping prototypes" scrolling text marquee
8. **Design Phase** -- "Designus Conceptus" with animated design elements
9. **Handoff Phase** -- "Here! Code it!" with dramatic reveal
10. **Development Phase** -- "Develop-ment, Develop-end"
11. **The Reveal** -- "Tadaaaa! But... It's... Oooooh..."
12. **Fixes Loop** -- "Fixes", "Fixes 2.0", "Fixes NEW"
13. **Resolution** -- "Let's do it this way"
14. **Happy Ending** -- "This story had a happy ending after all"
15. **CTA** -- Guides for designers + developers
16. **Credits** -- Directed by reboot + salt and pepper

### Scroll Animation Patterns
- **Scroll-driven comic strip storytelling**: Each scroll increment reveals the next panel of a visual story, like reading a comic book
- **Speech bubble reveals**: Dialogue bubbles animate in with bounce/pop as you scroll to them
- **Section switching**: Entire scene transitions between story phases, likely using pinned sections with cross-fades
- **Marquee/ticker text**: "Prototyping prototypes" repeating text scrolls horizontally
- **Page transitions**: Smooth transitions between major story acts
- **Mouse interactions**: Cursor effects that change based on hover state
- **Sound integration**: Audio cues tied to scroll events for immersion

### 3D / WebGL Elements
- Illustration-based, not WebGL
- Custom illustrated characters and scenes
- SVG animations for character movements and expressions
- Possible Lottie/Rive for character animation sequences

### Visual Design Language
- **Colors**: 2-color palette (black/white or near-monochrome with one accent)
- **Typography**: Playful, hand-drawn or comic-style type mixed with clean sans-serif
- **Illustrations**: Custom flat/cartoon character illustrations
- **Layout**: Vertical scrolling comic strip format
- **Sound**: Audio effects integrated into scroll events

### Hero Section Approach
- Large illustrated title card with character art
- Sound toggle prompt for immersive experience
- Immediate narrative hook: "This is a story about..."

### Key Signature Techniques
1. **Scroll-driven narrative storytelling** -- a complete story told through scroll, each section is a "scene"
2. **Sound design integrated with scroll** -- audio cues at key story moments create immersion beyond visual

### Implementable Pattern
```js
// Comic-strip scene reveals with pin
const scenes = gsap.utils.toArray(".story-scene");
scenes.forEach((scene) => {
  const elements = scene.querySelectorAll(".dialogue, .character, .effect");

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: scene,
      start: "top top",
      end: "+=150%",
      pin: true,
      scrub: 1,
    }
  });

  tl.from(elements, {
    opacity: 0,
    y: 30,
    scale: 0.8,
    stagger: 0.15,
  });
});

// Marquee text effect
gsap.to(".marquee-text", {
  xPercent: -50,
  repeat: -1,
  duration: 10,
  ease: "linear",
});

// Sound triggered at scroll waypoints
ScrollTrigger.create({
  trigger: ".reveal-scene",
  start: "top center",
  onEnter: () => playSound("tadaaa.mp3"),
  once: true,
});
```

---

## SITE 6: Poly.app
**The Intelligent Cloud File Browser -- Built with Nuxt**

### Section Structure (top to bottom)
1. **Loading Screen** -- Spinner + loading images (hero-loading.webp)
2. **Hero** -- Product hero with file browser UI preview
3. **Search Demo** -- Animated search interaction (typing query, results populating)
4. **AI Search Results** -- Grid of search results animating in (50+ preloaded WebP images per category: urban, upcycled, fashion, pre-search)
5. **Conversation/AI Chat** -- AI assistant interaction demo with profile images
6. **View Modes Showcase** -- 6 modes: Feed, Grid, File, Tree, Column, Gallery (each with its own background image)
7. **Features Grid** -- 12 feature cards with background images and SVG icons (Desktop Sync, Long Context, Version History, Public Sharing, Flexible Viewing, Shared Drives, Hide from AI, Extensive File Properties, Privacy & Security, Offline Support, Fluent UI, Collaborative Conversations)
8. **CTA / Pricing**
9. **Footer** -- Poly gemstone logo, sparkle/mystic ball emojis

### Scroll Animation Patterns
- **Product UI animation on scroll**: The file browser interface animates through usage scenarios as you scroll -- search bar types, results populate, views switch
- **Image grid animations**: Photo thumbnails animate into grid positions with staggered timing
- **Scroll-scrubbed demo walkthrough**: The product demo advances step-by-step tied to scroll
- **Horizontal feature carousel**: Feature cards cycle with duplicated sets (the 12 cards are repeated in the HTML for infinite scroll illusion)
- **View mode transitions**: The file browser seamlessly transitions between 6 view modes
- **Massive image preloading**: 100+ WebP images preloaded across categories for seamless transitions

### 3D / WebGL Elements
- **Built with Nuxt** (evidenced by `/_nuxt/` asset paths and SVG icon imports)
- No heavy 3D -- the product IS the visual centerpiece
- Smooth transitions between product states serve as the "3D"

### Visual Design Language
- **Colors**: Clean white/light background, subtle shadows, Apple-like minimalism
- **Typography**: System/native-feeling sans-serif, clean and readable
- **Layout**: Product-centered, UI demo fills the viewport
- **Imagery**: High-quality product screenshots, lifestyle photography for demo content
- **Textures**: Minimal -- relies on product UI shadows and depth

### Hero Section Approach
- Product hero showing the actual UI (not abstract)
- Loading state with spinner transitions to the product reveal
- Immediate value proposition through visual demo rather than text

### Key Signature Techniques
1. **Scroll-scrubbed product demo** -- the entire page IS a product walkthrough; each scroll increment advances the demo
2. **Massive image preloading for seamless transitions** -- aggressive CDN-hosted WebP preloading (fs.cdn.poly.app) ensures butter-smooth scroll

### Implementable Pattern
```js
// Scroll-scrubbed product demo walkthrough
const demoSteps = [
  { trigger: ".search-section", action: "typeSearch" },
  { trigger: ".results-section", action: "showResults" },
  { trigger: ".chat-section", action: "showAIChat" },
  { trigger: ".views-section", action: "cycleViews" },
];

demoSteps.forEach(({ trigger, action }) => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger,
      start: "top top",
      end: "+=200%",
      pin: true,
      scrub: 1,
    }
  });
  buildDemoAnimation(tl, action);
});

// Image preloading for smooth sequences
const preloadImages = (urls) => {
  return Promise.all(
    urls.map(url => new Promise((resolve) => {
      const img = new Image();
      img.onload = resolve;
      img.src = url;
    }))
  );
};
```

---

# SYNTHESIS: Cross-Site Animation Playbook

## Technique Matrix

| Technique | Well-being Hub | Madar | WMF | Relats | Who Is Guilty | Poly |
|---|---|---|---|---|---|---|
| Pin-and-scrub | Yes | Yes | Yes | Yes | Yes | Yes |
| Color/theme transitions | Yes | - | Yes | Yes | Yes | - |
| Text reveal (word/char) | Yes | Yes | Yes | Yes | Yes | - |
| Zoom-out parallax | Yes | - | Yes | Yes | - | - |
| Horizontal scroll | - | Yes | - | - | Yes | Yes |
| Canvas image sequence | - | - | Yes | - | - | Yes |
| Staggered viewport entry | Yes | Yes | - | Yes | Yes | Yes |
| Custom preloader | - | - | - | Yes | Yes | Yes |
| Sound integration | - | - | - | - | Yes | - |
| 3D model (WebGL) | - | - | Yes | - | - | - |
| Lottie/SVG animation | Yes | Yes | - | - | Yes | - |
| Smooth scroll (Lenis) | Likely | Likely | Likely | Likely | Likely | Likely |

---

## 8 Universal Patterns (with code)

### Pattern 1: Pin-and-Scrub (6/6 sites)
The single most universal pattern. A section pins to the viewport while animations play, scrubbed to scroll progress.

```js
const tl = gsap.timeline({
  scrollTrigger: {
    trigger: ".section",
    start: "top top",
    end: "+=300%",     // 3x viewport height of scroll distance
    pin: true,          // stick to viewport
    scrub: 1,           // 1-second smoothing
    anticipatePin: 1,   // prevents jank on pin start
  }
});

tl.from(".element-1", { opacity: 0, y: 50 })
  .from(".element-2", { opacity: 0, y: 50 }, "-=0.3")
  .to(".element-1", { opacity: 0 }, "+=0.2");
```

### Pattern 2: Scroll-Linked Color/Theme Transitions (4/6 sites)
Background color, text color, or entire theme shifts as the user scrolls between sections.

```js
const sections = [
  { trigger: ".section-1", bg: "#0a0a0a", text: "#ffffff" },
  { trigger: ".section-2", bg: "#1a3a2a", text: "#e0f0e0" },
  { trigger: ".section-3", bg: "#2a1a3a", text: "#f0e0f0" },
];

sections.forEach(({ trigger, bg, text }) => {
  gsap.to(":root", {
    "--bg-color": bg,
    "--text-color": text,
    scrollTrigger: {
      trigger,
      start: "top center",
      end: "bottom center",
      scrub: 1,
    }
  });
});
```

### Pattern 3: Text Reveal Animations (5/6 sites)

```js
// Option A: Word-by-word opacity reveal (WMF-style)
const words = gsap.utils.toArray(".headline .word");
gsap.fromTo(words,
  { opacity: 0.15 },
  {
    opacity: 1,
    stagger: 0.05,
    scrollTrigger: {
      trigger: ".headline",
      start: "top 75%",
      end: "top 25%",
      scrub: true,
    }
  }
);

// Option B: Line-by-line slide-up reveal
gsap.from(".line", {
  y: "100%",
  opacity: 0,
  stagger: 0.1,
  duration: 0.8,
  ease: "power3.out",
  scrollTrigger: {
    trigger: ".text-block",
    start: "top 80%",
    toggleActions: "play none none reverse",
  }
});
```

### Pattern 4: Zoom-Out / Scale Parallax (3/6 sites)

```js
// Hero zoom-out (Relats signature technique)
gsap.fromTo(".hero-media",
  { scale: 2.5, transformOrigin: "center center" },
  {
    scale: 1,
    ease: "none",
    scrollTrigger: {
      trigger: ".hero-wrapper",
      start: "top top",
      end: "bottom top",
      scrub: 1,
      pin: true,
    }
  }
);

// Multi-layer depth zoom
gsap.utils.toArray("[data-parallax-scale]").forEach(el => {
  const startScale = parseFloat(el.dataset.parallaxScale) || 1.5;
  gsap.fromTo(el,
    { scale: startScale },
    {
      scale: 1,
      scrollTrigger: {
        trigger: el.closest("section"),
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      }
    }
  );
});
```

### Pattern 5: Horizontal Scroll Within Vertical (3/6 sites)

```js
const container = document.querySelector(".horizontal-container");
const panels = gsap.utils.toArray(".horizontal-panel");

gsap.to(panels, {
  xPercent: -100 * (panels.length - 1),
  ease: "none",
  scrollTrigger: {
    trigger: container,
    pin: true,
    scrub: 1,
    snap: 1 / (panels.length - 1),
    end: () => "+=" + container.scrollWidth,
  }
});
```

### Pattern 6: Canvas Image Sequence Scrub (2/6 sites)

```js
// Apple-style frame sequence (from builder.io/blog/3d-gsap)
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const frameCount = 120;
const images = [];

for (let i = 0; i < frameCount; i++) {
  const img = new Image();
  img.src = `/frames/frame-${String(i).padStart(4, "0")}.webp`;
  images.push(img);
}

const frameRef = { frame: 0 };
gsap.to(frameRef, {
  frame: frameCount - 1,
  snap: "frame",
  scrollTrigger: {
    trigger: ".sequence-container",  // h-[300vh] relative
    start: "top top",
    end: "bottom bottom",
    scrub: 1,
  },
  onUpdate: () => {
    const img = images[Math.round(frameRef.frame)];
    if (img?.complete) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    }
  }
});

// Container: <div class="h-[300vh] relative">
//   <canvas class="sticky top-0 w-full h-screen" />
// </div>
```

### Pattern 7: Staggered Viewport Entry (5/6 sites)

```js
// Batch viewport entry animation
ScrollTrigger.batch(".reveal-element", {
  onEnter: (batch) => {
    gsap.from(batch, {
      opacity: 0,
      y: 40,
      stagger: 0.1,
      duration: 0.8,
      ease: "power2.out",
    });
  },
  start: "top 85%",
  once: true,
});

// Card grid staggered reveal
gsap.from(".feature-card", {
  opacity: 0,
  y: 60,
  scale: 0.95,
  stagger: {
    each: 0.1,
    grid: "auto",
    from: "start",
  },
  scrollTrigger: {
    trigger: ".features-grid",
    start: "top 75%",
    toggleActions: "play none none reverse",
  }
});
```

### Pattern 8: Custom Preloader (4/6 sites)

```js
const loader = { progress: 0 };
gsap.to(loader, {
  progress: 100,
  duration: 2,
  ease: "power2.inOut",
  onUpdate: () => {
    document.querySelector(".loader-text").textContent =
      `${Math.round(loader.progress)}%`;
  },
  onComplete: () => {
    gsap.to(".loader", {
      yPercent: -100,
      duration: 0.8,
      ease: "power3.inOut",
      onComplete: () => heroTimeline.play(),
    });
  }
});
```

---

## Implementation Architecture

### Smooth Scrolling Foundation
```js
// Lenis (the dominant choice in 2025 award sites)
import Lenis from "lenis";

const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smooth: true,
});

// Connect to GSAP ScrollTrigger
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

### React Setup
```js
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function AnimatedSection() {
  const containerRef = useRef(null);

  useGSAP(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: containerRef.current,
        start: "top top",
        end: "+=200%",
        pin: true,
        scrub: 1,
      }
    });
    tl.from(".element", { opacity: 0, y: 50 });
  }, { scope: containerRef });

  return <div ref={containerRef}>...</div>;
}
```

### CSS Foundation
```css
/* Glass / Frosted Panel (Well-being Hub, Poly) */
.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}

/* Dark Premium Product (WMF, Relats) */
:root {
  --bg-primary: #0a0a0a;
  --text-primary: #fafafa;
  --accent: #c8a97e;
}

/* Smooth Scroll Container */
html { scroll-behavior: auto; } /* Let Lenis handle it */
body { overflow-x: hidden; }
section { position: relative; }
```

---

## Priority Implementation Ranking

**Impact-to-effort ratio across all 6 sites:**

### Tier 1: High Impact, Moderate Effort (implement first)
1. **Pin-and-scrub sections** -- foundation of every site
2. **Text reveal animations** (word-by-word opacity) -- instant premium feel
3. **Staggered viewport entry** -- simplest upgrade for any card grid
4. **Color/theme transitions on scroll** -- transforms entire page mood

### Tier 2: High Impact, Higher Effort
5. **Zoom-out parallax hero** -- single most dramatic opening (Relats SOTD winner)
6. **Horizontal scroll sections** -- excellent for feature showcases
7. **Loading/preloader sequence** -- sets the tone before content

### Tier 3: Showcase Techniques
8. **Canvas image sequence scrub** -- Apple-level product reveals
9. **Scroll-driven product demo** -- ideal for SaaS landing pages (Poly)
10. **Audio integration with scroll** -- highly memorable but niche (Who Is Guilty)

---

## Performance Notes (from Dev Award analysis)

- Relats scored 7.5 Dev Award -- clean implementation, optimized images
- Who Is Guilty scored 7.55 Dev Award -- highest dev score, excellent code quality
- All sites use WebP for images (Poly has 100+ WebP assets preloaded)
- Preloading is critical for image sequences and parallax layers
- Use `will-change: transform` sparingly on animated elements
- Prefer transform/opacity over layout-triggering properties
- Call `ScrollTrigger.refresh()` after dynamic content loads
- Use `anticipatePin: 1` to prevent pin jank on slower devices
- Heavy image sequences need a container with `h-[300vh] relative` and canvas with `sticky top-0`
