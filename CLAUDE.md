# Project: abdur-portfolio

## Overview
A personal portfolio website designed to immediately capture visitor attention and deliver a polished, memorable experience. Design-forward and animation-heavy by intent.

## Tech Stack (decided)
- **Build tool:** Vite
- **Framework:** React
- **Smooth scroll:** Lenis
- **Scroll-driven animation / card-stacking / x-z axis movement:** GSAP + ScrollTrigger
- **3D elements:** React Three Fiber + Drei — used sparingly (e.g. one hero object or subtle background), NOT full 3D scenes throughout
- **Custom cursor:** Custom component with lag/easing (lerp-based), reacts to hover/focus/click states
- **Routing:** React Router (`react-router`) — chosen over TanStack Router since routing needs are light (mostly one scrolling home page + project detail routes); explicit central route config, not file-based routing
- **Styling:** Tailwind CSS, with `class-variance-authority` (CVA) for multi-variant `ui/` primitives and a `cn()` utility (`clsx` + `tailwind-merge`) for conditional class composition
- **Testing:** Vitest + React Testing Library, with `vitest-axe` for automated accessibility checks (animation/scroll-timing code is manually verified instead — see `testing` skill)
- **Accessibility target:** WCAG 2.2 Level AA
- **Hosting target:** Vercel, Netlify, or Cloudflare Pages (static Vite build)

## Why this stack (context, not to re-litigate)
Next.js and TanStack Start were considered and explicitly ruled out. The site is almost entirely client-side/animation-driven (GSAP, R3F, custom cursor, canvas work), so SSR/SEO machinery from Next.js adds friction (hydration mismatches, "use client" boundaries) without meaningful benefit for a portfolio with modest SEO needs. Plain Vite + React keeps animation work unobstructed and dev iteration fast.

## Design Preferences (from reference sites / discussion)
- Smooth scrolling is a top priority — not default browser scroll.
- Scroll-driven animations: items appearing/disappearing on scroll.
- Non-default scroll axes in places — motion that moves in x or z axis, not just y. Card-stacking was given only as ONE example of this during planning — it is not the only scroll-driven animation wanted, and should not be treated as a fixed spec. Other scroll-driven animation types (parallax, pinning, staggered reveals, horizontal scroll sections, masked/clipped transitions, etc.) are all in scope and should be proposed and explored, not assumed off the table.
- Engaging, custom loading/intro screen — not a generic spinner.
- Light-touch 3D — accents, not heavy/distracting scenes. Keep poly count and draw calls low.
- Custom mouse cursor that trails behind the real cursor with a small lag, and visibly reacts to hover/focus/click states.
- **Cursor as light source (core concept):** The site should feel exploratory — the cursor acts as a literal light source (e.g. spotlight/glow) that illuminates or reveals content (sections, text, images) as the user moves over/near them. When the cursor moves away from an item, the light naturally follows the cursor rather than staying fixed — so unlit/unexplored areas recede or dim again. This is a bigger structural idea than a decorative cursor trail: content visibility/emphasis itself is tied to proximity to the light, so it likely affects how sections are designed (some content may be intentionally dim/hidden until "found") as well as how the custom cursor component is built (it's not just a follower, it's a light-casting element — think radial gradient/mask/glow that moves with lag, with soft falloff at the edges).
- Explicit risk flagged and accepted: this combination (smooth scroll + 3D + custom cursor + stacking) can easily tip into "laggy/disorienting" if overdone. Agreed approach: build structure first with plain scroll, then layer in animation techniques one at a time, testing performance at each step.

## Code Quality Skills
This project uses three project-level Claude Code skills (in `.claude/skills/`) that define binding conventions. They are loaded automatically when relevant — do not restate their content here, refer to them by name:

- **`component-design`** — rules for every `.tsx` component: file placement, props typing, named exports, Tailwind + `cn()` + CVA styling, accessibility (including the cursor-light accessibility floor).
- **`section-design`** — rules for `src/sections/` (the scrollable home-page blocks): section boundaries, when to promote shared logic to `src/components/`/`src/lib/`, naming.
- **`route-design`** — rules for `src/routes/` and `src/pages/`: React Router config, route/page separation, param handling, page titles.
- **`testing`** — what must be tested (components, hooks, functions, sections), the Vitest + React Testing Library + vitest-axe stack, and the rule that a unit's tests must pass before it's integrated elsewhere. Animation/scroll-timing code (GSAP, Lenis, R3F, cursor-light) is manually verified in-browser instead of unit-tested.
- **`accessibility`** — WCAG 2.2 Level AA requirements across keyboard, touch/mobile, and screen reader access. Special emphasis on this project's hover-dependent effects (cursor-light, custom cursor) needing fully accessible non-hover equivalents.

These three skills are the authoritative source for architecture conventions. If a proposed implementation would conflict with one of them, flag the conflict before proceeding rather than silently deviating.

## Reference Materials
Store reference screenshots/inspiration in a `references/` folder at the repo root. Name files descriptively (e.g. `hero-scroll-example.png`, `card-stack-ref.png`). Reference them by path when discussing design direction.

Reference **URLs/links to live websites** are also valid and encouraged, not just saved screenshots. When a link is given, treat it the same way as a reference screenshot: analyze its layout, motion, and design language to infer what feel/direction is wanted, rather than assuming a screenshot is required. Where useful, note the specific link alongside the design takeaway (e.g. "cursor glow: see [url]") so the source is traceable later.

## Working Agreement — IMPORTANT
The user wants every implementation step confirmed before it happens. This applies to everything, no exceptions:
- Every new function
- Every hook
- Every component
- Every feature
- Every animation
- Any architectural or structural decision

**Do not implement anything without first proposing it and getting explicit confirmation.** Explain reasoning briefly when proposing something, then wait for a go-ahead. Treat this as a standing project rule, not a one-time instruction.

### One thing at a time — layer by layer
Work must proceed strictly one unit at a time — one function, one hook, one component, one feature, one animation — never multiple at once, even if they seem related or trivial. For each unit:

1. **Propose** the specific thing about to be built, with brief reasoning.
2. **Wait for confirmation** before writing any code for it.
3. **Implement** only that one unit once confirmed.
4. **Test it** — per the `testing` skill: write and run the co-located test (component/hook/function/section), and confirm it passes. Purely animation/scroll-timing pieces (GSAP, Lenis, R3F, cursor-light) skip automated testing and instead get manually verified in-browser at this step.
5. **Verify accessibility** — per the `accessibility` skill: automated `vitest-axe` check (part of the test file) plus a manual keyboard-only pass and a `prefers-reduced-motion` check for anything involving motion.
6. **Present it for verification** — the user needs to be able to actually check/see/test the result (e.g. run it, view it in browser, review the code) before moving on.
7. **Get explicit sign-off** ("looks good", "approved", etc.) before starting the next unit.

A unit is not considered "implemented" until its test passes and its accessibility has been checked — these are not optional follow-ups, they're part of what "done" means for every unit in step 3-4.

If the user is not satisfied at the verification step:
- Take their feedback specifically.
- Regenerate/adjust ONLY that unit based on the feedback.
- Re-present for verification again.
- Repeat this feedback → regenerate → re-verify loop as many times as needed until the user approves.
- Do not move on to the next unit, and do not bundle the fix in with other unrelated changes, while a unit is still in this feedback loop.

This applies to every layer of the build — structural scaffolding, individual components, each scroll animation, the loading screen, the cursor, 3D elements, styling passes, everything. No batching multiple unconfirmed pieces together to "save time."

## Status
Planning complete. Stack decided. Implementation has not yet started. Next step is scaffolding the initial Vite + React project structure — to be proposed and confirmed before creating any files.