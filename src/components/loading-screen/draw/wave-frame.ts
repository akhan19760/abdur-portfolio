/**
 * Normal mode — two-pass neon rendering (diffuse glow + sharp core).
 *
 * Wave shape:
 *   `computeY` combines four frequency components where BOTH position (x) and
 *   time (frame counter) feed into the phase of each term. Each component drifts
 *   at a different speed and direction, so the wave's shape changes continuously
 *   rather than scrolling a static pattern. The total max excursion from centre
 *   is ±42 px (amplitude=1), well within the 140 px canvas height.
 *
 * Corrupted mode (heap_fragmentation event):
 *   VHS band displacement: canvas sliced into NUM_BANDS horizontal bands, each
 *   translated by a different random X offset this frame ("tape-head tear").
 *   RGB channel split: wave drawn 3× in red, green, blue with individual
 *   X-shifts — channels visibly fall apart.
 *   TV static: 3 000 random noise pixels scattered across the canvas.
 */
export function drawWaveFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  time: number,
  amplitude: number,
  corrupted: boolean
): void {
  ctx.clearRect(0, 0, width, height)
  const cy = height / 2

  // pos: maps canvas width to 12π → ~6 visible cycles → angular, high-density look.
  // t:   time multiplier 0.14 → violent, fast shape evolution at 60 fps.
  //
  // Near-harmonic frequencies (2.9, 5.1, 7.2 instead of exact 3, 5, 7) with
  // alternating drift directions prevent the components from locking together.
  // Their interaction produces ECG-like sharp spikes that appear and collapse
  // continuously. Max excursion: ±49 px — safely inside the 70 px half-height.
  const computeY = (x: number): number => {
    const pos = (x / width) * Math.PI * 12
    const t = time * 0.14
    return (
      cy +
      (Math.sin(pos + t) * 22 + // fundamental — rightward
        Math.sin(pos * 2.9 - t * 2.3) * 14 + // near-3rd harmonic — leftward
        Math.sin(pos * 5.1 + t * 3.9) * 8 + // near-5th harmonic — rightward
        Math.sin(pos * 7.2 - t * 5.7) * 5) * // near-7th harmonic — leftward
        amplitude
    )
  }

  if (corrupted) {
    const NUM_BANDS = 14
    const bandH = height / NUM_BANDS
    const bandOffsets = Array.from(
      { length: NUM_BANDS },
      () => (Math.random() - 0.5) * 200
    )

    const channels = [
      { color: "#ff1111", xShift: -16, alpha: 0.65 },
      { color: "#33ff33", xShift: 0, alpha: 0.18 },
      { color: "#1133ff", xShift: 16, alpha: 0.65 },
    ]

    for (const ch of channels) {
      for (let b = 0; b < NUM_BANDS; b++) {
        ctx.save()
        ctx.beginPath()
        ctx.rect(0, b * bandH, width, bandH + 1)
        ctx.clip()
        ctx.translate(bandOffsets[b] + ch.xShift, 0)
        ctx.beginPath()
        ctx.strokeStyle = ch.color
        ctx.shadowColor = ch.color
        ctx.shadowBlur = 12
        ctx.lineWidth = 2.5
        ctx.globalAlpha = ch.alpha
        for (let x = 0; x < width; x++) {
          const y = computeY(x)
          if (x === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        }
        ctx.stroke()
        ctx.restore()
      }
    }

    ctx.save()
    for (let i = 0; i < 3000; i++) {
      const nx = Math.random() * width
      const ny = Math.random() * height
      const v = Math.floor(Math.random() * 255)
      ctx.fillStyle =
        Math.random() > 0.65
          ? `rgba(255,${Math.floor(v * 0.3)},${Math.floor(v * 0.3)},0.85)`
          : `rgba(${v},${v},${v},0.45)`
      ctx.fillRect(nx, ny, 1 + Math.floor(Math.random() * 2), 1)
    }
    ctx.restore()
    return
  }

  // Pass 1 — diffuse glow
  ctx.save()
  ctx.beginPath()
  ctx.shadowBlur = 28
  ctx.shadowColor = "#9900fa"
  ctx.strokeStyle = "#9900fa"
  ctx.globalAlpha = 0.4
  ctx.lineWidth = 3
  for (let x = 0; x < width; x++) {
    const y = computeY(x)
    if (x === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
  ctx.restore()

  // Pass 2 — sharp core
  ctx.save()
  ctx.beginPath()
  ctx.shadowBlur = 8
  ctx.shadowColor = "#9900fa"
  ctx.strokeStyle = "#9900fa"
  ctx.globalAlpha = 0.9
  ctx.lineWidth = 1.5
  for (let x = 0; x < width; x++) {
    const y = computeY(x)
    if (x === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.stroke()
  ctx.restore()
}
