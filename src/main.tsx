import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { router } from "./router"
import { LenisProvider } from "@/context/scroll"
import { LoadingScreen } from "@/components/loading-screen"
import { CustomCursor } from "@/components/cursor"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LenisProvider>
      <RouterProvider router={router} />
      {/* LoadingScreen sits after RouterProvider in the DOM but above it
          visually via fixed positioning + z-50. Placing it last keeps the
          page content as the primary DOM tree for screen readers. */}
      <LoadingScreen />
      {/* CustomCursor is the last fixed overlay — z-[9999] keeps it above
          everything. aria-hidden keeps it invisible to the a11y tree. */}
      <CustomCursor />
    </LenisProvider>
  </StrictMode>
)
