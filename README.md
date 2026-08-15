# Abdur Portfolio

A personal portfolio website built to immediately capture visitor attention and deliver a polished, memorable experience. Design-forward and animation-heavy by intent — smooth scroll, scroll-driven motion, light-touch 3D, and a custom cursor that acts as a literal light source revealing content as you explore the page.

> **Status:** Planning complete, stack decided, implementation in early stages (project scaffolding + font/style setup + smooth scroll setup underway). See [CLAUDE.md](./CLAUDE.md) for the full project brief and working agreement.

## Tech Stack

| Concern | Choice |
| --- | --- |
| Build tool | [Vite](https://vitejs.dev/) |
| Framework | [React 19](https://react.dev/) |
| Smooth scroll | [Lenis](https://lenis.darkroom.engineering/) |
| Scroll animation | [GSAP](https://gsap.com/) + ScrollTrigger |
| 3D accents | [React Three Fiber](https://r3f.docs.pmnd.rs/) + [Drei](https://github.com/pmndrs/drei) (used sparingly) |
| Custom cursor | Custom lerp-based lag/easing component, reacts to hover/focus/click |
| Routing | [React Router](https://reactrouter.com/) (central route config) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + [CVA](https://cva.style/) for variant primitives + `cn()` (`clsx` + `tailwind-merge`) |
| Testing | [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react) + [vitest-axe](https://github.com/chance/vitest-axe) |
| Accessibility target | WCAG 2.2 Level AA |
| Hosting target | Vercel / Netlify / Cloudflare Pages (static Vite build) |

Why not Next.js / TanStack Start? The site is almost entirely client-side and animation-driven (GSAP, R3F, custom cursor, canvas work), so SSR/SEO machinery adds friction without meaningful benefit for a portfolio with modest SEO needs. See [CLAUDE.md](./CLAUDE.md#why-this-stack-context-not-to-re-litigate) for the full rationale.

## Design Direction

- Smooth scrolling everywhere — not the default browser scroll.
- Scroll-driven animation: parallax, pinning, staggered reveals, horizontal/x-z axis movement, masked/clipped transitions, and more, explored freely rather than confined to a single pattern.
- **Cursor as light source (core concept):** the custom cursor doubles as a spotlight/glow that reveals nearby content; unexplored areas dim as the light moves away. This ties content visibility to proximity, not just to a decorative trail.
- Light-touch 3D accents (low poly count, low draw calls) — not full 3D scenes.
- A custom, engaging loading/intro screen.
- Built incrementally: plain scroll structure first, animation layered in one technique at a time, with performance checked at each step.

## Getting Started

This project uses **pnpm**. Do not use npm or yarn.

```bash
pnpm install     # install dependencies
pnpm dev         # start the Vite dev server
pnpm build       # type-check and build for production
pnpm preview     # preview the production build locally
pnpm test        # run the test suite once
pnpm test:watch  # run tests in watch mode
pnpm lint        # run ESLint
pnpm format      # format the codebase with Prettier
```

## Project Structure

```
src/
  components/
    cursor/     # custom cursor / cursor-light components
    layout/     # shared layout components
    scroll/     # smooth scroll (Lenis) provider and scroll-related components
    ui/         # multi-variant primitives (CVA + Tailwind)
  lib/          # shared utilities and hooks (e.g. cn(), use-page-title)
  pages/        # route-level page components
  routes/       # React Router route definitions
  sections/     # scrollable home-page blocks (Hero, About, Projects, etc.)
references/     # design reference screenshots and inspiration links
```

Architecture conventions for each area are defined in project skills under [.claude/skills/](./.claude/skills/):

- **component-design** — component file placement, props typing, exports, Tailwind/CVA styling, accessibility.
- **section-design** — boundaries for `src/sections/`, when to promote logic to shared components/lib.
- **route-design** — React Router config and route/page separation in `src/routes/` and `src/pages/`.
- **testing** — what must be tested, the Vitest + RTL + vitest-axe stack, and the run-before-integrate rule.
- **accessibility** — WCAG 2.2 AA requirements, with emphasis on accessible fallbacks for hover-dependent effects.

## Working Agreement

This project is built strictly one unit at a time (one function, hook, component, feature, or animation per step). Each unit is proposed, confirmed, implemented, tested, accessibility-checked, and explicitly signed off before the next one starts. See the [Working Agreement section of CLAUDE.md](./CLAUDE.md#working-agreement--important) for the full process.

## Reference Materials

Design references (screenshots and links to live sites) live in [references/](./references/), described in [references/inspiration.md](./references/inspiration.md).
