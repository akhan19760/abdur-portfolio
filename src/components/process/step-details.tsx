import { cn } from "@/lib/utils"
import type { ProcessStep } from "@/types/process"
import { FoldDiagram } from "./fold-diagram"

type StepDetailsProps = {
  step: ProcessStep
  index: number
  count: number
  /**
   * Immersive mode: pinned to the left of the paper's stage and shown in
   * turn by the scroll (its title unfolds like a flap of paper). Otherwise
   * the step sits in normal flow with a small drawing of the paper.
   */
  floating: boolean
  /**
   * Notes that go with the step (Discover's pencil notes): small tags in
   * normal flow. When floating they're drawn on the 3D paper instead, so
   * here they're kept for screen readers only.
   */
  notes?: { label: string; items: string[] }
  className?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * One step of the process, as a list item: its number, its name in huge type
 * (brightening as the cursor's light passes) and one plain sentence.
 */
export function StepDetails({
  step,
  index,
  count,
  floating,
  notes,
  className,
}: StepDetailsProps) {
  return (
    <li
      data-fold-step={floating ? "" : undefined}
      className={cn(
        floating
          ? cn(
              "pointer-events-none absolute start-[max(9rem,10vw)] top-1/2 w-[min(34vw,32rem)] -translate-y-1/2",
              // Smaller landscape screens: less margin, a wider column
              "max-lg:start-6 max-lg:w-[42vw]",
              // Portrait: under the paper, which sits in the top part of the view
              "portrait:inset-x-5 portrait:top-[63%] portrait:w-auto portrait:translate-y-0 sm:portrait:inset-x-10"
            )
          : "relative flex items-center justify-between gap-10 border-t border-border py-10 sm:py-14",
        className
      )}
    >
      <div className="min-w-0">
        <p
          aria-hidden="true"
          data-fold-body
          className="font-mono text-sm tracking-[0.3em] text-accent-soft"
        >
          {pad(index + 1)} <span className="text-text/40">/ {pad(count)}</span>
        </p>
        <h3
          data-fold-title
          className="mt-4 font-display text-[clamp(2.5rem,11vw,3rem)] font-light leading-[0.95] text-text [overflow-wrap:anywhere] sm:text-[clamp(3rem,6.5vw,6.5rem)]"
        >
          <span
            data-light
            className="inline-block opacity-[calc(0.62_+_var(--light,0)_*_0.38)] [text-shadow:0_0_calc(var(--light,0)*22px)_rgba(153,0,250,0.5)]"
          >
            {step.name}
          </span>
        </h3>
        <p
          data-fold-body
          className="mt-5 max-w-md font-support text-base leading-relaxed text-text/85 sm:mt-6 sm:text-[17px]"
        >
          {step.summary}
        </p>
        {notes && notes.items.length > 0 && (
          <div className={cn(floating && "sr-only")}>
            <h4 className="sr-only">{notes.label}</h4>
            <ul className="mt-5 flex flex-wrap gap-2">
              {notes.items.map((note, i) => (
                <li
                  key={`${note}-${i}`}
                  className="border border-border px-2.5 py-1 font-mono text-[11px] text-text/75"
                >
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {!floating && <FoldDiagram stage={index} className="hidden sm:block" />}
    </li>
  )
}
