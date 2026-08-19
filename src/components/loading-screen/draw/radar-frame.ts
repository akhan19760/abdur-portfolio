import type { RadarBlip } from "@/types/loading-screen"

/**
 * Draws one frame of the surveillance radar: concentric rings, crosshairs,
 * a rotating sweep line with a fading angular trail, and occasional blips
 * that materialise in the sweep's wake and fade over time.
 */
export function drawRadarFrame(
  ctx: CanvasRenderingContext2D,
  size: number,
  angle: number,
  blips: RadarBlip[]
): void {
  ctx.clearRect(0, 0, size, size)
  const cx = size / 2
  const cy = size / 2
  const R = size * 0.43

  // Background fill
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(4, 0, 14, 0.88)"
  ctx.fill()
  ctx.restore()

  // Concentric rings
  for (let i = 1; i <= 3; i++) {
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, R * (i / 3), 0, Math.PI * 2)
    ctx.strokeStyle = "rgba(255, 133, 27, 0.12)"
    ctx.lineWidth = 0.8
    ctx.stroke()
    ctx.restore()
  }

  // Crosshair lines
  ctx.save()
  ctx.strokeStyle = "rgba(255, 133, 27, 0.1)"
  ctx.lineWidth = 0.5
  ctx.beginPath()
  ctx.moveTo(cx - R, cy)
  ctx.lineTo(cx + R, cy)
  ctx.moveTo(cx, cy - R)
  ctx.lineTo(cx, cy + R)
  ctx.stroke()
  ctx.restore()

  // Sweep trail: 14 lines at decreasing opacity behind current angle
  const TRAIL_STEPS = 14
  const TRAIL_SPAN = Math.PI * 0.5
  for (let i = TRAIL_STEPS; i > 0; i--) {
    const a = angle - (TRAIL_SPAN * (TRAIL_STEPS - i + 1)) / TRAIL_STEPS
    const alpha = (i / TRAIL_STEPS) * 0.32
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.strokeStyle = `rgba(255, 133, 27, ${alpha})`
    ctx.lineWidth = 0.7
    ctx.stroke()
    ctx.restore()
  }

  // Main sweep line
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(angle) * R, cy + Math.sin(angle) * R)
  ctx.strokeStyle = "rgba(255, 133, 27, 0.9)"
  ctx.shadowColor = "#ff851b"
  ctx.shadowBlur = 5
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()

  // Outer border
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.strokeStyle = "rgba(255, 133, 27, 0.35)"
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.restore()

  // Blips
  for (let i = blips.length - 1; i >= 0; i--) {
    const blip = blips[i]
    blip.alpha -= 0.006
    if (blip.alpha <= 0) {
      blips.splice(i, 1)
      continue
    }
    const bx = cx + Math.cos(blip.a) * blip.d * R
    const by = cy + Math.sin(blip.a) * blip.d * R
    ctx.save()
    ctx.beginPath()
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 150, 80, ${blip.alpha})`
    ctx.shadowColor = "#ff851b"
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.restore()
  }
}
