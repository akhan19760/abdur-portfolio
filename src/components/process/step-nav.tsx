import { cn } from "@/lib/utils"
import type { ProcessStep } from "@/types/process"

type StepNavProps = {
  steps: Pick<ProcessStep, "id" | "name">[]
  /** Index of the step on stage now. */
  active: number
  onSelect: (index: number) => void
  /** Accessible name for the list, e.g. "Steps". */
  label: string
  className?: string
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * The whole process in one line: every step by name, joined by a thread that
 * fills in purple up to the step on stage. Shows at a glance how far along
 * the paper is, and jumps straight to any step.
 */
export function StepNav({ steps, active, onSelect, label, className }: StepNavProps) {
  return (
    <nav aria-label={label} className={className}>
      {/* Compact screens: numbers only (the names are kept for screen readers) */}
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-1 max-lg:gap-x-1.5">
        {steps.map((step, i) => {
          const current = i === active
          return (
            <li key={step.id} className="flex items-center gap-3 max-lg:gap-1.5">
              {i > 0 && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-px w-6 transition-colors duration-500 max-lg:w-3",
                    i <= active ? "bg-accent" : "bg-text/25"
                  )}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex min-h-7 items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-300",
                  "max-lg:min-h-10 max-lg:px-1.5",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                  current ? "text-text" : "text-text/60 hover:text-text/90"
                )}
              >
                <span
                  aria-hidden="true"
                  className={current ? "text-accent-soft" : undefined}
                >
                  {pad(i + 1)}
                </span>
                <span className="max-lg:sr-only">{step.name}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
