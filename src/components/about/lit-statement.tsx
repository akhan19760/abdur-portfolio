import { cn } from "@/lib/utils"
import type { StatementSegment } from "@/types/about"

type LitStatementProps = {
  segments: StatementSegment[]
  className?: string
}

// At rest words sit at 55% (large text, still well above AA contrast); the
// cursor light lifts them to full strength via --light (useLightProximity).
const WORD = cn(
  "opacity-[calc(0.55_+_var(--light,0)_*_0.45)]",
  "transition-[opacity,text-shadow] duration-200 ease-out"
)

// Keywords: soft purple at rest, glowing in the brand purple when lit.
const ACCENT = cn(
  "font-normal text-accent-soft font-stretch-semi-expanded",
  "[text-shadow:0_0_calc(var(--light,0)*28px)_var(--color-accent)]"
)

/**
 * The About statement, set large and split into words so each word can be
 * lit individually by the cursor light.
 *
 * Every word is a `[data-light]` span. Whitespace stays as plain text between
 * spans, so screen readers and copy/paste get the sentence exactly as written.
 */
export function LitStatement({ segments, className }: LitStatementProps) {
  return (
    <p
      className={cn(
        "font-display text-[clamp(2.25rem,5vw,4.75rem)] font-light leading-[1.08] text-text",
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
              {part}
            </span>
          )
        })
      )}
    </p>
  )
}
