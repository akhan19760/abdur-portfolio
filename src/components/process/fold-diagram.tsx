import { cn } from "@/lib/utils"

type FoldDiagramProps = {
  /** Which step it shows: 0 Discover … 4 Launch. */
  stage: number
  className?: string
}

// The sheet is A4 in millimetres: 210 × 297, nose edge at the top.
const SHEET = "M0.5 0.5H209.5V296.5H0.5Z"
/** Every crease of the dart, as it falls on the flat sheet (see paper-fold). */
const CREASES = [
  "M105 0V297", // folded in half
  "M105 0L0 105M105 0L210 105", // corners to the centre
  "M105 0L0 253.5M105 0L210 253.5", // edges to the centre
  "M105 0L0 43.5M105 0L210 43.5", // …through the corner flaps
  "M73 77V297M137 77V297", // the wings
]
const DART_TOP = "M105 0L0 253.5V296.5H210V253.5Z" // folded to a point, still flat
const PLANE = "M105 8L28 286L105 272L182 286Z" // the finished plane from above

/**
 * The paper at each step, as a small line drawing: the flat version's stand-in
 * for the 3D paper (touch, reduced motion, narrow screens). Decorative: the
 * step's own text says what happens, so it's hidden from assistive tech.
 */
export function FoldDiagram({ stage, className }: FoldDiagramProps) {
  const line =
    "fill-none stroke-text/40 [stroke-width:2.5] [vector-effect:non-scaling-stroke]"
  const fold =
    "fill-none stroke-accent-soft [stroke-dasharray:6_5] [stroke-width:1.5] [vector-effect:non-scaling-stroke]"

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="-8 -8 226 313"
      data-stage={stage}
      className={cn("h-auto w-28 shrink-0", className)}
    >
      {stage === 0 && (
        <>
          <path d={SHEET} className={line} />
          {/* Pencil notes and a rough sketch of a page */}
          <path
            d="M24 40H92M24 70H120M30 160H96M28 210H104M26 250H118M120 36H186V100H120ZM128 50H178M130 62H164"
            className="fill-none stroke-text/25 [stroke-width:1.5] [vector-effect:non-scaling-stroke]"
          />
        </>
      )}
      {stage === 1 && (
        <>
          <path d={SHEET} className={line} />
          <path d={CREASES.join("")} className={fold} />
        </>
      )}
      {stage === 2 && (
        <>
          <path d={DART_TOP} className={line} />
          <path d="M105 0V296.5M105 0L52 128M105 0L158 128" className={fold} />
        </>
      )}
      {stage === 3 && (
        <>
          <path d={PLANE} className={line} />
          <path d="M105 8V280M105 8L92 276M105 8L118 276" className={fold} />
        </>
      )}
      {stage >= 4 && (
        <>
          <path d="M18 292C50 230 70 190 118 150" className={fold} />
          <g transform="translate(128 12) rotate(38) scale(0.46)">
            <path d={PLANE} className={line} />
          </g>
        </>
      )}
    </svg>
  )
}
