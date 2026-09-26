/**
 * Media-query helpers shared by the cursor-light system and scroll sections.
 *
 * Each helper reads the query once at call time; callers that care about
 * changes mid-session should subscribe themselves. Where matchMedia is
 * missing (jsdom, very old browsers), `fallback` is returned instead.
 */

export function matchesMedia(query: string, fallback: boolean): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return fallback
  }
  return window.matchMedia(query).matches
}

/** True when the primary input can hover precisely (mouse or trackpad). */
export function canHover(): boolean {
  return matchesMedia("(hover: hover) and (pointer: fine)", true)
}

/** True when the user has asked the OS/browser to reduce motion. */
export function prefersReducedMotion(): boolean {
  return matchesMedia("(prefers-reduced-motion: reduce)", false)
}

/**
 * True when a section should run its full scroll-driven 3D version: a
 * hover-capable pointer, no reduced-motion preference, and a screen at least
 * 1024px wide. Everything else gets the section's flat version.
 */
export function prefersImmersive(): boolean {
  return (
    canHover() && !prefersReducedMotion() && matchesMedia("(min-width: 1024px)", true)
  )
}
