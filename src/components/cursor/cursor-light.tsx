import { useState } from "react"
import { cn } from "@/lib/utils"
import { canHover } from "@/lib/media"

type CursorLightProps = {
  /** Distance in px from the cursor at which the darkness reaches full strength. */
  radius?: number
  /** Opacity of the darkness outside the lit area (0–1). */
  darkness?: number
  /** Extra classes, e.g. to change the z-index for a section's layer order. */
  className?: string
}

/**
 * The cursor-as-light-source mask, shared by every section that wants it.
 *
 * Darkens its parent, leaving a soft lit circle where the cursor is. The
 * position comes from the --cursor-x / --cursor-y variables that CustomCursor
 * sets on :root each lerp frame, so no React state or listeners are needed
 * here.
 *
 * ── Scoped to the parent, lit in viewport coordinates ────────────────────────
 * The element is `absolute inset-0`, so the parent section (which must be
 * `relative`) clips it and the darkness never leaks onto other sections.
 * --cursor-x/y are viewport coordinates, so the gradient uses
 * `background-attachment: fixed`: the background is laid out against the
 * viewport while only showing inside this element.
 *
 * Caveat: browsers treat a fixed background as `scroll` when this element or
 * an ancestor has a CSS transform. Mount it on an untransformed section root,
 * not inside a translated or 3D layer.
 *
 * ── Accessibility ────────────────────────────────────────────────────────────
 * Decorative only: aria-hidden and pointer-events-none. It isn't rendered
 * on devices that can't hover (touch), where there is no cursor to cast light,
 * so content shows at full brightness there. With reduced motion, the light
 * still follows the cursor, but without trailing (useCursorPosition snaps).
 */
export function CursorLight({
  radius = 900,
  darkness = 0.85,
  className,
}: CursorLightProps) {
  // Primary input type doesn't change mid-session in practice; read once.
  const [enabled] = useState(canHover)

  if (!enabled) return null

  return (
    <div
      aria-hidden="true"
      data-testid="cursor-light"
      className={cn("pointer-events-none absolute inset-0 z-[11]", className)}
      style={{
        // Runtime gradient driven by CSS vars and props — no Tailwind utility exists
        backgroundImage: `radial-gradient(circle at var(--cursor-x, 50%) var(--cursor-y, 50%), transparent 0px, rgba(0,0,0,${darkness}) ${radius}px)`,
        backgroundAttachment: "fixed",
      }}
    />
  )
}
