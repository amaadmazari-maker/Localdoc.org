---
name: vercel-web-design
description: Design principles and implementation guidelines based on Vercel and Geist design systems. Covers monochromatic contrast, sharp typography, precise 1px borders, subtle gradient accents, and performance-first web design.
---

# Vercel Web Design Guidelines & Geist System

## 1. Core Visual Tenets
- **Precision over Decoration:** Form follows precision. No unnecessary decorative bloat. Borders are razor-sharp `1px solid var(--border)`.
- **Monochromatic Canvas with Strategic Brand Accents:** The background, surfaces, and typography exist in harmonious grayscale. Rich teal `#0D9488` is reserved for key conversions, success states, and primary interaction hooks.
- **Glassmorphism with Blur:** Use `backdrop-filter: blur(12px)` with subtle border highlights on floating navigation, action bars, and modal sheets.

## 2. Spacing Scale & Golden Rhythm
Use an 8-point harmonic grid:
- `4px` (micro padding, badges)
- `8px` (button inline gaps, form field margins)
- `12px` (card content padding on mobile)
- `16px` (standard container padding, desktop card padding)
- `24px` (section separation on mobile)
- `32px` (desktop module gaps)
- `48px` / `64px` (major page sections)

## 3. Typography Hierarchy
- **Display 1:** `clamp(2rem, 5vw, 3.5rem)`, weight `800`, line-height `1.1`, letter-spacing `-0.035em`.
- **H2:** `1.5rem` to `2rem`, weight `700`, line-height `1.2`, letter-spacing `-0.02em`.
- **H3:** `1.125rem` to `1.25rem`, weight `600`, line-height `1.3`, letter-spacing `-0.01em`.
- **Body:** `0.9375rem` to `1rem`, weight `400` / `500`, line-height `1.6`.
- **Microcopy / Badges:** `0.75rem` to `0.8125rem`, weight `600`, uppercase or tabular.

## 4. Dark / Light Mode Parity
- Dark mode must not look like an inverted white page; it requires calibrated gray scales:
  - Background: `#0B0F19`
  - Surface: `#111827`
  - Border: `rgba(255, 255, 255, 0.1)`
  - Text Primary: `#F9FAFB`
  - Text Secondary: `#9CA3AF`
