import { useEffect, useLayoutEffect, useRef } from "react"
import { prefersReducedMotion } from "@/lib/media"

/** ASCII only, so every glyph is exactly one monospace cell wide. */
export const SCRAMBLE_GLYPHS = "!<>-_\\/[]{}=+*^?#%&$@0123456789ABCDEFXZ"

/** ms a line takes to decode, left to right, once it's decrypted. */
export const RESOLVE_MS = 650

/** Replaces every non-whitespace character with a random glyph; keeps spacing. */
export function scrambleText(text: string, random: () => number = Math.random): string {
  let out = ""
  for (const ch of text) {
    out += /\s/.test(ch)
      ? ch
      : SCRAMBLE_GLYPHS[Math.floor(random() * SCRAMBLE_GLYPHS.length)]
  }
  return out
}

/**
 * Text partway through decoding: the first `progress` (0–1) of the characters
 * are real, the rest still scrambled.
 */
export function resolveText(
  text: string,
  progress: number,
  random: () => number = Math.random
): string {
  const n = Math.max(0, Math.min(text.length, Math.floor(progress * text.length)))
  return text.slice(0, n) + scrambleText(text.slice(n), random)
}

type ScrambleOptions = {
  /** Keep cycling the glyphs (false once everything is decrypted). */
  active?: boolean
  /** ms between re-scrambles. */
  interval?: number
}

/**
 * Fills every `[data-scramble="original text"]` element inside the container
 * with scrambled glyphs of the same length, and keeps re-scrambling them
 * while `active` and on screen, like a signal that hasn't been decoded.
 *
 * The elements must be rendered empty by React; this hook owns their text.
 * Because only non-whitespace characters change, a monospace font keeps the
 * scrambled text wrapping exactly like the original.
 *
 * An element inside `[data-resolve-at="<performance.now() timestamp>"]`
 * decodes instead: its real characters lock in left to right over RESOLVE_MS.
 *
 * Reduced motion: scrambled once, never cycles.
 */
export function useScramble<T extends HTMLElement = HTMLElement>({
  active = true,
  interval = 70,
}: ScrambleOptions = {}) {
  const containerRef = useRef<T>(null)

  // Fill before paint after every render, so new or changed text is never blank.
  useLayoutEffect(() => {
    fillScrambles(containerRef.current)
  })

  useEffect(() => {
    const container = containerRef.current
    if (!container || !active || prefersReducedMotion()) return

    let timer = 0
    const start = () => {
      if (!timer) timer = window.setInterval(() => fillScrambles(container), interval)
    }
    const stop = () => {
      window.clearInterval(timer)
      timer = 0
    }

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()))

    if (observer) observer.observe(container)
    else start()

    return () => {
      observer?.disconnect()
      stop()
    }
  }, [active, interval])

  return { containerRef }
}

function fillScrambles(container: HTMLElement | null) {
  if (!container) return
  const now = performance.now()
  for (const el of container.querySelectorAll<HTMLElement>("[data-scramble]")) {
    const text = el.dataset.scramble ?? ""
    const at = el.closest<HTMLElement>("[data-resolve-at]")?.dataset.resolveAt
    el.textContent =
      at === undefined
        ? scrambleText(text)
        : resolveText(text, (now - Number(at)) / RESOLVE_MS)
  }
}
