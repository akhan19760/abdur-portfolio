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

**Rule:** `src/sections/<name>/` holds only the section's entry component (and section-root-only helpers, e.g. static copy/constants used solely by that entry file). A component or hook that supports a section — even one only ever used by that single section — does NOT live inside `src/sections/<name>/`. Per CLAUDE.md's project-structure convention, it lives in the matching domain folder that mirrors the section: sub-components go in `src/components/<domain>/`, hooks go in `src/hooks/<domain>/`, and any dedicated types go in `src/types/<domain>/` — creating the domain folder if it doesn't exist yet. This holds regardless of whether the piece is used by one section or several; the domain folder IS the section-scoped home, so there is no separate "used by 2+ sections" escalation step for components/hooks. `src/lib/` remains for logic/utilities that aren't React components or hooks at all (e.g. pure functions, formatters) and are shared across domains.

## 3. Standard Section Structure

```
src/sections/
└── projects/
    └── projects-section.tsx        # The section entry component only

src/components/projects/            # Sub-components used by the Projects section
└── project-card.tsx

src/hooks/projects/                 # Hooks orchestrating the Projects section's scroll/animation state
└── use-project-scroll-stack.ts

src/types/projects/                 # Types dedicated to the Projects section
└── project.types.ts
```

Simple sections may be a single flat file (e.g. `src/sections/hero/hero-section.tsx`) with no supporting domain folders yet — don't create empty scaffolding folders for a section that doesn't need them. Propose the flat version first; add to `src/components/<domain>/` / `src/hooks/<domain>/` only once the section actually grows sub-components or hooks.

### Directory Responsibilities

| Directory                | Contains                                              | MUST NOT contain          |
|---------------------------|--------------------------------------------------------|----------------------------|
| `src/sections/<name>/`    | The section's entry component, composed into the page  | Sub-components, hooks, or logic belonging to another section |
| `src/components/<domain>/`| Sub-components used by that section's domain            | Cross-domain UI (→ `src/components/ui/` or `src/components/shared/`) |
| `src/hooks/<domain>/`     | Hooks orchestrating that section's scroll/animation state | JSX, direct DOM mutation beyond refs |
| `src/types/<domain>/`     | Types dedicated to that section's domain                 | Types shared across domains (→ `src/types/shared/`) |

## 4. Naming Conventions

| Artifact          | Convention                | Example                          |
|--------------------|----------------------------|-----------------------------------|
| Section directory  | `kebab-case`                | `projects`, `about`               |
| Entry component     | `kebab-case-section.tsx`    | `projects-section.tsx`            |
| Hook file           | `use-kebab-case.ts`         | `use-project-scroll-stack.ts`     |
| Sub-component        | `kebab-case.tsx`            | `project-card.tsx`                |

## 5. Import Pattern

The home page composes sections directly, in scroll order. A section entry component imports its own domain's sub-components/hooks from `src/components/<domain>/` and `src/hooks/<domain>/`:

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

```tsx
// src/sections/projects/projects-section.tsx
import { ProjectCard } from "@/components/projects"
import { useProjectScrollStack } from "@/hooks/projects"
```

- No cross-section imports (one section reaching into another section's internals, or into another domain's `src/components/<domain>/`/`src/hooks/<domain>/`).
- No mandatory barrel `index.ts` per section, but each domain folder under `src/components/`, `src/hooks/`, and `src/types/` has its own barrel `index.ts` per CLAUDE.md's project-structure convention.
- All exports are named exports.

## 6. Section Hook Pattern

Section-domain hooks (in `src/hooks/<domain>/`) encapsulate scroll/animation orchestration for that section and MUST return a plain object.

```ts
// src/hooks/projects/use-project-scroll-stack.ts
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
- [ ] Section directory is `kebab-case` under `src/sections/`, holding only the entry component
- [ ] Section-supporting components/hooks/types placed in the matching `src/components/<domain>/`, `src/hooks/<domain>/`, `src/types/<domain>/` folders — never inside `src/sections/<name>/`
- [ ] Started flat (no domain folders) until the section actually needs sub-components or hooks
- [ ] Nothing imported across sections or across domains
- [ ] Named exports only
