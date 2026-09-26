import { cn } from "@/lib/utils"
import { useOrbits } from "@/hooks/about"
import type { Dock, Orbit } from "@/hooks/about"
import type { Satellite } from "@/types/about"

type OrbitFieldLabels = {
  caught: string
  locked: string
  /** Instruction while satellites are loose, e.g. "Hold your light on a satellite". */
  hint: string
}

type OrbitFieldProps = {
  satellites: Satellite[]
  isCaught: (id: string) => boolean
  onCatch: (id: string) => void
  /** Every satellite caught. */
  locked: boolean
  /** Show the finale (on lock, or at the end of the scroll). */
  showFinale: boolean
  availability: { alert: string; title: string; detail: string }
  labels: OrbitFieldLabels
  /** Depth mode: satellites orbit. Otherwise they sit in a static grid. */
  animate: boolean
  className?: string
}

// Four tilted orbits around the core, in fractions of the field's half-size.
// Negative speeds go the other way round, so the satellites cross each other.
const ORBITS: Orbit[] = [
  { rx: 0.62, ry: 0.52, tilt: -0.35, speed: 0.42, phase: 0.3 },
  { rx: 0.8, ry: 0.36, tilt: 0.28, speed: -0.3, phase: 2.2 },
  { rx: 0.48, ry: 0.74, tilt: 0.9, speed: 0.36, phase: 4.1 },
  { rx: 0.9, ry: 0.56, tilt: -0.12, speed: -0.24, phase: 5.3 },
]

// Where each satellite settles once caught: the four corners around the core.
const DOCKS: Dock[] = [
  { x: -0.62, y: -0.5 },
  { x: 0.62, y: -0.5 },
  { x: -0.62, y: 0.5 },
  { x: 0.62, y: 0.5 },
]

const toDeg = (rad: number) => (rad * 180) / Math.PI
const pad = (n: number) => String(n).padStart(2, "0")

type SatelliteButtonProps = {
  satellite: Satellite
  index: number
  caught: boolean
  animate: boolean
  onCatch: (id: string) => void
}

function SatelliteButton({
  satellite,
  index,
  caught,
  animate,
  onCatch,
}: SatelliteButtonProps) {
  // Readouts sit on the outer side of each dock: left docks read leftward.
  const readoutLeft = animate && DOCKS[index] && DOCKS[index].x < 0
  const shown = caught || !animate
  const name = [`${satellite.label}: ${satellite.value}`, satellite.detail]
    .filter(Boolean)
    .join(", ")

  return (
    <button
      type="button"
      data-light
      data-satellite-id={satellite.id}
      data-orbit-index={animate ? index : undefined}
      data-caught={caught ? "" : undefined}
      data-charge={animate && !caught ? "" : undefined}
      aria-label={name}
      onClick={() => onCatch(satellite.id)}
      onFocus={() => onCatch(satellite.id)}
      className={cn(
        "grid h-14 w-14 place-items-center rounded-full",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        animate
          ? "absolute left-1/2 top-1/2 -ml-7 -mt-7 will-change-transform"
          : "relative shrink-0"
      )}
    >
      <span
        aria-hidden="true"
        className="absolute -inset-4 rounded-full bg-accent/45 opacity-[var(--light,0)] blur-xl"
      />
      {/* Charge ring: fills while the tractor beam holds */}
      <svg aria-hidden="true" viewBox="0 0 56 56" className="absolute inset-0 -rotate-90">
        <circle
          cx="28"
          cy="28"
          r="25"
          pathLength={1}
          className="fill-none stroke-accent-soft/25 [stroke-width:1px]"
        />
        <circle
          cx="28"
          cy="28"
          r="25"
          pathLength={1}
          className={cn(
            "fill-none stroke-accent-soft [stroke-dasharray:1] [stroke-linecap:round] [stroke-width:2.5px]",
            shown
              ? "[stroke-dashoffset:0]"
              : "[stroke-dashoffset:calc(1_-_var(--charge,0))]"
          )}
        />
      </svg>
      <span
        aria-hidden="true"
        className="absolute inset-2 animate-orbit-spin rounded-full border border-dashed border-accent-soft/60"
      />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-4 w-4 rounded-full transition-[background-color,box-shadow] duration-500",
          shown
            ? "bg-white shadow-[0_0_18px_6px_var(--color-accent)]"
            : "bg-accent-soft shadow-[0_0_10px_2px_var(--color-accent)]"
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "whitespace-nowrap",
          animate
            ? cn(
                "absolute top-1/2 -translate-y-1/2",
                readoutLeft ? "right-full mr-4 text-right" : "left-full ml-4 text-left"
              )
            : "absolute left-full top-1/2 ml-4 -translate-y-1/2 text-left"
        )}
      >
        <span
          className={cn(
            "block font-mono text-[10px] tracking-[0.3em] text-accent-soft",
            !shown && "opacity-[calc(0.5_+_var(--light,0)_*_0.5)]"
          )}
        >
          {satellite.code} · {satellite.label}
        </span>
        <span
          className={cn(
            "block font-display text-2xl leading-tight text-text transition-opacity duration-700",
            shown ? "opacity-100" : "opacity-0"
          )}
        >
          {satellite.value}
        </span>
        {satellite.detail && (
          <span
            className={cn(
              "block font-mono text-[11px] text-text/75 transition-opacity duration-700",
              shown ? "opacity-100" : "opacity-0"
            )}
          >
            {satellite.detail}
          </span>
        )}
      </span>
    </button>
  )
}

type FinaleProps = {
  visible: boolean
  availability: OrbitFieldProps["availability"]
  floating: boolean
}

/**
 * "Open to work", rising out of the core in giant type once the signal locks.
 * Visual only — the availability satellite carries the text for assistive tech.
 */
function Finale({ visible, availability, floating }: FinaleProps) {
  const words = availability.title.split(" ")
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none text-center transition-opacity duration-700",
        floating &&
          "absolute left-1/2 top-1/2 w-[min(84vw,1100px)] -translate-x-1/2 -translate-y-1/2",
        visible ? "opacity-100" : "opacity-0"
      )}
    >
      {visible && (
        <>
          <p className="mb-5 flex animate-word-in items-center justify-center gap-3 font-mono text-[11px] uppercase tracking-[0.4em] text-accent-soft">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
            {availability.alert}
          </p>
          <p className="font-display text-[clamp(3rem,8.5vw,8rem)] font-thin leading-[0.95] text-text font-stretch-expanded">
            {words.map((word, i) => (
              <span key={i}>
                {i > 0 && " "}
                <span
                  data-light
                  className="inline-block animate-word-rise opacity-[calc(0.75_+_var(--light,0)_*_0.25)] [text-shadow:0_0_calc(10px_+_var(--light,0)*24px)_var(--color-accent)]"
                  // Staggered rise — a runtime index, not expressible as a class
                  style={{ animationDelay: `${250 + i * 130}ms` }}
                >
                  {word}
                </span>
              </span>
            ))}
          </p>
          <p className="mt-6 animate-word-in font-mono text-[12px] tracking-[0.2em] text-text/80 [animation-delay:900ms]">
            {availability.detail}
          </p>
        </>
      )}
    </div>
  )
}

/**
 * The Status layer: the facts are satellites orbiting the 3D core.
 *
 * Each satellite circles on its own tilted orbit (the core's particles form
 * planetary rings behind them), trailing light and slowing under the cursor.
 * Hold the light on one: the FX canvas locks a tractor beam onto it and its
 * charge ring fills (the section's charge hook). When it's full the satellite
 * is caught — sparks, then it eases out of orbit into a corner dock and shows
 * its readout. Catch all four and the signal locks: lines snap to the core,
 * the core shatters with a beam of light (the section bursts it), and
 * "Open to work" rises out of it. The finale also plays at the end of the
 * scroll for anyone who doesn't play.
 *
 * Accessibility: satellites are buttons named with their full readout, so
 * screen readers get every fact without catching anything, and focus or a
 * click catches one at once. Without motion (flat mode) they sit in a static
 * grid with their readouts showing.
 */
export function OrbitField({
  satellites,
  isCaught,
  onCatch,
  locked,
  showFinale,
  availability,
  labels,
  animate,
  className,
}: OrbitFieldProps) {
  const { containerRef } = useOrbits<HTMLDivElement>({
    orbits: ORBITS,
    docks: DOCKS,
    enabled: animate,
  })
  const caughtCount = satellites.filter((s) => isCaught(s.id)).length

  const counter = (
    <p className="font-mono text-[11px] uppercase tracking-[0.3em]">
      <span className={cn(locked ? "text-accent-soft" : "text-text/60")}>
        {locked
          ? labels.locked
          : `${labels.caught} ${pad(caughtCount)}/${pad(satellites.length)}`}
      </span>
      {!locked && animate && (
        <span className="mt-2 block text-text/50">{labels.hint}</span>
      )}
    </p>
  )

  if (!animate) {
    return (
      <div className={cn("space-y-10", className)}>
        {counter}
        <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {satellites.map((satellite, i) => (
            <div key={satellite.id} className="relative h-20">
              <SatelliteButton
                satellite={satellite}
                index={i}
                caught={isCaught(satellite.id)}
                animate={false}
                onCatch={onCatch}
              />
            </div>
          ))}
        </div>
        <div className="pt-6">
          <Finale visible availability={availability} floating={false} />
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-tilt
      className={cn(
        "absolute inset-0 [transform:perspective(1600px)_rotateX(calc(var(--tilt-y,0)*-7deg))_rotateY(calc(var(--tilt-x,0)*9deg))]",
        className
      )}
    >
      <div className="absolute inset-x-0 top-8 text-center">{counter}</div>

      {/* Orbit paths + lock lines, in the same stretched space as orbitPoint */}
      <svg
        aria-hidden="true"
        viewBox="-1 -1 2 2"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
      >
        {ORBITS.map((orbit, i) => (
          <ellipse
            key={i}
            cx={0}
            cy={0}
            rx={orbit.rx}
            ry={orbit.ry}
            transform={`rotate(${toDeg(orbit.tilt)})`}
            vectorEffect="non-scaling-stroke"
            strokeDasharray="2 7"
            className={cn(
              "fill-none stroke-accent-soft transition-opacity duration-1000",
              locked ? "opacity-0" : "opacity-25"
            )}
          />
        ))}
        {DOCKS.map((dock, i) => (
          <line
            key={i}
            x1={dock.x}
            y1={dock.y}
            x2={0}
            y2={0}
            pathLength={1}
            vectorEffect="non-scaling-stroke"
            className={cn(
              "stroke-accent-soft [stroke-dasharray:1] [stroke-width:1.5px] transition-[stroke-dashoffset] duration-[1400ms] ease-out",
              locked ? "[stroke-dashoffset:0]" : "[stroke-dashoffset:1]"
            )}
          />
        ))}
      </svg>

      <Finale visible={showFinale} availability={availability} floating />

      {satellites.map((satellite, i) => (
        <SatelliteButton
          key={satellite.id}
          satellite={satellite}
          index={i}
          caught={isCaught(satellite.id)}
          animate
          onCatch={onCatch}
        />
      ))}
    </div>
  )
}
