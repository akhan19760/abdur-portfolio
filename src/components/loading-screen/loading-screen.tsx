import { useRef } from "react"
import type {
  LoadingScreenProps,
  RadarBlip,
  WaveState,
} from "@/types/loading-screen"
import {
  useGrainCanvas,
  useLoadingEntryAnimations,
  useLoadingExitAnimation,
  useLoadingState,
  useRadarCanvas,
  useSurveillanceClock,
  useWaveCanvas,
} from "@/hooks/loading-screen"
import {
  BinaryTicker,
  CorruptionOverlay,
  CrtAtmosphere,
  EqSpectrum,
  FilmGrain,
  GhostWatermark,
  HexAddresses,
  RadarSweep,
  SignalStatus,
  SplitCurtain,
  SurveillanceHeader,
  TargetingReticle,
  TerminalLog,
  ViewfinderBrackets,
  WaveDisplay,
} from "./components"

export type { LoadingScreenProps }

/**
 * Full-screen animated loading overlay.
 *
 * Five distinct background elements (beyond the EKG wave):
 *   1. Animated radar sweep — canvas, bottom-right corner
 *   2. EQ spectrum bars — 10 GSAP-animated bars, left side
 *   3. Ghost watermark — "INIT" in huge dim type, occasionally glitches
 *   4. Targeting reticle — crosshair + pulsing ring, upper-right area
 *   5. Signal status bars — SIG / MEM / CPU / NET with animated fill
 *
 * 2000s CRT TV effect:
 *   - Radial vignette with phosphor tint at centre + deep dark edges
 *   - Heavy inward box-shadow on the container (CRT bezel / screen falloff)
 *   - CRT scanlines (repeating-linear-gradient, 3px pitch)
 *   - Film-grain canvas at ~5.5% opacity
 *   - Periodic CRT power-flicker via GSAP
 *
 * Exit — split curtain:
 *   Curtain panels slide away in opposite directions (top −100%, bottom +100%)
 *   revealing underlying application content.
 *
 * Accessibility: aria-hidden + inert. prefers-reduced-motion → "done" instantly.
 */
export function LoadingScreen({
  holdDuration = 3000,
  exitDuration = 1000,
}: LoadingScreenProps) {
  const state = useLoadingState({ holdDuration, exitDuration })

  const containerRef     = useRef<HTMLDivElement>(null)
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const grainCanvasRef   = useRef<HTMLCanvasElement>(null)
  const radarCanvasRef   = useRef<HTMLCanvasElement>(null)
  const ghostTextRef     = useRef<HTMLSpanElement>(null)
  const binaryStripRef   = useRef<HTMLDivElement>(null)
  const counterRef       = useRef<HTMLSpanElement>(null)
  const labelRef         = useRef<HTMLSpanElement>(null)
  const clockRef         = useRef<HTMLSpanElement>(null)
  const errFlashRef      = useRef<HTMLDivElement>(null)
  const topCurtainRef    = useRef<HTMLDivElement>(null)
  const bottomCurtainRef = useRef<HTMLDivElement>(null)

  // Mutable wave / radar state — avoids React re-renders each tick
  const waveRef       = useRef<WaveState>({ offset: 0, amplitude: 1, corrupted: false })
  const radarAngleRef = useRef<number>(0)
  const radarBlipsRef = useRef<RadarBlip[]>([])

  // ── Canvas RAF Loops & Clock Timer ──────────────────────────────────────────
  useWaveCanvas(canvasRef, waveRef)
  useGrainCanvas(grainCanvasRef)
  useRadarCanvas(radarCanvasRef, radarAngleRef, radarBlipsRef)
  useSurveillanceClock(clockRef)

  // ── GSAP Timelines ──────────────────────────────────────────────────────────
  useLoadingEntryAnimations({
    containerRef,
    binaryStripRef,
    ghostTextRef,
    counterRef,
    labelRef,
    errFlashRef,
    waveRef,
    holdDuration,
  })

  useLoadingExitAnimation({
    state,
    exitDuration,
    containerRef,
    topCurtainRef,
    bottomCurtainRef,
  })

  if (state === "done") return null

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      inert
      className="fixed inset-0 z-50 overflow-hidden bg-base"
      style={{
        boxShadow:
          "inset 0 0 180px rgba(0, 0, 0, 0.92), inset 0 0 60px rgba(0, 0, 0, 0.65)",
      }}
    >
      {/* z-10: CRT atmosphere (vignette & scanlines) */}
      <CrtAtmosphere />

      {/* z-[15]: Ghost text watermark */}
      <GhostWatermark ghostTextRef={ghostTextRef} />

      {/* z-20: UI content */}
      <ViewfinderBrackets />
      <SurveillanceHeader clockRef={clockRef} />
      <EqSpectrum />
      <SignalStatus />
      <TargetingReticle />
      <BinaryTicker binaryStripRef={binaryStripRef} />
      <WaveDisplay
        canvasRef={canvasRef}
        labelRef={labelRef}
        counterRef={counterRef}
      />
      <TerminalLog />
      <HexAddresses />
      <RadarSweep radarCanvasRef={radarCanvasRef} />

      {/* z-30: Film grain texture */}
      <FilmGrain grainCanvasRef={grainCanvasRef} />

      {/* z-40: Corruption overlays */}
      <CorruptionOverlay errFlashRef={errFlashRef} />

      {/* z-[75]: Split curtain exit panels */}
      <SplitCurtain
        topCurtainRef={topCurtainRef}
        bottomCurtainRef={bottomCurtainRef}
      />
    </div>
  )
}
