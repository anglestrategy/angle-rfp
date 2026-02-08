# Angle RFP - Complete UI Redesign

**Date:** 2026-02-08
**Status:** Approved for Implementation

---

## Design Vision

**"Intelligent Clarity"** - A Linear-inspired premium dark experience that feels like a smart assistant presenting insights. Editorial data visualization approach inspired by NYT, Pudding.cool, and The New Yorker.

### Core Principles

1. **Accuracy First** - All extracted data visible, original client wording preserved, nothing summarized away
2. **Scannable at a Glance** - Hero area above fold, clear visual hierarchy for deep dives
3. **Editorial Data Viz** - Typography-driven, visualizations complement text, Pudding.cool aesthetic
4. **Premium Dark Mode** - Rich shadows, subtle gradients, layered surfaces, warm coral accents
5. **Scene-Based Navigation** - Full-screen scene transitions, not overlapping cards

---

## Color System

### Background Layers
```swift
Deepest     #0A0A0B   // near-black, for shadows and depth
Base        #111113   // main background
Elevated    #1A1A1E   // cards, panels
Surface     #222226   // hover states, secondary cards
```

### Accent Gradient (replacing Vermillion)
```swift
Primary     #E8734A → #F4A574  // warm coral to soft amber
Glow        rgba(232,115,74,0.15)
```

### Text Hierarchy
```swift
Primary     #FFFFFF (100%)           // headlines, key data
Secondary   rgba(255,255,255,0.72)   // body text
Tertiary    rgba(255,255,255,0.48)   // labels, captions
Muted       rgba(255,255,255,0.28)   // disabled, hints
```

### Semantic Colors
```swift
Success     #4ADE80   // softer green
Warning     #FBBF24   // warm yellow
Error       #F87171   // soft red
Info        #60A5FA   // calm blue
```

---

## Typography

Keep existing fonts, refine usage:

- **Headlines:** Urbanist Bold, larger tracking
- **Body:** Urbanist Medium
- **Labels:** Urbanist Semibold, all-caps, wide tracking
- **Data/Mono:** IBM Plex Mono
- **Pull Quotes:** Consider adding a serif for AI insights (optional)

---

## Navigation: Scene-Based Architecture

Replace Runway cards with full-screen scene transitions.

### Step Indicator (Top Bar)
- Horizontal pills that glow when active
- Completed steps show subtle checkmarks
- Smooth slide animation between steps
- Future steps dimmed but visible

### Transitions
- Content fades + slides (not whole card)
- Staggered element animations
- 300-400ms timing, ease-out curves

---

## Scene 1: Upload ("The Drop")

### Layout
```
┌──────────────────────────────────────────────┐
│                                              │
│       Drop your RFP to begin                 │  ← Large bold headline
│                                              │
│    ┌──────────────────────────────────┐     │
│    │                                  │     │
│    │     [Animated gradient orb]      │     │  ← Responds to drag
│    │                                  │     │
│    │      ↓  Drop files here          │     │
│    │                                  │     │
│    └──────────────────────────────────┘     │
│                                              │
│    PDF · DOCX · TXT                         │  ← Subtle hints
│                                              │
│    ┌──────────────────────────────────┐     │
│    │ 📄 proposal.pdf      12 MB   ✓  │     │  ← Minimal file cards
│    └──────────────────────────────────┘     │
│                                              │
│                        [Begin Analysis →]   │
└──────────────────────────────────────────────┘
```

### Key Elements
- Animated gradient orb (pulses gently, intensifies on drag)
- Minimal file cards (name, size, status icon only)
- Single CTA that appears when ready
- NO "Source Intake", "Drop Core", "Queue Ribbon" labels

---

## Scene 2: Analysis ("The Process")

### Layout
```
┌──────────────────────────────────────────────┐
│                                              │
│       Analyzing proposal.pdf                 │
│       ━━━━━━━━━━━━━━━━━░░░░░░ 68%           │
│                                              │
│   ┌────────────────────────────────────┐    │
│   │                                    │    │
│   │    [Live extraction preview]       │    │  ← Real-time data
│   │                                    │    │
│   │    Client: Acme Corp              │    │
│   │    Budget: $2.4M                  │    │
│   │    Deadline: March 15             │    │
│   │    ...extracting more...          │    │
│   │                                    │    │
│   └────────────────────────────────────┘    │
│                                              │
│   Parsing → Criteria → Research → Score     │
│      ✓        ●          ○         ○        │
│                                              │
└──────────────────────────────────────────────┘
```

### Key Elements
- Show extracted data as it's discovered (builds anticipation)
- Mini stage indicator at bottom
- Cancel option available

---

## Scene 3: Dashboard ("The Intel Brief")

### Design Philosophy
This is a scrollable **editorial data story**, not a cramped dashboard. Accuracy over aesthetics - all extracted data must be visible.

### Requirements Coverage

| Data Point | Section |
|------------|---------|
| Client name | Hero header |
| Project name | Hero header |
| Short description | Hero area |
| Financial score | Hero badge (right) |
| Scope of work | "Scope of Work" section (full text) |
| Agency vs non-agency % | Scope section (visual bars) |
| Financial potential | "Financial Potential" section (score + explanation) |
| Scoring breakdown | Financial section (factor bars) |
| Evaluation criteria | "Evaluation Criteria" section (exact RFP text + viz) |
| Deliverables | "Deliverables" section (checklist with descriptions) |
| Important dates | "Important Dates" section (timeline + details) |
| Submission method | "Submission Requirements" section (full text + copy button) |

### Complete Layout

#### Above the Fold (Hero)
```
┌─────────────────────────────────────────────────────────────┐
│  [← Back]                                    [Export ↓]     │
│                                                             │
│  ACME CORP                                  ┌─────────┐    │
│  Brand Campaign 2024                        │   78    │    │
│                                             │ ═══════ │    │
│  "A comprehensive brand refresh including   │ Strong  │    │
│   digital and print assets across channels."│  Fit    │    │
│                                             └─────────┘    │
└─────────────────────────────────────────────────────────────┘
```

#### Section: Scope of Work
- Full scope text (no summarization)
- Agency vs Non-Agency visual breakdown with percentages
- List of specific services in each category

#### Section: Financial Potential
- Score badge with recommendation level
- AI-generated explanation quote
- Factor breakdown (Budget, Scope, Client, Timeline) with mini-bars
- Formula explanation text

#### Section: Evaluation Criteria
- Exact text from RFP in quotes
- Visual weight bars for each criterion

#### Section: Deliverables
- Checklist format
- Each item with description if available

#### Section: Important Dates
- Horizontal timeline visualization
- Each date with title and details
- Deadline highlighted with warning

#### Section: Submission Requirements
- Exact text from RFP
- Copy-able email address button

#### Footer
- "Analyze Another" button
- "Export as PDF" button

---

## Component Library

### Cards
```swift
Base:     #1A1A1E fill, 1px border rgba(255,255,255,0.06)
Hover:    Border brightens to rgba(255,255,255,0.12), subtle shadow
Active:   Left border accent stripe
```

### Buttons
```swift
Primary:    Gradient fill (#E8734A → #F4A574), white text
Secondary:  Transparent, white text, subtle border
Ghost:      Transparent, muted text, no border
```

### Progress Bars
- Gradient fill on dark track
- Rounded ends
- Animated fill transitions

### Section Headers
- Urbanist Semibold, all-caps, tracking 1.4
- Subtle underline or fade-out horizontal rule

---

## Animation Guidelines

### Micro Interactions
- Duration: 140-200ms
- Easing: ease-out

### Standard Transitions
- Duration: 240-320ms
- Easing: cubic-bezier(0.22, 1.0, 0.36, 1.0)

### Scene Transitions
- Duration: 400-560ms
- Spring-based for emphasis
- Stagger child elements

### Reduce Motion
- All animations respect MotionPreference
- Reduced mode uses instant or minimal easing

---

## Implementation Phases

### Phase 1: Design System Update
1. Update DesignSystem.swift with new color palette
2. Add new gradient definitions
3. Update button styles
4. Update card styles

### Phase 2: Scene Navigation
1. Replace Runway architecture with scene-based navigation
2. Implement step indicator component
3. Add scene transitions

### Phase 3: Upload Scene
1. Redesign DocumentUploadView
2. Add animated drop zone
3. Simplify file cards

### Phase 4: Analysis Scene
1. Redesign AnalysisProgressView
2. Add live extraction preview
3. Improve progress visualization

### Phase 5: Dashboard Scene
1. Complete DashboardView redesign
2. Implement all sections per requirements
3. Add export functionality polish

### Phase 6: Polish
1. Animation refinement
2. Accessibility review
3. Performance optimization

---

## Files to Modify

### Core Design
- `Utilities/Constants/DesignSystem.swift`

### Views
- `App/ContentView.swift` (navigation architecture)
- `Views/Upload/DocumentUploadView.swift`
- `Views/Analysis/AnalysisProgressView.swift`
- `Views/Dashboard/DashboardView.swift`

### Components (may create new)
- Scene transition wrapper
- Step indicator
- Animated drop zone
- Section header component
- Timeline visualization
- Factor bar component

### Delete/Deprecate
- `Views/Shared/Runway/*` (replace with scene system)
- `Views/Shared/Tactile/*` (replace with new components)
