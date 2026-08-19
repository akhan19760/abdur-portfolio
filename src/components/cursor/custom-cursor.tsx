import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { useCursorPosition, useCursorState } from "@/hooks/cursor"

type CustomCursorProps = {
  /** Lerp easing factor forwarded to useCursorPosition (0–1, default 0.1). */
  lerpFactor?: number
}

/**
 * Renders the custom cursor system and publishes the lerp position as CSS
 * custom properties for section-level overlays to consume.
 *
 * ── Blend mode stacking context fix ──────────────────────────────────────────
 * `mix-blend-mode: difference` on a CHILD of a fixed+transform element blends
 * against the parent's isolated stacking context — not the page content.
 * To blend against actual page content, each cursor element must itself be
 * a `position: fixed` element at the root stacking context level, positioned
 * via `left` / `top` directly rather than living inside a translated wrapper.
 *
 * ── Dot ──────────────────────────────────────────────────────────────────────
 * A small purple (#9900fa) square with `mix-blend-mode: difference`.
 *   purple over dark  → appears purple
 *   purple over white → appears as the complement (rgb(102, 255, 5))
 * Because the element is directly fixed, the blend is against real page content.
 *
 * ── Coordinate readout ───────────────────────────────────────────────────────
 * Tracks raw (un-lerped) mouse position; displayed bottom-right of the dot.
 * Same mix-blend-difference treatment for legibility on any background.
 *
 * ── CSS custom properties ────────────────────────────────────────────────────
 * Sets --cursor-x and --cursor-y on :root every lerp frame so section overlays
 * (e.g. Hero's dark mask) can consume cursor position without React coupling.
 * Cleaned up on unmount.
 *
 * NOTE FOR SECTION AUTHORS: Any element that must always sit above the Hero
 * overlay (e.g. a nav bar) should use z-index > 9998. The cursor dot is at
 * z-[9999] and is always on top.
 *
 * aria-hidden="true" on all elements — visual enhancement only, never the sole
 * way to perceive or interact with content.
 */
export function CustomCursor({ lerpFactor = 0.3 }: CustomCursorProps) {
  const { lerp, raw } = useCursorPosition(lerpFactor)
  const { isHovering, isPressed, isVisible } = useCursorState()

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches

  // Hide the native cursor while mounted; restore on unmount.
  useEffect(() => {
    const prev = document.body.style.cursor
    document.body.style.cursor = "none"
    return () => {
      document.body.style.cursor = prev
    }
  }, [])

  // Publish lerp position as CSS vars every frame for the Hero overlay (and any
  // other section wanting cursor-proximity effects without React coupling).
  useEffect(() => {
    document.documentElement.style.setProperty("--cursor-x", `${lerp.x}px`)
    document.documentElement.style.setProperty("--cursor-y", `${lerp.y}px`)
    return () => {
      document.documentElement.style.removeProperty("--cursor-x")
      document.documentElement.style.removeProperty("--cursor-y")
    }
  }, [lerp.x, lerp.y])

  return (
    <>
      {/* ── Cursor dot ────────────────────────────────────────────────────────
          Directly fixed so mix-blend-difference blends against real page
          content, not an isolated parent stacking context.
          left/top drive position; smoothness comes from the lerp hook. */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 mix-blend-difference",
          !prefersReducedMotion && "transition-[width,height,opacity] duration-150 ease-out",
          isVisible ? "opacity-100" : "opacity-0",
          isPressed
            ? "h-2 w-2 bg-[#9900fa]"
            : isHovering
              ? "h-6 w-6 border-2 border-[#9900fa] bg-transparent"
              : "h-3 w-3 bg-[#9900fa]",
        )}
        style={{
          // Lerp position — runtime values, cannot be Tailwind classes
          left: `${lerp.x}px`,
          top: `${lerp.y}px`,
        }}
      />

      {/* ── Coordinate readout ────────────────────────────────────────────────
          Tracks raw (un-lerped) mouse position so it reflects actual cursor
          location. Directly fixed for the same stacking context reason. */}
      <div
        aria-hidden="true"
        data-testid="cursor-coords"
        className={cn(
          "pointer-events-none fixed z-[9999] font-mono text-[9px] leading-none tracking-tight whitespace-nowrap text-[#9900fa] mix-blend-difference",
          isVisible ? "opacity-100" : "opacity-0",
        )}
        style={{
          // Offset bottom-right from lerp position — runtime values
          left: `${lerp.x + 12}px`,
          top: `${lerp.y + 8}px`,
        }}
      >
        [{Math.round(raw.x)}, {Math.round(raw.y)}]
      </div>
    </>
  )
}
