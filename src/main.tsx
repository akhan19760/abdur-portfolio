import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "react-router"
import { router } from "./router"
import { LenisProvider } from "./components/scroll/lenis-provider"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LenisProvider>
      <RouterProvider router={router} />
    </LenisProvider>
  </StrictMode>
)
