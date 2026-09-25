/**
 * Work section.
 *
 * About ends on a dawn horizon; Work is the water under it. As About's stage
 * scrolls away, the camera comes down from over the planet to a dark sea at
 * night — its horizon locked to About's the whole way, so it's one continuous
 * shot — and the light becomes the visitor's: the cursor is a small light
 * floating over the water.
 *
 * Then it's simple: one project at a time. Its screen rises out of the water
 * on the right, reflected in the waves, while its name, role, summary, stack
 * and highlights sit on the left in big plain type (the name's words
 * brightening as the light passes). Scrolling glides sideways to the next
 * project; the list at the bottom right shows them all and jumps to any.
 *
 * Layers back → front (immersive mode):
 *   1. MirrorSea — R3F, lazy, fixed full-viewport canvas
 *   2. Sticky stage: heading, project counter, one ProjectDetails per
 *      project (shown in turn), the project list and a one-line hint
 *
 * Two modes, decided once on mount:
 * - immersive: hover-capable pointer, no reduced-motion preference, ≥1024px
 *   wide. A tall section; useSeaScroll scrubs the glide and brings each
 *   project's text in; the sea reads the same scroll position.
 * - flat: everything else. Projects stack in normal flow, each with its
 *   picture beside it, and no WebGL.
 */

import { Suspense, lazy, useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { prefersImmersive } from "@/lib/media"
import { ErrorBoundary } from "@/components/layout"
import { ProjectDetails, ProjectNav, seaStateAt } from "@/components/projects"
import { useLightProximity } from "@/hooks/cursor"
import { seaPhases, useSeaScroll } from "@/hooks/projects"
import type { Project } from "@/types/projects"

const MirrorSea = lazy(() =>
  import("@/components/projects/mirror-sea").then((m) => ({ default: m.MirrorSea }))
)

const pad = (n: number) => String(n).padStart(2, "0")

export function ProjectsSection() {
  const { t } = useTranslation()

  // Input type and motion preference don't change mid-session in practice.
  const [immersive] = useState(prefersImmersive)

  const projects = t("work.projects", { returnObjects: true }) as Project[]
  const count = projects.length
  const phases = useMemo(() => seaPhases(count), [count])

  // Which project is on screen (for the counter and the list)
  const [active, setActive] = useState(0)
  const onProgress = useCallback(
    (units: number) => {
      const aspect = window.innerWidth / Math.max(1, window.innerHeight)
      // Same-value updates are bailed out by React, so this rarely re-renders.
      setActive(seaStateAt(units, phases, aspect).active)
    },
    [phases]
  )

  const { sectionRef, readUnits, scrollToProject } = useSeaScroll<HTMLElement>({
    enabled: immersive,
    onProgress,
  })
  // The words of each project's name brighten as the cursor's light passes
  const { containerRef: lightRef } = useLightProximity<HTMLDivElement>()

  const detailLabels = (project: Project) => ({
    stack: t("work.panel.stack"),
    highlights: t("work.panel.highlights"),
    open: t("work.panel.open"),
    newTab: t("work.panel.newTab"),
    placeholder: t("work.placeholder"),
    screenshotAlt: t("work.screenshotAlt", { name: project.name }),
  })

  return (
    <section
      ref={sectionRef}
      id="work"
      aria-labelledby="work-heading"
      data-mode={immersive ? "immersive" : "flat"}
      className={cn("relative", immersive ? "z-10" : "py-28")}
      // Derived from the timeline (seaPhases), so the scroll length can't drift from it
      style={immersive ? { height: `${phases.sectionVh}vh` } : undefined}
    >
      {/* ── 1. The sea (immersive only; decorative, so failures render nothing) ── */}
      {immersive && (
        <ErrorBoundary fallback={null}>
          <Suspense fallback={null}>
            <MirrorSea
              readUnits={readUnits}
              phases={phases}
              projects={projects}
              placeholderLabel={t("work.placeholder")}
            />
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
        {/* ── 2. Heading (first in DOM so the h2 precedes the project h3s) ──── */}
        <header
          data-sea-hud={immersive ? "" : undefined}
          className={cn(
            immersive
              ? "absolute start-10 top-10"
              : "relative mx-auto mb-20 max-w-6xl px-6"
          )}
        >
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-accent-soft">
            {t("work.label")}
          </p>
          <h2
            id="work-heading"
            className={cn(
              "mt-3 font-sans uppercase tracking-[0.6em] text-text",
              immersive ? "text-2xl" : "text-5xl"
            )}
          >
            {t("work.heading")}
          </h2>
        </header>

        {immersive && (
          <p
            data-sea-hud
            aria-hidden="true"
            className="absolute end-10 top-10 font-mono text-sm tracking-[0.3em] text-text/50"
          >
            <span className="text-text">{pad(active + 1)}</span> / {pad(count)}
          </p>
        )}

        {/* ── 3. Projects ─────────────────────────────────────────────────────── */}
        <div
          className={cn(
            !immersive && "relative mx-auto flex max-w-6xl flex-col gap-28 px-6"
          )}
        >
          {projects.map((project, i) => (
            <ProjectDetails
              key={project.id}
              project={project}
              index={i}
              count={count}
              labels={detailLabels(project)}
              floating={immersive}
            />
          ))}
        </div>

        {immersive && (
          <div
            data-sea-hud
            className="absolute bottom-10 end-10 isolate flex flex-col items-end gap-5"
          >
            {/* A soft pool of dark so the list reads over the reflections */}
            <span
              aria-hidden="true"
              className="absolute -inset-x-12 -inset-y-10 -z-10 bg-[radial-gradient(closest-side,rgba(10,10,10,0.85),rgba(10,10,10,0.5)_65%,transparent)]"
            />
            <ProjectNav
              projects={projects}
              active={active}
              onSelect={scrollToProject}
              label={t("work.navLabel")}
              className="pointer-events-auto"
            />
            <p className="max-w-[17rem] text-end font-mono text-[11px] leading-relaxed text-text/55">
              {t("work.hint")}
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
