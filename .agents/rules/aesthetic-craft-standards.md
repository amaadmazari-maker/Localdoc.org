# LocalDoc Aesthetic & Design Craft Standards

These rules apply to all web interfaces, tools, and pages within LocalDoc:

1. **Aesthetic Excellence & WOW Factor:**
   - Every interface must feel state-of-the-art, modern, and high-craft (Vercel/Linear calibre).
   - Use curated HSL colors, subtle borders (`1px solid rgba(255, 255, 255, 0.08)` or `#E2E8F0`), and gentle glassmorphism blur.
   - Avoid generic or basic MVP layouts.

2. **Colors, Typography & Spacing:**
   - Follow the 8-point harmonic spacing scale (`4px`, `8px`, `12px`, `16px`, `24px`, `32px`).
   - Use `Plus Jakarta Sans` or modern sans typography with optical kerning (`letter-spacing: -0.02em` on headings).
   - Keep touch targets >= 44px on mobile viewports.

3. **Hyperframes Motion & Easing:**
   - Use physics-based bezier curves (`cubic-bezier(0.16, 1, 0.3, 1)` for entrances, `cubic-bezier(0.34, 1.56, 0.64, 1)` for spring buttons).
   - Animate only `transform` and `opacity` to preserve 60/120fps smoothness.
