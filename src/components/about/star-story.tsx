import { useLayoutEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import type { OriginBeat } from "@/types/about"
import { starId } from "./about-shared"

type StarStoryLabels = {
  /** Shown in large type before any star has been touched. */
  prompt: string
  traced: string
  complete: string
  /** Accessible name for a star button, e.g. "Star 3 of 8: REACT". */
  star: (n: number, total: number, mark: string) => string
}

type StarStoryProps = {
  beats: OriginBeat[]
  isTraced: (id: string) => boolean
  /** Trace a star and show its beat — called on click and keyboard focus. */
  onTrace: (id: string) => void
  /** Index of the beat shown in large type, or null for the prompt. */
  active: number | null
  labels: StarStoryLabels
  /** Depth mode: a full-viewport sky. Otherwise a compact sky and a visible list. */
  depth: boolean
  className?: string
}

/**
 * Where each star sits in the sky (the `</>` glyph, in story order), how deep
 * it floats (--z, for parallax as the sky tilts), which side its tag reads on,
 * and a twinkle offset so they don't breathe in unison.
 */
const STARS = [
  {
    pos: "left-[30%] top-[8%] [--z:70px]",
    tag: "left",
    delay: "[animation-delay:-0.3s]",
  },
  {
    pos: "left-[6%] top-[50%] [--z:-50px]",
    tag: "left",
    delay: "[animation-delay:-1.9s]",
  },
  {
    pos: "left-[30%] top-[92%] [--z:110px]",
    tag: "left",
    delay: "[animation-delay:-1.1s]",
  },
  {
    pos: "left-[42%] top-[98%] [--z:-30px]",
    tag: "left",
    delay: "[animation-delay:-2.6s]",
  },
  {
    pos: "left-[58%] top-[2%] [--z:40px]",
    tag: "right",
    delay: "[animation-delay:-0.8s]",
  },
  {
    pos: "left-[70%] top-[8%] [--z:-60px]",
    tag: "right",
    delay: "[animation-delay:-2.2s]",
  },
  {
    pos: "left-[94%] top-[50%] [--z:90px]",
    tag: "right",
    delay: "[animation-delay:-1.5s]",
  },
  {
    pos: "left-[70%] top-[92%] [--z:-20px]",
    tag: "right",
    delay: "[animation-delay:-0.1s]",
  },
] as const

const pad = (n: number) => String(n).padStart(2, "0")

// A four-point sparkle, like a star through a lens
const SPARKLE = "M0 -10 L1.7 -1.7 L10 0 L1.7 1.7 L0 10 L-1.7 1.7 L-10 0 L-1.7 -1.7 Z"

/**
 * The Origin layer: the story is written in the sky.
 *
 * Eight stars hang across the whole viewport at different depths, shaping a
 * `</>`; the sky tilts toward the cursor, so they drift against each other.
 * Every star holds one beat of the story. When the light reaches one (the
 * section calls `onTrace` via `data-star-id`), it flares, its tag appears,
 * the FX canvas draws the stroke to its traced neighbours, and its words fly
 * out of the star into the large text below. Bringing the light back to a
 * traced star replays its line. Trace all eight and the whole glyph ignites.
 *
 * Accessibility: stars are buttons (focus or click traces them). The whole
 * story is always in an ordered list — visually hidden in depth mode, shown in
 * the flat fallback — so the large animated text is aria-hidden.
 */
export function StarStory({
  beats,
  isTraced,
  onTrace,
  active,
  labels,
  depth,
  className,
}: StarStoryProps) {
  const skyRef = useRef<HTMLDivElement>(null)
  const textRef = useRef<HTMLParagraphElement>(null)

  const stars = STARS.slice(0, beats.length)
  const tracedCount = stars.filter((_, i) => isTraced(starId(i))).length
  const complete = stars.length > 0 && tracedCount === stars.length
  const beat = active === null ? null : beats[active]
  const words = (beat ? beat.text : labels.prompt).split(" ")

  // Before paint: start every word at the star it's flying out of.
  useLayoutEffect(() => {
    if (active === null || !depth) return
    const star = skyRef.current?.querySelector<HTMLElement>(
      `[data-star-id="${starId(active)}"]`
    )
    const text = textRef.current
    if (!star || !text) return
    const s = star.getBoundingClientRect()
    const sx = s.left + s.width / 2
    const sy = s.top + s.height / 2
    for (const word of text.querySelectorAll<HTMLElement>("[data-word]")) {
      const r = word.getBoundingClientRect()
      word.style.setProperty("--fx", `${(sx - (r.left + r.width / 2)).toFixed(1)}px`)
      word.style.setProperty("--fy", `${(sy - (r.top + r.height / 2)).toFixed(1)}px`)
    }
  }, [active, depth])

  return (
    <div className={cn(depth ? "absolute inset-0" : "relative", className)}>
      <p
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.3em]",
          depth ? "absolute inset-x-0 top-8 text-center" : "mb-8",
          complete ? "text-accent-soft" : "text-text/60"
        )}
      >
        {complete
          ? labels.complete
          : `${labels.traced} ${pad(tracedCount)}/${pad(stars.length)}`}
      </p>

      {/* The story as text: always complete for screen readers */}
      <ol
        className={cn(
          depth ? "sr-only" : "mb-12 space-y-3 font-sans text-base leading-snug text-text"
        )}
      >
        {beats.map((b, i) => (
          <li key={i} className={cn(!depth && "flex gap-4")}>
            {!depth && (
              <span
                aria-hidden="true"
                className="mt-0.5 shrink-0 font-mono text-[10px] text-accent-soft"
              >
                {pad(i + 1)}
              </span>
            )}
            <span>{b.text}</span>
          </li>
        ))}
      </ol>

      {/* ── The sky ──────────────────────────────────────────────────────── */}
      <div
        ref={skyRef}
        data-tilt
        className={cn(
          "[transform-style:preserve-3d]",
          depth
            ? "absolute inset-x-[9%] top-[16%] h-[48%] [transform:perspective(1300px)_rotateX(calc(var(--tilt-y,0)*-10deg))_rotateY(calc(var(--tilt-x,0)*14deg))] max-lg:inset-x-[13%] max-lg:top-[14%] max-lg:h-[46%]"
            : "relative mx-auto aspect-[4/3] w-[86%] max-w-3xl sm:aspect-[16/9] sm:w-full"
        )}
      >
        {stars.map((star, i) => {
          const id = starId(i)
          const on = isTraced(id)
          return (
            <button
              key={id}
              type="button"
              data-light
              data-star-id={id}
              data-traced={on ? "" : undefined}
              aria-label={labels.star(i + 1, stars.length, beats[i].mark)}
              onClick={() => onTrace(id)}
              onFocus={() => onTrace(id)}
              className={cn(
                "absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full",
                "[transform:translateZ(var(--z,0px))]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                star.pos
              )}
            >
              {/* Halo swelling as the light nears */}
              <span
                aria-hidden="true"
                className="absolute -inset-5 rounded-full bg-accent/45 opacity-[var(--light,0)] blur-xl scale-[calc(0.4_+_var(--light,0)_*_0.8)]"
              />
              {/* One-off flare the moment it's traced */}
              {on && (
                <span
                  aria-hidden="true"
                  className="absolute inset-0 animate-star-flare rounded-full border-2 border-accent-soft"
                />
              )}
              {/* Slowly turning cross-flare once traced */}
              {on && (
                <span
                  aria-hidden="true"
                  className="absolute h-20 w-20 animate-orbit-spin [animation-duration:14s]"
                >
                  <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-accent-soft/70 to-transparent" />
                  <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-gradient-to-r from-transparent via-accent-soft/70 to-transparent" />
                </span>
              )}
              <svg
                aria-hidden="true"
                viewBox="-10 -10 20 20"
                className={cn(
                  "relative transition-[width,height,color,filter] duration-700",
                  "[translate:calc(var(--light-dx,0)*6px)_calc(var(--light-dy,0)*6px)]",
                  on
                    ? "h-10 w-10 text-white [filter:drop-shadow(0_0_6px_var(--color-accent))_drop-shadow(0_0_18px_var(--color-accent))]"
                    : cn("h-5 w-5 animate-twinkle text-accent-soft", star.delay)
                )}
              >
                <path d={SPARKLE} fill="currentColor" />
              </svg>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[10px] leading-tight tracking-[0.25em] transition-opacity duration-500",
                  // No room beside the edge stars on a phone; the list above
                  // numbers every beat anyway
                  !depth && "max-sm:hidden",
                  // Compact sky: only the star being told has its tag, so
                  // neighbouring tags never run into each other
                  depth && active !== i && "max-lg:hidden",
                  star.tag === "left"
                    ? "right-full mr-2 text-right"
                    : "left-full ml-2 text-left",
                  on ? "opacity-100" : "opacity-[var(--light,0)]"
                )}
              >
                <span className="block text-text/50">{pad(i + 1)}</span>
                <span className={on ? "text-accent-soft" : "text-text/80"}>
                  {beats[i].mark}
                </span>
              </span>
            </button>
          )
        })}
      </div>

      {/* ── The line being spoken, flown out of its star ─────────────────── */}
      <div
        className={cn(
          "text-center",
          depth
            ? "absolute inset-x-[12%] bottom-[7%] max-lg:inset-x-0 max-lg:top-[64%] max-lg:bottom-auto"
            : "mt-10"
        )}
      >
        <p
          ref={textRef}
          key={active ?? "prompt"}
          aria-hidden="true"
          className={cn(
            "mx-auto max-w-4xl leading-[1.12]",
            // A story line is the layer's main text; the prompt is a cue
            beat
              ? "font-display font-light text-[clamp(1.3rem,5.6vw,1.6rem)] text-text lg:text-[clamp(1.6rem,3vw,2.9rem)]"
              : "font-support text-[clamp(1.05rem,4.4vw,1.2rem)] text-text/70 lg:text-[clamp(1.2rem,2vw,1.8rem)]"
          )}
        >
          {words.map((word, i) => (
            <span key={i}>
              {i > 0 && " "}
              <span
                data-word
                data-light
                className={cn(
                  "inline-block",
                  beat && depth ? "animate-word-from-star" : "animate-word-in",
                  "opacity-[calc(0.65_+_var(--light,0)_*_0.35)]",
                  "[text-shadow:0_0_calc(var(--light,0)*22px)_var(--color-accent)]"
                )}
                // Per-word stagger — a runtime index, not expressible as a class
                style={{ animationDelay: `${i * 38}ms` }}
              >
                {word}
              </span>
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
