import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"
import { useLightLens } from "@/hooks/cursor"
import { useScramble } from "@/hooks/about"
import type { CaseFile } from "@/types/about"

type CaseFilesLabels = {
  file: string
  classified: string
  decrypted: string
  /** Instruction on an encrypted card, e.g. "Hold your light to decrypt". */
  hold: string
  decryptAll: string
  /** Progress line, e.g. "DECRYPTED 01/03". */
  count: (done: number, total: number) => string
  complete: string
}

type CaseFilesProps = {
  files: CaseFile[]
  isDecrypted: (id: string) => boolean
  onDecrypt: (id: string) => void
  onDecryptAll: () => void
  allDecrypted: boolean
  labels: CaseFilesLabels
  /** Depth mode: a 3D carousel. Otherwise a flat grid. */
  depth: boolean
  className?: string
}

const CAROUSEL_STEP = 32 // deg between cards around the carousel

// The x-ray peek: a soft 90px circle at the light, in the element's own
// coordinates (--lens-x/y from useLightLens).
const LENS_PEEK =
  "[mask-image:radial-gradient(circle_90px_at_var(--lens-x,-9999px)_var(--lens-y,-9999px),#000_55%,transparent_100%)]"

// Iridescent foil that slides with the carousel's tilt.
const HOLO_FOIL = cn(
  "pointer-events-none absolute inset-0 mix-blend-screen",
  "bg-[linear-gradient(115deg,transparent_25%,rgba(192,132,252,0.35)_42%,rgba(255,255,255,0.22)_50%,rgba(125,211,252,0.25)_58%,transparent_75%)]",
  "bg-[length:260%_260%] [background-position:calc(50%_+_var(--tilt-x,0)*55%)_calc(50%_+_var(--tilt-y,0)*55%)]",
  "opacity-[calc(0.3_+_var(--light,0)_*_0.5)]"
)

type CardProps = {
  file: CaseFile
  decrypted: boolean
  onDecrypt: (id: string) => void
  labels: CaseFilesLabels
  depth: boolean
  angle: number
}

function Card({ file, decrypted, onDecrypt, labels, depth, angle }: CardProps) {
  // Noise for the encrypted face: the entry itself, run together and repeated
  const noise = `${file.org}${file.role}${file.period}`.replace(/\s+/g, "").repeat(7)

  return (
    <button
      type="button"
      data-light
      data-line-id={file.id}
      data-charge={decrypted ? undefined : ""}
      data-decrypted={decrypted ? "" : undefined}
      aria-label={`${file.group}: ${file.role}, ${file.org}, ${file.period}`}
      onClick={() => onDecrypt(file.id)}
      onFocus={() => onDecrypt(file.id)}
      className={cn(
        "rounded-xl [transform-style:preserve-3d]",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent",
        depth
          ? cn(
              "absolute left-1/2 top-1/2 h-[min(54vh,470px)] aspect-[3/4]",
              "[transform:translate(-50%,-50%)_rotateY(var(--a))_translateZ(calc(var(--r)_+_var(--light,0)*70px))]",
              "transition-transform duration-300 ease-out"
            )
          : "relative aspect-[3/4] w-full"
      )}
      // Each card's place around the carousel — derived from its index
      style={depth ? ({ "--a": `${angle}deg` } as CSSProperties) : undefined}
    >
      <span
        className={cn(
          "absolute inset-0 block [transform-style:preserve-3d]",
          "transition-transform duration-[1100ms] ease-[cubic-bezier(0.2,1.35,0.3,1)]",
          decrypted
            ? "[transform:rotateY(180deg)]"
            : "[transform:rotateY(calc(var(--charge,0)*-18deg))]"
        )}
      >
        {/* ── Front: encrypted ──────────────────────────────────────────── */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-accent/40 bg-[#0c0714]/95 p-5 text-left font-mono [backface-visibility:hidden]"
        >
          <span className="flex justify-between text-[10px] tracking-[0.3em]">
            <span className="text-accent-soft">
              {labels.file} · {file.code}
            </span>
            <span className="text-text/60">{labels.classified}</span>
          </span>

          <span className="relative mt-4 block flex-1 overflow-hidden">
            <span
              data-scramble={noise}
              className="block break-all text-[12px] leading-[1.45] text-accent-soft/60"
            />
            {/* X-ray peek: the real entry shows through under the light */}
            <span
              data-lens
              className={cn(
                "absolute inset-0 flex flex-col justify-center bg-[#0c0714]/90 px-1",
                LENS_PEEK
              )}
            >
              <span className="font-display text-3xl leading-tight text-text font-stretch-semi-condensed">
                {file.role}
              </span>
              <span className="mt-2 text-sm text-accent-soft">{file.org}</span>
            </span>
          </span>

          {/* Scan beam while the light is on the card */}
          <span className="pointer-events-none absolute inset-x-0 block h-20 animate-scan-beam bg-gradient-to-b from-transparent via-accent/40 to-transparent opacity-[var(--light,0)]" />

          <span className="mt-4 block">
            <span className="block font-support text-[10px] uppercase tracking-[0.3em] text-text/70">
              {labels.hold}
            </span>
            <span className="mt-2 block h-1 overflow-hidden rounded-full bg-accent/20">
              <span className="block h-full w-[calc(var(--charge,0)*100%)] rounded-full bg-accent-soft shadow-[0_0_10px_var(--color-accent)]" />
            </span>
          </span>
          <span className={HOLO_FOIL} />
        </span>

        {/* ── Back: decrypted ───────────────────────────────────────────── */}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex flex-col overflow-hidden rounded-xl border border-accent/70 bg-[radial-gradient(120%_80%_at_50%_0%,rgba(153,0,250,0.32),rgba(12,7,20,0.96)_62%)] p-6 text-left [backface-visibility:hidden] [transform:rotateY(180deg)] shadow-[0_0_60px_var(--color-accent-muted)]"
        >
          <span className="flex justify-between font-mono text-[10px] uppercase tracking-[0.3em]">
            <span className="text-accent-soft">{file.group}</span>
            <span className="text-text/75">{labels.decrypted} ✓</span>
          </span>
          <span className="mt-auto block">
            <span className="block font-mono text-[11px] tracking-[0.25em] text-text/70">
              {file.period}
            </span>
            <span className="mt-3 block font-display text-[clamp(1.8rem,2.4vw,2.7rem)] leading-[1.05] text-text font-stretch-semi-condensed">
              {file.role}
            </span>
            <span className="mt-3 block font-mono text-sm text-accent-soft">
              {file.org}
            </span>
          </span>
          <span className={HOLO_FOIL} />
          {decrypted && (
            <span className="pointer-events-none absolute inset-0 animate-card-flash bg-white/70" />
          )}
        </span>
      </span>
    </button>
  )
}

/**
 * The Field log layer: case files on a holographic carousel.
 *
 * Each entry is a card hanging on a 3D carousel that swings with the cursor.
 * Encrypted, its face is a wall of live-scrambling glyphs with iridescent
 * foil; under the light the real entry shows through like an x-ray. Hold the
 * light on a card and it scans (the section's charge hook fills `--charge`,
 * the card starts to turn) until it flips over — with a flash — to the
 * decrypted file.
 *
 * Accessibility: cards are buttons named with the full entry, so screen
 * readers get everything without decrypting; click or keyboard focus flips a
 * card at once, and "Decrypt all" flips every card. On touch the section
 * starts with everything decrypted.
 */
export function CaseFiles({
  files,
  isDecrypted,
  onDecrypt,
  onDecryptAll,
  allDecrypted,
  labels,
  depth,
  className,
}: CaseFilesProps) {
  const { containerRef: lensRef } = useLightLens<HTMLDivElement>()
  const { containerRef: scrambleRef } = useScramble<HTMLDivElement>({
    active: !allDecrypted,
  })
  const done = files.filter((f) => isDecrypted(f.id)).length
  const mid = (files.length - 1) / 2

  return (
    <div
      ref={lensRef}
      className={cn(
        depth ? "absolute inset-0 flex flex-col items-center justify-center" : "relative",
        className
      )}
    >
      <p
        className={cn(
          "font-mono text-[11px] uppercase tracking-[0.3em]",
          depth ? "absolute inset-x-0 top-8 text-center" : "mb-8",
          allDecrypted ? "text-accent-soft" : "text-text/60"
        )}
      >
        {allDecrypted ? labels.complete : labels.count(done, files.length)}
      </p>

      <div
        ref={scrambleRef}
        data-tilt
        className={cn(
          depth
            ? "relative h-[62vh] w-full [perspective:1700px]"
            : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        )}
      >
        {depth ? (
          <div className="absolute inset-0 [--r:950px] [transform-style:preserve-3d] [transform:translateZ(calc(var(--r)*-1))_rotateY(calc(var(--tilt-x,0)*-16deg))_rotateX(calc(var(--tilt-y,0)*6deg))]">
            {files.map((file, i) => (
              <Card
                key={file.id}
                file={file}
                decrypted={isDecrypted(file.id)}
                onDecrypt={onDecrypt}
                labels={labels}
                depth
                angle={(i - mid) * CAROUSEL_STEP}
              />
            ))}
          </div>
        ) : (
          files.map((file) => (
            <div key={file.id} className="[perspective:1200px]">
              <Card
                file={file}
                decrypted={isDecrypted(file.id)}
                onDecrypt={onDecrypt}
                labels={labels}
                depth={false}
                angle={0}
              />
            </div>
          ))
        )}
      </div>

      {!allDecrypted && (
        <div className={cn(depth ? "absolute inset-x-0 bottom-6 text-center" : "mt-8")}>
          <button
            type="button"
            onClick={onDecryptAll}
            className={cn(
              "border border-accent/40 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.25em] text-accent-soft",
              "transition-colors duration-300 hover:border-accent hover:bg-accent/15",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            )}
          >
            {labels.decryptAll}
          </button>
        </div>
      )}
    </div>
  )
}
