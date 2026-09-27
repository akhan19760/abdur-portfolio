/**
 * Process section.
 *
 * Work ends over dark water at night; Process begins on it. As Work's stage
 * scrolls away, its camera turns to look straight down at the water, the
 * waves go still, and a sheet of paper drifts down out of the dark and
 * settles on the surface. The sea fades away under it, leaving the sheet in
 * the dark, lit only by the visitor's cursor.
 *
 * Then the paper is folded into a paper plane, one step of the process at a
 * time: Discover (the blank sheet, with pencil notes that show under the
 * light), Design (the fold lines draw themselves on), Build (the folds),
 * Refine (the wings — it's a plane now, and it follows the light) and
 * Launch (it flies off into the dark, where Contact's wall of pins is
 * waiting for it). Each step's name unfolds on the left
 * in huge type, like a flap of paper, with one plain sentence under it; the
 * list at the bottom shows all five and jumps to any.
 *
 * Layers back → front (immersive mode):
 *   1. FoldingPaper — R3F, lazy, fixed full-viewport canvas
 *   2. Sticky stage: heading, one StepDetails per step (shown in turn), the
 *      step list and a one-line hint
 *
 * Two modes, decided once on mount:
 * - immersive: every device without a reduced-motion preference. In portrait
 *   the paper folds in the top part of the view with the step's text below
 *   (lib/stage-framing). A tall section; useFoldScroll shows each step's text
 *   in turn and the paper reads the same scroll position.
 * - flat: reduced motion. The steps are a plain numbered list, each with a
 *   small drawing of the paper at that step, and no WebGL.
 */

import { Suspense, lazy, useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { canHover, prefersImmersive } from "@/lib/media"
import { ErrorBoundary } from "@/components/layout"
import { StepDetails, StepNav } from "@/components/process"
import { useLightProximity } from "@/hooks/cursor"
import { foldPhases, stepAt, useFoldScroll } from "@/hooks/process"
import type { ProcessStep } from "@/types/process"

const FoldingPaper = lazy(() =>
  import("@/components/process/folding-paper").then((m) => ({ default: m.FoldingPaper }))
)

export function ProcessSection() {
  const { t } = useTranslation()

  // Input type and motion preference don't change mid-session in practice.
  const [immersive] = useState(prefersImmersive)
  const [pointer] = useState(canHover)

  const steps = t("process.steps", { returnObjects: true }) as ProcessStep[]
  const notes = t("process.notes", { returnObjects: true }) as string[]
  const phases = useMemo(foldPhases, [])

  // Which step is on stage (for the step list)
  const [active, setActive] = useState(0)
  const onProgress = useCallback(
    // Same-value updates are bailed out by React, so this rarely re-renders.
    (units: number) => setActive(stepAt(units, phases)),
    [phases]
  )

  const { sectionRef, readUnits, scrollToStep } = useFoldScroll<HTMLElement>({
    enabled: immersive,
    onProgress,
  })
  // Each step's name brightens as the cursor's light passes
  const { containerRef: lightRef } = useLightProximity<HTMLDivElement>()

  return (
    <section
      ref={sectionRef}
      id="process"
      aria-labelledby="process-heading"
      data-mode={immersive ? "immersive" : "flat"}
      className={cn("relative", immersive ? "z-10" : "py-20 sm:py-28")}
      // Derived from the timeline (foldPhases), so the scroll length can't drift from it
      style={immersive ? { height: `${phases.sectionVh}vh` } : undefined}
    >
      {/* ── 1. The paper (immersive only; decorative, so failures render nothing) ── */}
      {immersive && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <FoldingPaper readUnits={readUnits} phases={phases} notes={notes} />
          </Suspense>
        </ErrorBoundary>
      )}

      <div
        ref={lightRef}
        className={cn(
          immersive
            ? "pointer-events-none sticky top-0 h-svh overflow-hidden"
            : "relative"
        )}
      >
        {/* ── 2. Heading (first in DOM so the h2 precedes the steps' h3s) ────── */}
        <header
          data-fold-hud={immersive ? "" : undefined}
          className={cn(
            immersive
              ? "absolute start-5 top-5 lg:start-10 lg:top-10"
              : "relative mx-auto mb-10 max-w-4xl px-6 sm:mb-16"
          )}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-soft">
            {t("process.label")}
          </p>
          <h2
            id="process-heading"
            className={cn(
              "mt-3 font-sans uppercase text-text",
              immersive
                ? "text-lg tracking-[0.45em] lg:text-2xl lg:tracking-[0.6em]"
                : "text-3xl tracking-[0.35em] sm:text-5xl sm:tracking-[0.6em]"
            )}
          >
            {t("process.heading")}
          </h2>
        </header>

        {/* ── 3. The steps ───────────────────────────────────────────────────── */}
        <ol className={cn(!immersive && "relative mx-auto max-w-4xl px-6")}>
          {steps.map((step, i) => (
            <StepDetails
              key={step.id}
              step={step}
              index={i}
              count={steps.length}
              floating={immersive}
              // Discover's pencil notes, as text (on the 3D paper they're drawn)
              notes={
                i === 0 ? { label: t("process.notesLabel"), items: notes } : undefined
              }
            />
          ))}
        </ol>

        {immersive && (
          <>
            <div
              data-fold-hud
              className="absolute bottom-10 start-[max(9rem,10vw)] max-lg:bottom-4 max-lg:start-4"
            >
              <StepNav
                steps={steps}
                active={active}
                onSelect={scrollToStep}
                label={t("process.navLabel")}
                className="pointer-events-auto"
              />
            </div>
            <p
              data-fold-hud
              className="absolute bottom-10 end-10 max-w-[17rem] text-end font-support text-[11px] leading-relaxed text-text/55 max-lg:start-5 max-lg:end-auto max-lg:bottom-16 max-lg:max-w-[80%] max-lg:text-start max-lg:text-[10px]"
            >
              {pointer ? t("process.hint") : t("process.hintTouch")}
            </p>
          </>
        )}
      </div>
    </section>
  )
}
