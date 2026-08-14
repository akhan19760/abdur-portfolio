---
name: testing
description: Use whenever creating or editing any testable unit in this project — a component, hook, utility function, or section — and whenever about to integrate/use that unit elsewhere. Covers what must be tested, how, and the run-before-integrate rule. Trigger on requests like "add a test", "test this component/hook/function", or before wiring a newly built piece into the page.
---

# Testing Contract — abdur-portfolio

## 1. Scope
Every testable chunk in this codebase MUST have an associated test, and that test MUST be run and passing before the chunk is integrated/used elsewhere in the app. "Testable" means: utility functions, hooks, and components with logic, props, or accessibility surface. Purely visual/animation-timing code (GSAP timelines, ScrollTrigger configs, Lenis setup, R3F scenes, the cursor-light effect) is exempt from automated testing — see Section 5.

## 2. Stack
- **Test runner:** Vitest (Vite-native, shares config with the app)
- **Component/hook testing:** `@testing-library/react` (RTL) — including its built-in `renderHook`
- **Accessibility testing:** `vitest-axe` (axe-core) run against rendered output

## 3. File Convention
Tests are co-located next to the file they test, using `.test.ts`/`.test.tsx`:

```
src/lib/utils.ts
src/lib/utils.test.ts

src/components/ui/button.tsx
src/components/ui/button.test.tsx

src/sections/projects/hooks/use-project-scroll-stack.ts
src/sections/projects/hooks/use-project-scroll-stack.test.ts
```

No separate `__tests__/` directories — co-location keeps a test next to the thing it verifies.

## 4. What Every Type of Unit Must Test

### Utility functions
- Correct output for typical input.
- Edge cases (empty input, boundary values, invalid input if the function is expected to handle it).

```ts
// src/lib/utils.test.ts
import { describe, it, expect } from "vitest"
import { cn } from "./utils"

describe("cn", () => {
  it("merges conditional classes", () => {
    expect(cn("a", false && "b", "c")).toBe("a c")
  })
})
```

### Hooks
- Initial state is correct.
- State updates correctly in response to the actions the hook exposes.
- Cleanup/unmount doesn't throw (important for scroll/animation-adjacent hooks that set up refs or listeners).

```ts
import { renderHook, act } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { useProjectScrollStack } from "./use-project-scroll-stack"

describe("useProjectScrollStack", () => {
  it("returns a container ref", () => {
    const { result } = renderHook(() => useProjectScrollStack())
    expect(result.current.containerRef).toBeDefined()
  })
})
```

### Components
- Renders without crashing given required props.
- Reflects prop changes in output (e.g. a variant prop changes the rendered class/content).
- User interactions (click, keyboard) trigger the expected behavior — test via RTL's `userEvent`, not implementation details.
- **Accessibility check via `vitest-axe`** — every component test file MUST include one axe assertion against the rendered component (see Section 6). This is not optional per the accessibility skill's WCAG 2.2 AA requirement.

```tsx
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect } from "vitest"
import { axe } from "vitest-axe"
import { Button } from "./button"

describe("Button", () => {
  it("calls onClick when clicked", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Send</Button>)
    await user.click(screen.getByRole("button", { name: "Send" }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it("has no accessibility violations", async () => {
    const { container } = render(<Button>Send</Button>)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### Sections
- The section renders its expected content structure given typical data/props.
- Any interactive sub-elements (e.g. a project card link) behave correctly.
- Axe check against the full section, same as components — a section can pass on individual components yet still fail at the composed level (e.g. heading order across sub-components).
- Scroll-triggered animation logic itself is NOT asserted in the test (see Section 5) — only the underlying state/DOM structure the animation will act on.

## 5. What Is NOT Unit Tested (manual verification instead)
GSAP ScrollTrigger timelines, Lenis scroll setup, R3F/Three.js scenes, and the cursor-light effect are exempt from automated tests — testing that a mocked `gsap.timeline()` was called proves nothing about actual visual behavior. These are verified **manually, in-browser**, as part of the confirm/verify step in the standing workflow (see `CLAUDE.md`) before being considered done: check the effect actually looks and feels right, across at least desktop and one mobile viewport.

## 6. Run-Before-Integrate Rule
Before any component, hook, or function is wired into a section or the page, its test suite MUST be run and passing:

```
npm run test -- <path-to-file>
```

A unit is not "done" until its test exists and passes. This gates every step of the one-thing-at-a-time workflow — proposing → confirming → implementing → **testing** → presenting for verification (see `CLAUDE.md`).

## 7. Checklist
- [ ] Test file co-located, `.test.ts`/`.test.tsx`, same base name as the source file
- [ ] Utility: typical + edge cases covered
- [ ] Hook: initial state, state transitions, safe unmount
- [ ] Component/Section: renders correctly, interactions covered, `vitest-axe` check included
- [ ] Test run and passing BEFORE the unit is integrated elsewhere
- [ ] Animation/scroll-timing code manually verified in-browser instead, and noted as such
