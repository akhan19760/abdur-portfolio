// i18n must be initialised before any component imports so that useTranslation()
// resolves synchronously on first render.
import "@/lib/i18n"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { router } from "./router"
import { LenisProvider } from "@/context/scroll"
import { LoadingScreen } from "@/components/loading-screen"
import { CustomCursor, TouchLight } from "@/components/cursor"
import { ErrorBoundary } from "@/components/layout"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <LenisProvider>
        <RouterProvider router={router} />
        {/* LoadingScreen sits after RouterProvider in the DOM but above it
            visually via fixed positioning + z-50. Placing it last keeps the
            page content as the primary DOM tree for screen readers. */}
        <LoadingScreen />
        {/* CustomCursor is the last fixed overlay — z-[9999] keeps it above
            everything. aria-hidden keeps it invisible to the a11y tree. */}
        <CustomCursor />
        {/* On touch screens the finger is the light instead (renders nothing) */}
        <TouchLight />
      </LenisProvider>
    </ErrorBoundary>
  </StrictMode>
)
