---
name: route-design
description: Use whenever creating, editing, or reviewing a route (React Router route definitions, the router config, or a route-level page component) in src/routes/ or src/pages/. Trigger on requests like "add a route", "create the project detail page", or any question about routing/navigation structure.
---

# Route Creation Contract — abdur-portfolio

## 1. Scope
Governs routing, built with **React Router** (chosen over TanStack Router since this project's routing needs are light — mostly one scrolling home page plus project detail routes). Governs `src/routes/` (thin route wrapper components + the router config) and `src/pages/` (the actual page content each route renders).

This project does NOT use file-based routing conventions (no dot-notation filenames, no `createFileRoute`) — routes are declared explicitly in a central router config, since the route count is small and explicit config is simpler to reason about at this scale.

## 2. File Structure

```
src/
├── router.tsx                          # Central route config (createBrowserRouter)
├── routes/                             # Thin route wrapper components
│   ├── home-route.tsx                  # /
│   ├── project-detail-route.tsx        # /projects/:projectId
│   └── not-found-route.tsx             # catch-all
└── pages/                              # Actual page content rendered by routes
    ├── home-page.tsx                   # Composes all scroll sections
    └── project-detail-page.tsx         # Individual project showcase
```

- File names MUST use `kebab-case`.
- Dynamic segments follow React Router's `:paramName` syntax in the router config (e.g. `/projects/:projectId`).

## 3. Central Router Config

```tsx
// src/router.tsx
import { createBrowserRouter } from "react-router"
import { HomeRoute } from "@/routes/home-route"
import { ProjectDetailRoute } from "@/routes/project-detail-route"
import { NotFoundRoute } from "@/routes/not-found-route"

export const router = createBrowserRouter([
  { path: "/", element: <HomeRoute /> },
  { path: "/projects/:projectId", element: <ProjectDetailRoute /> },
  { path: "*", element: <NotFoundRoute /> },
])
```

## 4. Standard Route Pattern

A route file is a thin wrapper: extract params (if any), set the page title, delegate to a page component. No business logic, no section markup, in a route file.

```tsx
// src/routes/project-detail-route.tsx
import { useParams } from "react-router"
import { ProjectDetailPage } from "@/pages/project-detail-page"
import { usePageTitle } from "@/lib/use-page-title"

export function ProjectDetailRoute() {
  const { projectId } = useParams()
  usePageTitle(`Project | ${projectId} | Abdur`)

  return <ProjectDetailPage projectId={projectId!} />
}
```

- Params MUST be extracted with `useParams()` inside the route file only — page components receive them as plain props, never read router hooks directly themselves (keeps pages testable/reusable outside routing).
- Named function components only — no `export default`.

## 5. Page Titles
Since React Router (unlike TanStack Router) has no built-in `head` config, use a small shared hook:

```ts
// src/lib/use-page-title.ts
import { useEffect } from "react"

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = title
  }, [title])
}
```

Every route MUST call `usePageTitle` with a `"Page | Section | Abdur"`-style title.

## 6. Forbidden Patterns
- No file-based/dot-notation route files — all routes declared in `router.tsx`.
- No `export default` for route or page components.
- No business logic, API/data-fetching, or section markup directly inside a route file — delegate to the page.
- Page components MUST NOT call `useParams`/`useSearchParams` themselves — receive values as props from the route.
- No section from `src/sections/` imported directly into a route file — routes render pages, pages compose sections.

## 7. Checklist
- [ ] Route declared in `router.tsx`, not as a separate file-based convention
- [ ] Route file is `kebab-case`, named export, no default export
- [ ] Route file extracts params and calls `usePageTitle`, then delegates to a page
- [ ] Page component receives params as props, doesn't read router hooks itself
- [ ] No business/section logic living inside the route file
