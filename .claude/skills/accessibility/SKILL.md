---
name: accessibility
description: Use whenever building or reviewing any component or section, to ensure it is fully accessible — keyboard navigation, touch/mobile accessibility, and screen reader support, per WCAG 2.2 Level AA. Trigger on every component/section creation, and specifically whenever the cursor-light effect, custom scroll, or any custom-interaction UI is involved, since these are the highest accessibility risk areas in this project.
---

# Accessibility Contract — abdur-portfolio

## 1. Scope and Target
Every component and section built in this project MUST be fully accessible, conforming to **WCAG 2.2 Level AA**, across three access modes: keyboard, touch/mobile, and screen reader. This applies universally — not just to obviously "interactive" elements. This contract works alongside the `component-design` and `section-design` skills' baseline a11y rules and the `testing` skill's `vitest-axe` requirement; this file is the authoritative detail behind those references.

## 2. Why This Project Needs Extra Care
This site's core interaction concepts — the cursor-as-light-source effect, scroll-driven axis changes (x/z movement, card-stacking-style effects), and a custom cursor — are all **mouse-hover-dependent by nature**. None of them exist for keyboard-only users, touch users (no hover state on mobile), or screen reader users. The standing rule: **these effects are a visual enhancement layered on top of a fully accessible baseline experience, never a requirement for perceiving or using content.** If a section only "works" when you move a mouse over it, that section is not done.

## 3. Keyboard Accessibility
- Every interactive element (links, buttons, project cards, form inputs) MUST be reachable via `Tab` and operable via `Enter`/`Space`, in a logical order matching visual/reading order.
- Visible focus indicators are REQUIRED on every focusable element — never remove `outline` without providing an equally visible custom focus style.
- No content or navigation path may depend on hover-only reveal (e.g. content that only becomes visible when the light-cursor is near it). Keyboard-focused elements MUST trigger the same reveal/emphasis state that mouse-hover or light-proximity would.
- `tabIndex` must never exceed `0`; don't create custom tab order unless there's a specific, justified reason.
- No keyboard traps — a user must always be able to `Tab` away from any element/modal.

## 4. Touch / Mobile Accessibility
- Touch targets MUST be at least 24x24 CSS px (WCAG 2.2 AA minimum), with adequate spacing to avoid mis-taps.
- No functionality may depend on `:hover` alone — mobile has no hover state. Any hover-triggered reveal/effect MUST have a touch equivalent (e.g. tap-to-reveal, or content visible by default on touch devices).
- The custom cursor and cursor-light effect MUST be disabled/replaced on touch devices — they have no meaning without a mouse. Detect touch capability and fall back to a touch-appropriate presentation (e.g. content visible by default, no cursor-follower element rendered).
- Scroll-driven animations must not interfere with native scroll gestures, pinch-zoom, or cause horizontal scroll-jacking on mobile that traps the user.

## 5. Screen Reader Accessibility
- Semantic HTML first: use `<button>`, `<a>`, `<nav>`, `<section>`, headings in order — not `<div onClick>` masquerading as interactive elements.
- Every section MUST have a properly nested heading (`h1` → `h2` → `h3`, no skipped levels) so screen reader users can navigate by heading structure.
- Images MUST have meaningful `alt` text (or `alt=""` if purely decorative).
- Purely decorative/visual-only elements (the cursor-light glow, particle/3D decoration) MUST be `aria-hidden="true"` and `inert` to assistive tech — they carry no content, so they shouldn't be announced.
- Dynamic content changes driven by scroll (items appearing/disappearing) should not cause disorienting or excessive screen reader announcements — prefer `aria-live="off"` or no live region at all for purely decorative scroll reveals; reserve live regions for genuinely important state changes (e.g. form submission result).
- Reduced motion: respect `prefers-reduced-motion` — scroll-driven animations, the cursor-light follow, and 3D motion MUST be significantly reduced or disabled when this is set, per WCAG 2.2's motion-related success criteria.

## 6. Verification Method
- **Automated:** every component/section test file includes a `vitest-axe` check (per the `testing` skill) — this catches contrast, missing labels, ARIA misuse, and similar programmatically-detectable issues.
- **Manual (required in addition, not instead):** axe-core cannot detect everything — logical tab order, whether keyboard focus triggers the correct visual state, touch target adequacy, and whether reduced-motion is actually honored all require manual verification. This is part of the confirm/verify step in the standing workflow: before a unit is approved, check it with `Tab`-only navigation and with `prefers-reduced-motion` toggled on, in addition to the automated axe check.

## 7. Checklist
- [ ] Fully keyboard operable, visible focus states, no hover-only content
- [ ] Touch targets ≥24x24px, no hover-dependent functionality on touch devices, cursor-light effect disabled on touch
- [ ] Semantic HTML, correct heading order, meaningful `alt` text, decorative elements `aria-hidden`
- [ ] `prefers-reduced-motion` honored — scroll/cursor/3D motion reduced or disabled
- [ ] `vitest-axe` passes (automated) AND manual keyboard + reduced-motion check done (not automatable)
