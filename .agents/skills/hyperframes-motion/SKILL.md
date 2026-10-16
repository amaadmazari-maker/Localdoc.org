---
name: hyperframes-motion
description: After Effects-grade motion design, spring physics, frame-by-frame canvas animation, and micro-interaction easing for web interfaces.
---

# Hyperframes: After Effects & Web Motion Craft

## 1. Timing & Easing Curves
Never use standard `linear` or browser default `ease` for interactive elements. localDoc interfaces must feel alive, crisp, and responsive:

- **Snappy Entrance (After Effects Expo Out):**
  `transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease;`
- **Spring Overshoot / Pop (FAB, Success Icons):**
  `transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);`
- **Smooth Drawer / Modal Sheet Slide:**
  `transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);`

## 2. 60 FPS / 120 FPS Performance Rule
- Animate **ONLY** `transform` and `opacity`.
- Never animate `top`, `left`, `width`, `height`, `margin`, or `padding` during scroll or drag gestures, as these trigger expensive layout reflows.
- Use `will-change: transform` only on active dragging elements (such as 4-corner crop handles), and remove it when idle.

## 3. Tactile Camera Viewfinder Motion
- Shutter click: 80ms flash effect (`opacity: 0.2 -> 0 -> 1`).
- Loupe magnification: 0.15s exponential zoom centered on active drag touchpoint.
- Filter preview swipe: buttery horizontal glide with snap points (`scroll-snap-type: x mandatory`).
