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
 * True when a section should run its full scroll-driven 3D version: on every
 * device (phones and tablets too, with their own compact layouts) unless the
 * visitor has asked for reduced motion, who gets the section's flat version.
 */
export function prefersImmersive(): boolean {
  return !prefersReducedMotion()
}

/**
 * True below 1024px: phones and tablets, where the immersive sections switch
 * to their compact (portrait-friendly) layouts. CSS uses the matching
 * `max-lg:` / `lg:` variants; this is for layout decisions made in scripts,
 * such as how a 3D scene frames itself.
 */
export function isCompact(): boolean {
  return !matchesMedia("(min-width: 1024px)", true)
}

/**
 * True when the page should loop back round from Contact to the Hero. It
 * wraps the scroll through Lenis's smooth wheel scrolling, which touch
 * scrolling (native, with momentum) can't take part in, so it's mouse and
 * trackpad only; everywhere else the page ends at Contact.
 */
export function prefersPageLoop(): boolean {
  return prefersImmersive() && canHover()
}
