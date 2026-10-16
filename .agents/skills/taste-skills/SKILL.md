---
name: taste-skills
description: Comprehensive workflow and evaluation guidelines for high-taste, premium UI/UX design. Enforces optical hierarchy, micro-interactions, tactile feel, and modern aesthetic craftsmanship.
---

# Taste Skills: The High-Aesthetic Craftsmanship Framework

When building or refining interfaces for LocalDoc, avoid standard generic templates or raw Bootstrap-like layouts. Elevate every visual element using this 6-pillar taste framework:

## 1. Visual Hierarchy & Optical Balance
- **Focal Dominance:** Every screen has exactly ONE primary hero action. Secondary actions use subtle ghost, tinted, or outline styles.
- **Optical Weight vs. Geometric Center:** Icons, badges, and text must be optically centered, accounting for ascenders, descenders, and asymmetric glyph weights.
- **Information Density:** High information density without visual noise. Use clean dividing lines (`1px solid var(--border-subtle)`), not bulky cards or heavy drop shadows.

## 2. Micro-Interactions & Tactile Feedback
- **Active / Pressed State:** All clickable cards and primary buttons must react to `:active` with `transform: scale(0.98)` and a refined transition (`transform 0.1s cubic-bezier(0.16, 1, 0.3, 1)`).
- **Hover Glow:** Interactive controls feature subtle radial gradient or box-shadow blooms (`box-shadow: 0 4px 20px rgba(13, 148, 136, 0.25)`).
- **Skeleton Shimmers & Instant Feedback:** Zero jarring blank states. Transitions between states must be seamless.

## 3. Depth & Layering
- **Layer 0 (Background):** Slate base (`#090D16` dark, `#F8FAFC` light).
- **Layer 1 (Cards & Worksurfaces):** Translucent backdrop blur (`backdrop-filter: blur(16px); background: rgba(17, 24, 39, 0.8)`).
- **Layer 2 (Overlays & Modals):** Crisp border highlights with inner bevels (`box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1), 0 20px 40px rgba(0,0,0,0.4)`).

## 4. Typography Discipline
- Never use generic system defaults when brand fonts are defined.
- Pair high-legibility geometric sans (`Plus Jakarta Sans`, `Inter`) for headers with clean tabular figures for measurements, file sizes, and counters (`font-variant-numeric: tabular-nums`).
- Tight letter-spacing on display headings: `letter-spacing: -0.025em` for titles >= 24px.
