---
name: section-design
description: Use whenever creating, editing, or reviewing a page section (e.g. Hero, About, Projects, Skills, Contact) under src/sections/, or deciding whether a component/hook belongs in a section versus src/components or src/lib. Trigger on requests like "add a new section", "build the hero/projects/about section", or any structural question about section boundaries.
---

# Section Creation Contract — abdur-portfolio

## 1. Scope
Governs `src/sections/` — the scrollable content blocks that make up the single home page (Hero, About, Projects, Skills, Contact, etc.). This project is section-based, not feature-based: sections are presentational/narrative chunks of one continuous page, not independent business domains. This contract intentionally does NOT include a `features/` concept.

Full route-level pages that exist outside the single-page scroll (e.g. an individual project detail page) are NOT sections — see `route-design` skill; they live in `src/pages/`.

## 2. What Belongs in a Section
A section is a self-contained visual/narrative block of the home page.

**Rule:** if a component or hook is only ever used by one section, it lives inside that section's folder. If used by 2+ sections, it MUST move to `src/components/` (UI) or `src/lib/` (logic/utilities) — same escalation rule as before, just sections instead of features.

## 3. Standard Section Structure

```
src/sections/
└── projects/
    ├── projects-section.tsx        # The section entry component
    ├── components/                 # Sub-components used only within this section
    │   └── project-card.tsx
    ├── hooks/                      # Section-scoped hooks (e.g. scroll-triggered state)
    │   └── use-project-scroll-stack.ts
    └── projects-section-utils.ts   # Section-scoped helpers
```

Simple sections may be a single flat file (e.g. `src/sections/hero/hero-section.tsx`) without subfolders — don't create empty scaffolding folders for a section that doesn't need them yet. Propose the flat version first; expand only when the section actually grows sub-components or hooks.

### Directory Responsibilities

| Directory     | Contains                                              | MUST NOT contain          |
|---------------|--------------------------------------------------------|----------------------------|
| (section root)| The section's entry component, composed into the page  | Logic belonging to another section |
| `components/` | Sub-components used only within this section            | Cross-section UI (→ `src/components/`) |
| `hooks/`      | Hooks orchestrating this section's scroll/animation state | JSX, direct DOM mutation beyond refs |

## 4. Naming Conventions

| Artifact          | Convention                | Example                          |
|--------------------|----------------------------|-----------------------------------|
| Section directory  | `kebab-case`                | `projects`, `about`               |
| Entry component     | `kebab-case-section.tsx`    | `projects-section.tsx`            |
| Hook file           | `use-kebab-case.ts`         | `use-project-scroll-stack.ts`     |
| Sub-component        | `kebab-case.tsx`            | `project-card.tsx`                |

## 5. Import Pattern

The home page composes sections directly, in scroll order:

```tsx
// src/pages/home-page.tsx
import { HeroSection } from "@/sections/hero/hero-section"
import { AboutSection } from "@/sections/about/about-section"
import { ProjectsSection } from "@/sections/projects/projects-section"

export function HomePage() {
  return (
    <>
      <HeroSection />
      <AboutSection />
      <ProjectsSection />
    </>
  )
}
```

- No cross-section imports (one section reaching into another section's internals).
- No mandatory barrel `index.ts` per section.
- All exports are named exports.

## 6. Section Hook Pattern

Section hooks encapsulate scroll/animation orchestration for that section and MUST return a plain object.

```ts
// src/sections/projects/hooks/use-project-scroll-stack.ts
import { useRef } from "react"
import { useGSAP } from "@gsap/react"

export function useProjectScrollStack() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    // ScrollTrigger setup for this section only
  }, { scope: containerRef })

  return { containerRef }
}
```

## 7. Shared Logic

| What                              | Where                     |
|------------------------------------|----------------------------|
| Cursor/light-source system          | `src/components/cursor/`   |
| Lenis smooth-scroll setup           | `src/components/scroll/`   |
| GSAP/ScrollTrigger shared helpers   | `src/lib/animation/`       |
| `cn()` and general utilities        | `src/lib/utils.ts`         |
| Global primitive UI                  | `src/components/ui/`       |

## 8. Checklist
- [ ] Section directory is `kebab-case` under `src/sections/`
- [ ] Started flat; only split into `components/`/`hooks/` once actually needed
- [ ] Nothing imported across sections
- [ ] Logic used by 2+ sections promoted to `src/components/` or `src/lib/`
- [ ] Named exports only
