---
name: component-design
description: Use whenever creating, editing, or reviewing a React component (.tsx file) in this project — including primitives in src/components/ui, layout components, and section-scoped components. Covers file placement, props typing, exports, Tailwind/CVA styling, and accessibility rules. Trigger on requests like "create a component", "add a button/card/section piece", or any review of existing .tsx component files.
---

# Component Creation Contract — abdur-portfolio

## 1. Scope
Governs every UI component in this codebase: primitives, layout, and section-scoped components. Does not govern route files (see `route-design` skill) or section-level composition rules (see `section-design` skill).

## 2. File Structure

Components are single `.tsx` files in a scoped subdirectory under `src/components/`:

```
src/components/
├── ui/            # Primitive base components (shadcn-style), CVA-driven variants
│   ├── button.tsx
│   └── card.tsx
├── layout/         # App shell pieces used across the whole page (e.g. loading screen wrapper)
├── cursor/         # The light-source custom cursor system
└── scroll/         # Shared scroll infra (Lenis setup, scroll-trigger helpers)
```

Section-specific components (e.g. a card used only inside the Projects section) live inside that section's own folder — see `section-design` skill — NOT in `src/components/`. `src/components/` is reserved for things reused across 2+ sections.

- File names MUST use `kebab-case`.
- Co-locate a `[name]-utils.ts` for helper functions and a `[name]-types.ts`/`types.ts` for shared types when a component's logic grows.

## 3. Props Typing
- Props MUST be a named `type` or `interface`, defined above the component — never inline at the function signature.
- Exported types MUST be used when consumed outside the file.
- Event handlers use React's built-in types (`React.MouseEventHandler<...>`) or a plain function signature for simple cases.
- `children` MUST be typed `React.ReactNode`.

```tsx
type CursorLightProps = {
  size: number
  isHovering: boolean
}

export function CursorLight({ size, isHovering }: CursorLightProps) { /* ... */ }
```

## 4. Named Exports Only
No `export default`, anywhere, ever — components, hooks, and utilities alike.

## 5. Styling — Tailwind + `cn()` + CVA
- All styling uses Tailwind utility classes.
- Conditional/composed class strings MUST use a `cn()` utility (`clsx` + `tailwind-merge`) from `src/lib/utils.ts`.
- No CSS Modules.
- No inline `style` props, except a genuinely dynamic runtime value that can't be a Tailwind class (e.g. a computed cursor-light position) — must include an inline comment explaining why.
- Multi-variant primitives in `src/components/ui/` MUST use `class-variance-authority` (CVA).

```tsx
import { cn } from "@/lib/utils"

<div
  className={cn(
    "fixed pointer-events-none rounded-full mix-blend-screen transition-opacity",
    isHovering ? "opacity-100" : "opacity-60"
  )}
  style={{ transform: `translate(${x}px, ${y}px)` }} // dynamic cursor position, cannot be a Tailwind class
/>
```

## 6. Compound Components
A file MAY export multiple related named exports forming one logical unit (e.g. a component + its loading skeleton). Do not create a new file for a single helper used only in one component file.

## 7. Accessibility
- Interactive elements need accessible labels (`aria-label` when no visible text).
- Icon-only buttons: `aria-label` on the button, `aria-hidden="true"` on the icon.
- Form inputs need an associated `<label>`.
- `tabIndex` must never exceed `0`.
- **Project-specific:** since the cursor-as-light-source concept can visually de-emphasize content until "lit," all content MUST remain reachable and legible via keyboard navigation and screen readers regardless of cursor position — the light effect is a visual enhancement layered on top of a baseline-accessible page, never the sole way to perceive content.

## 8. Checklist
- [ ] Correct subdirectory (`ui/`, `layout/`, `cursor/`, `scroll/`, or owned by a section)
- [ ] `kebab-case` filename
- [ ] Props typed above the component
- [ ] Named exports only
- [ ] Tailwind + `cn()`; CVA if it's a `ui/` primitive
- [ ] Accessible regardless of cursor-light state
