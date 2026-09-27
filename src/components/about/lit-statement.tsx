import { cn } from "@/lib/utils"
import type { StatementSegment } from "@/types/about"

type LitStatementProps = {
  segments: StatementSegment[]
  className?: string
}

// The cursor light glows around whichever word it's on. The glow is on the
// word and simply inherited by its characters, so they never recompute it.
const WORD = cn(
  "[text-shadow:0_0_calc(var(--light,0)*22px)_rgba(153,0,250,0.5)]",
  "transition-[text-shadow] duration-200 ease-out"
)

// Keywords: soft purple, glowing brighter in the brand purple when lit.
const ACCENT = cn(
  "font-normal text-accent-soft font-stretch-semi-expanded",
  "[text-shadow:0_0_calc(var(--light,0)*28px)_var(--color-accent)]"
)

/**
 * The About statement, set large and revealed one character at a time as the
 * visitor scrolls: the About section drives the sweep with
 * `applyStatementReveal` (`lib/statement-reveal`), which colours the
 * `[data-char]` spans directly. Left alone (the flat fallback), every
 * character shows in its real colour.
 *
 * Every word is a `[data-light]` span so the cursor light can find it. The
 * character spans stay inline (never inline-block) and whitespace stays as
 * plain text between words, so screen readers and copy/paste get the
 * sentence exactly as written.
 */
export function LitStatement({ segments, className }: LitStatementProps) {
  return (
    <p
      // The About section finds the statement by this to drive the reveal
      data-statement
      className={cn(
        "font-display text-[clamp(1.6rem,7.4vw,2.6rem)] font-light leading-[1.1] text-text lg:text-[clamp(2.25rem,5vw,4.75rem)] lg:leading-[1.08]",
        className
      )}
    >
      {segments.flatMap((segment, si) =>
        segment.text.split(/(\s+)/).map((part, pi) => {
          if (part === "") return null
          if (/^\s+$/.test(part)) return part
          return (
            <span
              key={`${si}-${pi}`}
              data-light
              className={cn(WORD, segment.accent && ACCENT)}
            >
              {Array.from(part, (char, ci) => (
                <span key={ci} data-char>
                  {char}
                </span>
              ))}
            </span>
          )
        })
      )}
    </p>
  )
}
