/**
 * AboutFx — the About section's light-drawing layer.
 *
 * One transparent 2D canvas over the stage (above the 3D core, below the
 * layers) that draws everything that has to connect DOM elements living in
 * 3D-transformed layers. It reads their on-screen positions every frame, so
 * lines stay attached however the layers fly, roll and tilt:
 *
 * - Origin: each stroke of the `</>` glyph draws itself in once both of its
 *   stars are traced; dashed story jumps join the strokes while tracing; once
 *   complete, a pulse of light races along the whole glyph. A faint guide line
 *   reaches from the light to the nearest untraced star.
 * - Status: loose satellites leave fading light trails; any satellite under
 *   the light gets a tractor beam from the cursor that thickens as it charges.
 * - Sparks: a burst of glowing particles wherever something was just
 *   discovered (lib/sparks).
 *
 * Everything fades with its layer's opacity. Depth mode only; decorative
 * (aria-hidden). Verified manually in-browser (canvas animation).
 */

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { onSparks } from "@/lib/sparks"
import { GLYPH_EDGES, STORY_LINKS } from "./about-shared"

type AboutFxProps = {
  /** False while About isn't showing yet (e.g. under the Hero): nothing is drawn. */
  active?: boolean
  className?: string
}

type Point = { x: number; y: number }

type Spark = Point & { vx: number; vy: number; born: number; life: number; size: number }

const EDGE_DRAW_MS = 800 // time for a stroke to draw itself in
const PULSE_SPEED = 0.45 // px per ms for the light racing along a complete glyph
const GUIDE_R = 320 // px — guide line to the nearest untraced star
const TRAIL_LENGTH = 26 // positions kept per satellite trail
const MAX_DPR = 1.5

const easeOut = (t: number) => 1 - (1 - t) ** 3

function layerAlpha(el: Element): number {
  const layer = el.closest<HTMLElement>("[data-depth-layer]")
  if (!layer) return 1
  const opacity = parseFloat(layer.style.opacity)
  return Number.isFinite(opacity) ? opacity : 1
}

export function AboutFx({ active = true, className }: AboutFxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    const stage = canvas?.parentElement
    if (!canvas || !ctx || !stage) return
    if (!active) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }

    let rafId = 0
    let w = 0
    let h = 0
    let visible = typeof IntersectionObserver === "undefined"
    const edgeStart = new Map<string, number>()
    const trails = new Map<string, Point[]>()
    let sparks: Spark[] = []

    const offSparks = onSparks((burst) => {
      const base = canvas.getBoundingClientRect()
      for (let i = 0; i < burst.count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 1.5 + Math.random() * 5
        sparks.push({
          x: burst.x - base.left,
          y: burst.y - base.top,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          born: burst.time,
          life: 500 + Math.random() * 600,
          size: 1 + Math.random() * 2,
        })
      }
    })

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const centre = (el: Element, base: DOMRect): Point => {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2 - base.left, y: r.top + r.height / 2 - base.top }
    }

    const glowLine = (a: Point, b: Point, width: number, alpha: number) => {
      ctx.save()
      ctx.globalAlpha = alpha
      ctx.shadowColor = "rgba(153,0,250,0.9)"
      ctx.shadowBlur = 14
      ctx.strokeStyle = "rgba(233,213,255,0.95)"
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.restore()
    }

    const drawConstellation = (now: number, base: DOMRect, cursor: Point | null) => {
      const stars = Array.from(stage.querySelectorAll<HTMLElement>("[data-star-id]"))
      if (stars.length === 0) return
      const alpha = layerAlpha(stars[0])
      if (alpha < 0.02) return

      const pts = stars.map((s) => centre(s, base))
      const traced = stars.map((s) => s.hasAttribute("data-traced"))
      const complete = traced.every(Boolean)

      // Dashed story jumps between strokes (only while tracing)
      if (!complete) {
        ctx.save()
        ctx.globalAlpha = alpha * 0.45
        ctx.setLineDash([4, 8])
        ctx.strokeStyle = "rgba(192,132,252,0.9)"
        ctx.lineWidth = 1
        for (const [a, b] of STORY_LINKS) {
          if (!traced[a] || !traced[b] || !pts[a] || !pts[b]) continue
          ctx.beginPath()
          ctx.moveTo(pts[a].x, pts[a].y)
          ctx.lineTo(pts[b].x, pts[b].y)
          ctx.stroke()
        }
        ctx.restore()
      }

      // Glyph strokes, drawing themselves in
      for (const [a, b] of GLYPH_EDGES) {
        const key = `${a}-${b}`
        if (!traced[a] || !traced[b] || !pts[a] || !pts[b]) {
          edgeStart.delete(key)
          continue
        }
        if (!edgeStart.has(key)) edgeStart.set(key, now)
        const p = easeOut(Math.min(1, (now - (edgeStart.get(key) ?? now)) / EDGE_DRAW_MS))
        const end = {
          x: pts[a].x + (pts[b].x - pts[a].x) * p,
          y: pts[a].y + (pts[b].y - pts[a].y) * p,
        }
        glowLine(pts[a], end, complete ? 2.4 : 1.5, alpha)
      }

      // A pulse of light racing through the finished glyph, in story order
      if (complete && pts.length > 1) {
        const lengths = pts
          .slice(1)
          .map((p, i) => Math.hypot(p.x - pts[i].x, p.y - pts[i].y))
        const total = lengths.reduce((sum, l) => sum + l, 0)
        const trail = 10
        for (let k = 0; k < trail; k++) {
          let d = (now * PULSE_SPEED - k * 9) % total
          if (d < 0) d += total
          let i = 0
          while (i < lengths.length - 1 && d > lengths[i]) d -= lengths[i++]
          const t = lengths[i] ? d / lengths[i] : 0
          const x = pts[i].x + (pts[i + 1].x - pts[i].x) * t
          const y = pts[i].y + (pts[i + 1].y - pts[i].y) * t
          ctx.save()
          ctx.globalAlpha = alpha * (1 - k / trail)
          ctx.shadowColor = "rgba(153,0,250,1)"
          ctx.shadowBlur = 18
          ctx.fillStyle = "#ffffff"
          ctx.beginPath()
          ctx.arc(x, y, 3.2 - k * 0.25, 0, Math.PI * 2)
          ctx.fill()
          ctx.restore()
        }
      }

      // Guide line from the light to the nearest untraced star
      if (cursor && alpha > 0.5 && !complete) {
        let best: Point | null = null
        let bestD = GUIDE_R
        pts.forEach((p, i) => {
          if (traced[i]) return
          const d = Math.hypot(p.x - cursor.x, p.y - cursor.y)
          if (d < bestD) {
            bestD = d
            best = p
          }
        })
        if (best) {
          const target: Point = best
          ctx.save()
          ctx.globalAlpha = alpha * (1 - bestD / GUIDE_R) * 0.7
          ctx.setLineDash([2, 6])
          ctx.strokeStyle = "rgba(233,213,255,0.9)"
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(cursor.x, cursor.y)
          ctx.lineTo(target.x, target.y)
          ctx.stroke()
          ctx.restore()
        }
      }
    }

    const drawSatellites = (base: DOMRect, cursor: Point | null) => {
      const sats = Array.from(
        stage.querySelectorAll<HTMLElement>("[data-satellite-id][data-orbit-index]")
      )
      if (sats.length === 0) return
      const alpha = layerAlpha(sats[0])

      for (const sat of sats) {
        const id = sat.dataset.satelliteId ?? ""
        const p = centre(sat, base)
        if (sat.hasAttribute("data-caught") || alpha < 0.02) {
          trails.delete(id)
          continue
        }
        const trail = trails.get(id) ?? []
        trail.push(p)
        if (trail.length > TRAIL_LENGTH) trail.shift()
        trails.set(id, trail)

        ctx.save()
        ctx.lineCap = "round"
        for (let i = 1; i < trail.length; i++) {
          const f = i / trail.length
          ctx.strokeStyle = `rgba(192,132,252,${(f * 0.55 * alpha).toFixed(3)})`
          ctx.lineWidth = 0.5 + f * 2.5
          ctx.beginPath()
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y)
          ctx.lineTo(trail[i].x, trail[i].y)
          ctx.stroke()
        }
        ctx.restore()

        // Tractor beam while the light holds this satellite
        const light = parseFloat(sat.style.getPropertyValue("--light")) || 0
        if (cursor && light > 0.3 && alpha > 0.5) {
          const charge = parseFloat(sat.style.getPropertyValue("--charge")) || 0
          const gradient = ctx.createLinearGradient(cursor.x, cursor.y, p.x, p.y)
          gradient.addColorStop(0, "rgba(153,0,250,0)")
          gradient.addColorStop(1, "rgba(233,213,255,0.95)")
          ctx.save()
          ctx.globalAlpha = alpha * Math.min(1, light)
          ctx.shadowColor = "rgba(153,0,250,1)"
          ctx.shadowBlur = 16
          ctx.strokeStyle = gradient
          ctx.lineWidth = 1 + charge * 4
          ctx.beginPath()
          ctx.moveTo(cursor.x, cursor.y)
          ctx.lineTo(p.x, p.y)
          ctx.stroke()
          ctx.restore()
        }
      }
    }

    const drawSparks = (now: number) => {
      sparks = sparks.filter((s) => now - s.born < s.life)
      if (sparks.length === 0) return
      ctx.save()
      ctx.shadowColor = "rgba(153,0,250,1)"
      ctx.shadowBlur = 10
      for (const s of sparks) {
        s.x += s.vx
        s.y += s.vy
        s.vx *= 0.94
        s.vy *= 0.94
        const life = 1 - (now - s.born) / s.life
        ctx.globalAlpha = life
        ctx.fillStyle = life > 0.6 ? "#ffffff" : "#e9d5ff"
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * life + 0.3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    const tick = (now: number) => {
      rafId = 0
      if (!visible) return
      if (canvas.clientWidth !== w || canvas.clientHeight !== h) resize()
      ctx.clearRect(0, 0, w, h)

      const base = canvas.getBoundingClientRect()
      const style = document.documentElement.style
      const cx = parseFloat(style.getPropertyValue("--cursor-x"))
      const cy = parseFloat(style.getPropertyValue("--cursor-y"))
      const cursor =
        Number.isFinite(cx) && Number.isFinite(cy)
          ? { x: cx - base.left, y: cy - base.top }
          : null

      drawConstellation(now, base, cursor)
      drawSatellites(base, cursor)
      drawSparks(now)

      rafId = requestAnimationFrame(tick)
    }

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible && !rafId) rafId = requestAnimationFrame(tick)
          })

    observer?.observe(canvas)
    if (visible) rafId = requestAnimationFrame(tick)

    return () => {
      offSparks()
      observer?.disconnect()
      cancelAnimationFrame(rafId)
    }
  }, [active])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-testid="about-fx"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    />
  )
}
