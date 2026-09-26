/**
 * About section — "Depth Scan".
 *
 * The Hero resolves the signal into a name; About takes the visitor inside it.
 * There's no cut between them: both sit on the same shared backdrop (the
 * page-level SignalField), and the About stage overlaps the Hero's last
 * screen, so once the name has broken apart toward the camera the first
 * layer flies in out of the dark.
 *
 * Scrolling then moves forward along the z axis through four set pieces.
 * Behind them, the 3D core's particles take a new shape for each one:
 *   01 Signal     — the statement, lit word by word           (shell)
 *   02 Origin     — the story written in the sky: touch a star
 *                   and its line flies out of it in big type    (galaxy)
 *   03 Field log  — case files on a holographic carousel; hold
 *                   the light on one to scan it and flip it     (helix)
 *   04 Status     — satellites to catch with a tractor beam;
 *                   catch them all and the core shatters into
 *                   a beam of light and "Open to work"          (rings)
 * Plus six hidden fragments, and a sonar ping on every click.
 *
 * Layers back → front (depth mode):
 *   -. SignalField (page-level, fixed, shared with the Hero)
 *   1. SignalCore — R3F, lazy          (z-[1])
 *   2. AboutFx — lines, beams, sparks  (z-[6])
 *   3. Layers                          (z-10)
 *   4. HUD — heading, depth readout, gauge, counters (z-20)
 * The core and HUD fade in with --about-enter during the handoff.
 *
 * Two modes, decided once on mount:
 * - depth: hover-capable pointer, no reduced-motion preference, ≥1024px wide.
 *   Overlaps the Hero; a tall section with a sticky stage; useDepthScroll
 *   scrubs the dive.
 * - flat: everything else. The layers stack in normal flow after the Hero,
 *   no 3D or FX canvas, satellites sit in a grid, and on touch the story,
 *   case files and satellites start fully revealed.
 */

import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { gsap } from "gsap"
import { cn } from "@/lib/utils"
import { canHover, prefersImmersive } from "@/lib/media"
import { emitPing } from "@/lib/ping"
import { emitSparks, sparkFrom } from "@/lib/sparks"
import { ErrorBoundary } from "@/components/layout"
import {
  AboutFx,
  AboutLayer,
  CaseFiles,
  LightFragment,
  LitStatement,
  OrbitField,
  StarStory,
  lineId,
  starId,
} from "@/components/about"
import { useLightCharge, useLightProximity, usePointerTilt } from "@/hooks/cursor"
import { HANDOFF_VH, depthPhases, useDepthScroll } from "@/hooks/about"
import { useDiscoveries } from "@/hooks/shared"
import type {
  CaseFile,
  FragmentContent,
  LogEntry,
  OriginBeat,
  Satellite,
  StatementSegment,
  StatusItem,
} from "@/types/about"

const SignalCore = lazy(() =>
  import("@/components/about/signal-core").then((m) => ({ default: m.SignalCore }))
)

const PHASES = depthPhases(4)
// Progress windows in which each 3D formation holds still (one per layer)
const FORMATION_WINDOWS = PHASES.holds.map(
  ([start, end]) => [start / PHASES.total, end / PHASES.total] as const
)
// When the finale plays by itself if the visitor hasn't caught every satellite
const FINALE_AT = PHASES.tailStart + 0.3
const MAX_DEPTH = 400 // metres shown on the readout at the bottom of the dive

// Where each fragment sits in depth mode, by its index in the fragment list.
// Positions keep clear of each layer's content.
const FRAGMENT_POSITIONS = [
  "absolute start-[5%] top-[16%]",
  "absolute end-[6%] bottom-[14%]",
  "absolute end-[3%] top-[7%]",
  "absolute start-[3%] bottom-[16%]",
  "absolute end-[4%] top-[9%]",
  "absolute start-[5%] top-[12%]",
] as const

// Which fragments belong to which layer, as indexes into the fragment list.
const LAYER_FRAGMENTS = {
  signal: [0, 1],
  origin: [2, 3],
  log: [4],
  status: [5],
} as const

// Gauge tick positions, one per layer (there are always four layers).
const GAUGE_TICKS = ["top-0", "top-1/3", "top-2/3", "top-full"] as const

// A title floating at the top of a full-bleed layer
const FLOATING_TITLE = "absolute inset-x-0 top-0 mb-0 text-center"

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

const pad = (n: number) => String(n).padStart(2, "0")

export function AboutSection() {
  const { t } = useTranslation()

  // Input type and motion preference don't change mid-session in practice.
  const [depth] = useState(prefersImmersive)
  const [pointer] = useState(canHover)

  // ── Content ────────────────────────────────────────────────────────────────
  const statement = t("about.statement", { returnObjects: true }) as StatementSegment[]
  const beats = t("about.origin.beats", { returnObjects: true }) as OriginBeat[]
  const experience = t("about.log.experience", { returnObjects: true }) as LogEntry[]
  const education = t("about.log.education", { returnObjects: true }) as LogEntry[]
  const statusItems = t("about.status.items", { returnObjects: true }) as StatusItem[]
  const fragmentList = t("about.fragments.items", {
    returnObjects: true,
  }) as FragmentContent[]

  const logGroups = [
    { title: t("about.log.experienceTitle"), entries: experience },
    { title: t("about.log.educationTitle"), entries: education },
  ]
  const caseFiles: CaseFile[] = logGroups
    .flatMap((group, gi) =>
      group.entries.map((entry, ei) => ({
        ...entry,
        id: lineId(gi, ei),
        group: group.title,
      }))
    )
    .map((file, i) => ({ ...file, code: `LOG_${pad(i + 1)}` }))
  const satellites: Satellite[] = [
    ...statusItems.map((item, i) => ({
      id: `sat-${i}`,
      code: `SAT_${pad(i + 1)}`,
      label: item.label,
      value: item.value,
    })),
    {
      id: `sat-${statusItems.length}`,
      code: `SAT_${pad(statusItems.length + 1)}`,
      label: t("about.status.availabilityLabel"),
      value: t("about.status.availability.title"),
      detail: t("about.status.availability.detail"),
    },
  ]
  const availability = {
    alert: t("about.status.availability.alert"),
    title: t("about.status.availability.title"),
    detail: t("about.status.availability.detail"),
  }

  // ── Discoveries (ids are fixed on mount; only the text is translated) ─────
  const [fragmentIds] = useState(() => fragmentList.map((f) => f.id))
  const [starIds] = useState(() => beats.map((_, i) => starId(i)))
  const [fileIds] = useState(() => caseFiles.map((f) => f.id))
  const [satelliteIds] = useState(() => satellites.map((s) => s.id))

  const fragments = useDiscoveries(fragmentIds)
  // No light on touch: the story and case files start revealed there.
  const stars = useDiscoveries(starIds, { initiallyFound: !pointer })
  const files = useDiscoveries(fileIds, { initiallyFound: !pointer })
  // Without orbits (flat mode) the satellites are simply shown.
  const sats = useDiscoveries(satelliteIds, { initiallyFound: !depth })

  const decoded = [fragments, stars, files, sats].map((d) => d.allFound)
  const fullyDecoded = decoded.every(Boolean)
  const [activeBeat, setActiveBeat] = useState<number | null>(null)

  // ── Discovering things: state + sparks where it happened ─────────────────
  const stageRef = useRef<HTMLDivElement | null>(null)
  const sparkAt = useCallback(
    (selector: string, count?: number) =>
      sparkFrom(stageRef.current?.querySelector(selector) ?? null, count),
    []
  )

  const { markFound: markFragment, isFound: isFragmentFound } = fragments
  const findFragment = useCallback(
    (id: string) => {
      if (!isFragmentFound(id)) sparkAt(`[data-fragment-id="${id}"]`, 18)
      markFragment(id)
    },
    [isFragmentFound, markFragment, sparkAt]
  )

  const { markFound: markStar, isFound: isStarTraced } = stars
  const touchStar = useCallback(
    (id: string) => {
      if (!isStarTraced(id)) sparkAt(`[data-star-id="${id}"]`, 36)
      markStar(id)
      const index = starIds.indexOf(id)
      if (index >= 0) setActiveBeat((current) => (current === index ? current : index))
    },
    [isStarTraced, markStar, sparkAt, starIds]
  )

  const { markFound: markFile, markAll: markAllFiles, isFound: isFileDecrypted } = files
  const decryptFile = useCallback(
    (id: string) => {
      if (!isFileDecrypted(id)) {
        const card = stageRef.current?.querySelector(`[data-line-id="${id}"]`)
        sparkFrom(card ?? null, 48)
        if (card && depth) {
          const r = card.getBoundingClientRect()
          emitPing(r.left + r.width / 2, r.top + r.height / 2)
        }
      }
      markFile(id)
    },
    [depth, isFileDecrypted, markFile]
  )

  const { markFound: markSatellite, isFound: isSatelliteCaught } = sats
  const catchSatellite = useCallback(
    (id: string) => {
      if (!isSatelliteCaught(id)) sparkAt(`[data-satellite-id="${id}"]`, 40)
      markSatellite(id)
    },
    [isSatelliteCaught, markSatellite, sparkAt]
  )

  // Light brushing past: fragments are found, stars are traced (and replayed).
  const onIlluminate = useCallback(
    (el: HTMLElement) => {
      const { fragmentId, starId: star } = el.dataset
      if (fragmentId) findFragment(fragmentId)
      if (star) touchStar(star)
    },
    [findFragment, touchStar]
  )
  // Light held: case files finish scanning, satellites are caught.
  const onCharged = useCallback(
    (el: HTMLElement) => {
      const { lineId: file, satelliteId } = el.dataset
      if (file) decryptFile(file)
      if (satelliteId) catchSatellite(satelliteId)
    },
    [decryptFile, catchSatellite]
  )

  const { containerRef: lightRef } = useLightProximity<HTMLDivElement>({ onIlluminate })
  const { containerRef: chargeRef } = useLightCharge<HTMLDivElement>({
    onCharged,
    duration: 1000,
  })
  const { containerRef: tiltRef } = usePointerTilt<HTMLDivElement>()

  const setStage = useCallback(
    (el: HTMLDivElement | null) => {
      stageRef.current = el
      lightRef.current = el
    },
    [lightRef]
  )
  const setLayers = useCallback(
    (el: HTMLDivElement | null) => {
      chargeRef.current = el
      tiltRef.current = el
    },
    [chargeRef, tiltRef]
  )

  // ── Scroll-driven HUD, written straight to the DOM (no re-renders) ──────
  const progressRef = useRef(0)
  const burstRef = useRef(0)
  const readoutRef = useRef<HTMLSpanElement>(null)
  const gaugeMarkerRef = useRef<HTMLSpanElement>(null)
  const [tailReached, setTailReached] = useState(false)
  // The 3D core and FX canvas sit under the Hero until About's first layer
  // starts to appear; they're invisible until then, so they don't render.
  const [worldActive, setWorldActive] = useState(false)

  const onProgress = useCallback((progress: number) => {
    progressRef.current = progress
    const units = progress * PHASES.total
    if (readoutRef.current) {
      readoutRef.current.textContent = String(Math.round(progress * MAX_DEPTH)).padStart(
        3,
        "0"
      )
    }
    if (gaugeMarkerRef.current) {
      gaugeMarkerRef.current.style.top = `${progress * 100}%`
    }
    const enter = smoothstep(PHASES.quietUntil, PHASES.arrivals[0] - 0.15, units)
    stageRef.current?.style.setProperty("--about-enter", enter.toFixed(3))
    // Same-value updates are bailed out by React, so this rarely re-renders.
    setTailReached(units >= FINALE_AT)
    setWorldActive(units >= PHASES.quietUntil - 0.05)
  }, [])

  const { sectionRef } = useDepthScroll<HTMLElement>({ enabled: depth, onProgress })

  // Tracing the whole constellation sends a pulse out from the sky.
  const starsComplete = stars.allFound
  const starsWereComplete = useRef(starsComplete)
  useEffect(() => {
    if (depth && starsComplete && !starsWereComplete.current) {
      const sky = stageRef.current?.querySelector("[data-star-id]")?.parentElement
      if (sky) {
        const r = sky.getBoundingClientRect()
        emitPing(r.left + r.width / 2, r.top + r.height / 2)
      }
    }
    starsWereComplete.current = starsComplete
  }, [depth, starsComplete])

  // Catching every satellite locks the signal: the core shatters.
  useEffect(() => {
    if (!depth || !sats.allFound) return
    const stage = stageRef.current?.getBoundingClientRect()
    if (stage) {
      emitPing(stage.left + stage.width / 2, stage.top + stage.height / 2)
      emitSparks(stage.left + stage.width / 2, stage.top + stage.height / 2, 90)
    }
    const tween = gsap.to(burstRef, { current: 1, duration: 2.6, ease: "power2.out" })
    return () => {
      tween.kill()
    }
  }, [depth, sats.allFound])

  const renderFragments = (indexes: readonly number[]) =>
    indexes.map((i) => {
      const fragment = fragmentList[i]
      if (!fragment) return null
      return (
        <LightFragment
          key={fragment.id}
          fragment={fragment}
          found={fragments.isFound(fragment.id)}
          onFind={findFragment}
          className={depth ? FRAGMENT_POSITIONS[i] : undefined}
        />
      )
    })

  const fragmentCounter = (
    <p className="font-mono text-[11px] uppercase tracking-[0.3em]">
      <span className="sr-only">
        {t("about.fragments.srCount", {
          found: fragments.foundCount,
          total: fragments.total,
        })}
      </span>
      <span aria-hidden="true" className="text-text/60">
        {t("about.fragments.label")}{" "}
        <span className={cn(fragments.allFound ? "text-accent-soft" : "text-text")}>
          {pad(fragments.foundCount)}/{pad(fragments.total)}
        </span>
        {fragments.allFound && (
          <span className="ms-3 text-accent-soft">{t("about.fragments.complete")}</span>
        )}
      </span>
    </p>
  )

  const layers = [
    { key: "signal", ...t("about.layers.signal", { returnObjects: true }) },
    { key: "origin", ...t("about.layers.origin", { returnObjects: true }) },
    { key: "log", ...t("about.layers.log", { returnObjects: true }) },
    { key: "status", ...t("about.layers.status", { returnObjects: true }) },
  ] as const

  return (
    <section
      ref={sectionRef}
      id="about"
      aria-labelledby="about-heading"
      data-mode={depth ? "depth" : "flat"}
      // In depth mode the section starts a full screen early, on top of the Hero:
      // its own box lets clicks through, and its controls opt back in
      className={cn("relative", depth && "pointer-events-none z-20")}
      style={
        depth
          ? {
              // Derived from the timeline (depthPhases) and the Hero's height,
              // so the scroll length and the handoff overlap can't drift apart.
              height: `${PHASES.sectionVh}vh`,
              marginTop: `-${HANDOFF_VH}vh`,
            }
          : undefined
      }
    >
      <div
        ref={setStage}
        className={cn(
          depth
            ? "pointer-events-none sticky top-0 h-svh overflow-hidden"
            : "relative py-28"
        )}
      >
        {/* ── 1. 3D world (depth mode only; decorative, so failures render nothing) ── */}
        {depth && (
          <ErrorBoundary fallback={null}>
            <Suspense fallback={null}>
              <SignalCore
                progressRef={progressRef}
                burstRef={burstRef}
                windows={FORMATION_WINDOWS}
                dispersalStart={FINALE_AT / PHASES.total}
                active={worldActive}
                className="z-[1] opacity-[var(--about-enter,1)]"
              />
            </Suspense>
          </ErrorBoundary>
        )}

        {/* ── 2. Light-drawing layer: constellation, beams, trails, sparks ── */}
        {depth && <AboutFx active={worldActive} className="z-[6]" />}

        {/* ── 4. HUD (first in DOM so the h2 precedes the layer h3s) ─────────── */}
        <header
          className={cn(
            "z-20",
            depth
              ? "pointer-events-none absolute inset-x-10 top-10 flex items-start justify-between opacity-[var(--about-enter,1)]"
              : "relative mx-auto mb-24 max-w-5xl px-6"
          )}
        >
          <div>
            <p className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-accent-soft">
              {fullyDecoded ? t("about.decoded") : t("about.file")}
              <span aria-hidden="true" className="flex gap-1">
                {decoded.map((done, i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-1.5 w-1.5 transition-colors duration-500",
                      done
                        ? "bg-accent shadow-[0_0_6px_var(--color-accent)]"
                        : "bg-text/20"
                    )}
                  />
                ))}
              </span>
            </p>
            <h2
              id="about-heading"
              className={cn(
                "mt-3 font-sans uppercase tracking-[0.6em] text-text",
                depth ? "text-2xl" : "text-5xl"
              )}
            >
              {t("about.heading")}
            </h2>
            {depth && (
              <p
                aria-hidden="true"
                className="mt-4 font-mono text-[11px] uppercase tracking-[0.3em] text-text/60"
              >
                {t("about.depth")} <span ref={readoutRef}>000</span>
                {t("about.depthUnit")}
              </p>
            )}
          </div>
          {!depth && (
            <div className="mt-8 space-y-4">
              <p className="max-w-md font-mono text-[11px] leading-relaxed text-text/60">
                {pointer ? t("about.hintPointer") : t("about.hintTouch")}
              </p>
              {fragmentCounter}
            </div>
          )}
        </header>

        {depth && (
          <>
            <div className="pointer-events-none absolute inset-x-10 bottom-10 z-20 flex items-end justify-between gap-10 opacity-[var(--about-enter,1)]">
              <p className="max-w-sm font-mono text-[11px] leading-relaxed text-text/60">
                {t("about.hintPointer")}
              </p>
              {fragmentCounter}
            </div>

            {/* Depth gauge — one tick per layer, marker follows scroll progress */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute end-10 top-1/2 z-20 h-[40vh] -translate-y-1/2 opacity-[var(--about-enter,1)]"
            >
              <div className="relative h-full w-px bg-border">
                {layers.map((layer, i) => (
                  <span
                    key={layer.key}
                    className={cn(
                      "absolute end-0 flex -translate-y-1/2 items-center gap-2",
                      GAUGE_TICKS[i]
                    )}
                  >
                    <span className="font-mono text-[10px] text-text/50">
                      {layer.index}
                    </span>
                    <span className="h-px w-2 bg-text/40" />
                  </span>
                ))}
                <span
                  ref={gaugeMarkerRef}
                  className="absolute start-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 bg-accent shadow-[0_0_10px_var(--color-accent)]"
                />
              </div>
            </div>
          </>
        )}

        {/* ── 3. Layers ───────────────────────────────────────────────────────── */}
        <div
          ref={setLayers}
          className={cn(
            "z-10",
            depth
              ? "absolute inset-0 [perspective:1200px]"
              : "relative mx-auto flex max-w-5xl flex-col gap-32 px-6"
          )}
        >
          {/* 01 — Signal: the statement, lit word by word */}
          <AboutLayer
            index={layers[0].index}
            title={layers[0].title}
            depth={depth}
            contentClassName={cn("max-w-5xl", depth && "text-center")}
            fragments={renderFragments(LAYER_FRAGMENTS.signal)}
          >
            <LitStatement segments={statement} />
          </AboutLayer>

          {/* 02 — Origin: the story written in the sky */}
          <AboutLayer
            index={layers[1].index}
            title={layers[1].title}
            depth={depth}
            contentClassName={depth ? "h-[84vh] max-w-7xl" : "max-w-4xl"}
            titleClassName={depth ? FLOATING_TITLE : undefined}
            fragments={renderFragments(LAYER_FRAGMENTS.origin)}
          >
            <StarStory
              beats={beats}
              isTraced={stars.isFound}
              onTrace={touchStar}
              active={activeBeat}
              depth={depth}
              labels={{
                prompt: t("about.origin.prompt"),
                traced: t("about.origin.traced"),
                complete: t("about.origin.complete"),
                star: (n, total, mark) => t("about.origin.star", { n, total, mark }),
              }}
            />
          </AboutLayer>

          {/* 03 — Field log: holographic case files */}
          <AboutLayer
            index={layers[2].index}
            title={layers[2].title}
            depth={depth}
            contentClassName={depth ? "h-[84vh] max-w-7xl" : "max-w-5xl"}
            titleClassName={depth ? FLOATING_TITLE : undefined}
            fragments={renderFragments(LAYER_FRAGMENTS.log)}
          >
            <CaseFiles
              files={caseFiles}
              isDecrypted={files.isFound}
              onDecrypt={decryptFile}
              onDecryptAll={markAllFiles}
              allDecrypted={files.allFound}
              depth={depth}
              labels={{
                file: t("about.log.file"),
                classified: t("about.log.classified"),
                decrypted: t("about.log.decryptedStamp"),
                hold: t("about.log.hold"),
                decryptAll: t("about.log.decryptAll"),
                count: (done, total) =>
                  t("about.log.count", { done: pad(done), total: pad(total) }),
                complete: t("about.log.complete"),
              }}
            />
          </AboutLayer>

          {/* 04 — Status: catch the satellites; the signal locks */}
          <AboutLayer
            index={layers[3].index}
            title={layers[3].title}
            depth={depth}
            contentClassName={depth ? "h-[80vh] max-w-6xl" : "max-w-3xl"}
            titleClassName={depth ? FLOATING_TITLE : undefined}
            fragments={renderFragments(LAYER_FRAGMENTS.status)}
          >
            <OrbitField
              satellites={satellites}
              isCaught={sats.isFound}
              onCatch={catchSatellite}
              locked={sats.allFound}
              showFinale={sats.allFound || tailReached}
              availability={availability}
              labels={{
                caught: t("about.status.caught"),
                locked: t("about.status.locked"),
                hint: t("about.status.hint"),
              }}
              animate={depth}
            />
          </AboutLayer>
        </div>
      </div>
    </section>
  )
}
