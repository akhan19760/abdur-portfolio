/**
 * Normal mode — two-pass neon rendering (diffuse glow + sharp core).
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
  offset: number,
  amplitude: number,
  corrupted: boolean
): void {
  ctx.clearRect(0, 0, width, height)
  const cy = height / 2

  const computeY = (x: number): number => {
    const t = (x + offset) * 0.018
    return (
      cy +
      (Math.sin(t) * 22 +
        Math.sin(t * 2.5) * 9 +
        Math.sin(t * 5.3) * 3 +
        Math.cos(t * 3.8) * 5) *
        amplitude
    )
  }

  if (corrupted) {
    const NUM_BANDS = 14
    const bandH = height / NUM_BANDS
    const bandOffsets = Array.from({ length: NUM_BANDS }, () =>
      (Math.random() - 0.5) * 200
    )

    const channels = [
      { color: "#ff1111", xShift: -16, alpha: 0.65 },
      { color: "#33ff33", xShift: 0,   alpha: 0.18 },
      { color: "#1133ff", xShift: 16,  alpha: 0.65 },
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
  ctx.shadowColor = "#ff851b"
  ctx.strokeStyle = "#ff851b"
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
  ctx.shadowColor = "#ff851b"
  ctx.strokeStyle = "#ff851b"
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
