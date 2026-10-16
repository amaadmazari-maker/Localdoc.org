---
name: design-system-tokens
description: Master token system for colors, typography, spacing, and micro-interactions across LocalDoc. Ensures consistent aesthetic fidelity and cohesive visual harmony.
---

# Master Design Tokens: Colors, Typography & Spacing

## 1. Color Palette System
```css
:root {
  /* Brand Teal Matrix */
  --color-brand-50: #F0FDFA;
  --color-brand-100: #CCFBF1;
  --color-brand-200: #99F6E4;
  --color-brand-500: #14B8A6;
  --color-brand-600: #0D9488; /* Primary action */
  --color-brand-700: #0F766E;
  --color-brand-800: #115E59;

  /* Neutral Slate (Light Theme) */
  --color-bg-light: #F8FAFC;
  --color-surface-light: #FFFFFF;
  --color-surface-subtle-light: #F1F5F9;
  --color-border-light: #E2E8F0;
  --color-text-main-light: #0F172A;
  --color-text-sub-light: #64748B;

  /* Neutral Slate (Dark Theme) */
  --color-bg-dark: #0B0F19;
  --color-surface-dark: #111827;
  --color-surface-subtle-dark: #1F2937;
  --color-border-dark: rgba(255, 255, 255, 0.08);
  --color-text-main-dark: #F8FAFC;
  --color-text-sub-dark: #94A3B8;

  /* Status Tokens */
  --color-success: #10B981;
  --color-warning: #F59E0B;
  --color-danger: #EF4444;
  --color-info: #3B82F6;
}
```

## 2. Spacing Rhythms
```css
:root {
  --space-2: 2px;
  --space-4: 4px;
  --space-8: 8px;
  --space-12: 12px;
  --space-16: 16px;
  --space-20: 20px;
  --space-24: 24px;
  --space-32: 32px;
  --space-48: 48px;
  --space-64: 64px;
}
```

## 3. Touch Target Minimums
- All buttons, chips, and interactive icons: minimum `44px × 44px` physical touch area (via `min-height: 44px` or `padding: 10px 16px`).
