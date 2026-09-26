/**
 * SignalField — the shared backdrop behind every section.
 *
 * One fixed, full-viewport canvas that is the page's entire background: a
 * purple haze at the vanishing point and a field of particles with real depth.
 * Sections have no backgrounds or darkening overlays of their own, so the
 * Hero, About and everything after share exactly the same space and colour.
 *
 * - Travel: scrolling moves the camera forward (travelForScroll), with extra
 *   "warp" across the Hero → About handoff. Particles wrap from right in
 *   front of the camera back to the far end, so the tunnel never ends.
 * - Warp streaks: when the camera moves fast, particles are drawn as streaks.
 * - Light: particles are darkest far from the cursor light and brightest near
 *   it (the same falloff the Hero's old overlay had), with a soft glow and a
 *   gentle push away from the cursor.
 * - Pings: a click anywhere sends a sonar ring out from that point (emitted
 *   here, see lib/ping). The ring is drawn, it lights up the particles it
 *   passes, and it shoves them outward.
 * - Idle: the field creeps toward you and rolls slowly, even at rest.
 *
 * Reduced motion: drawn once, static and evenly lit; no pings.
 * Touch: fewer particles, evenly lit (no cursor light), pings on tap.
 * Decorative only (aria-hidden, no pointer events). Verified manually
 * in-browser (canvas animation, per the `testing` skill).
 */

import { useEffect, useRef } from "react"
import { canHover, prefersReducedMotion } from "@/lib/media"
import { PING_LIFE, createPingTracker, emitPing, pingLevel, pingRadius } from "@/lib/ping"
import { depthFade, project, travelForScroll, wrapDepth } from "./signal-field-utils"

const COUNT_POINTER = 650
const COUNT_TOUCH = 280
const DEPTH = 2400 // world units in one loop of the tunnel
const FOCAL = 520 // perspective focal length in px
const SPREAD = (DEPTH * 0.7) / FOCAL // world x/y range, in half-viewports
const IDLE_DRIFT = 0.35 // world units per frame the field creeps toward you at rest
const ROLL_SPEED = 0.00012 // rad per frame
const STREAK = 5 // streak length, in frames of camera travel
const STREAK_MIN_SPEED = 1.5 // world units per frame before streaks appear
const LIGHT_R = 850 // px — the light's reach; beyond it particles sit at MIN_LIGHT
const MIN_LIGHT = 0.15 // brightness far from the light
const GLOW_R = 250 // px — extra glow right around the cursor
const REPEL_R = 130 // px — cursor push radius
const REPEL_F = 2.2
const PING_SHOVE = 5 // outward kick from a passing ping
const OFFSET_SPRING = 0.06
const OFFSET_FRICTION = 0.86
const MAX_DPR = 1.5

type FieldParticle = {
  x: number // world x, in half-viewport units (scaled at draw time)
  y: number
  z: number
  size: number
  alpha: number
  ox: number // screen-space push offset (cursor, pings)
  oy: number
  vx: number
  vy: number
}

function buildParticles(count: number): FieldParticle[] {
  return Array.from({ length: count }, () => ({
    x: (Math.random() * 2 - 1) * SPREAD,
    y: (Math.random() * 2 - 1) * SPREAD,
    z: Math.random() * DEPTH,
    size: 0.7 + Math.random() * 0.9,
    alpha: 0.2 + Math.random() * 0.45,
    ox: 0,
    oy: 0,
    vx: 0,
    vy: 0,
  }))
}

function readCursor(): { x: number; y: number } | null {
  const style = document.documentElement.style
  const x = parseFloat(style.getPropertyValue("--cursor-x"))
  const y = parseFloat(style.getPropertyValue("--cursor-y"))
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
}

export function SignalField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const pointer = canHover()
    const still = prefersReducedMotion()
    const particles = buildParticles(pointer ? COUNT_POINTER : COUNT_TOUCH)
    const pings = createPingTracker()

    let w = 0
    let h = 0
    let rafId = 0
    let idle = 0
    let roll = 0
    let prevCamZ: number | null = null
    let speed = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawHaze = (cursor: { x: number; y: number } | null) => {
      const haze = ctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.55
      )
      haze.addColorStop(0, "rgba(153,0,250,0.11)")
      haze.addColorStop(1, "rgba(153,0,250,0)")
      ctx.fillStyle = haze
      ctx.fillRect(0, 0, w, h)

      if (cursor) {
        const glow = ctx.createRadialGradient(
          cursor.x,
          cursor.y,
          0,
          cursor.x,
          cursor.y,
          520
        )
        glow.addColorStop(0, "rgba(153,0,250,0.08)")
        glow.addColorStop(1, "rgba(153,0,250,0)")
        ctx.fillStyle = glow
        ctx.fillRect(0, 0, w, h)
      }
    }

    const draw = (now: number) => {
      const camZ = still ? 0 : travelForScroll(window.scrollY, h) + idle
      speed = prevCamZ === null ? 0 : speed * 0.8 + (camZ - prevCamZ) * 0.2
      prevCamZ = camZ

      const cursor = pointer && !still ? readCursor() : null
      const live = still ? [] : pings.active(now)
      const cx = w / 2
      const cy = h / 2
      const halfW = w / 2
      const halfH = h / 2
      const cos = Math.cos(roll)
      const sin = Math.sin(roll)
      const streaking = !still && Math.abs(speed) > STREAK_MIN_SPEED

      ctx.clearRect(0, 0, w, h)
      drawHaze(cursor)
      ctx.lineCap = "round"

      for (const p of particles) {
        const dz = wrapDepth(p.z, camZ, DEPTH)
        const fade = depthFade(dz, DEPTH)
        if (fade <= 0.01) continue

        // Gentle roll of the whole field around the view axis
        const wx = (p.x * cos - p.y * sin) * halfW
        const wy = (p.x * sin + p.y * cos) * halfH
        const { sx, sy, scale } = project(wx, wy, dz, FOCAL, cx, cy)

        // ── Light: cursor falloff, cursor glow, passing pings ─────────────
        let light = pointer && !still ? MIN_LIGHT : 0.6
        let glow = 0
        if (cursor) {
          const dx = sx + p.ox - cursor.x
          const dy = sy + p.oy - cursor.y
          const d = Math.hypot(dx, dy)
          light = 1 - (1 - MIN_LIGHT) * Math.min(d / LIGHT_R, 1)
          glow = Math.max(0, 1 - d / GLOW_R)
          if (d < REPEL_R && d > 0.01) {
            const f = ((REPEL_R - d) / REPEL_R) ** 2 * REPEL_F
            p.vx += (dx / d) * f
            p.vy += (dy / d) * f
          }
        }
        for (const ping of live) {
          const dx = sx - ping.x
          const dy = sy - ping.y
          const d = Math.hypot(dx, dy)
          const level = pingLevel(d, now - ping.time)
          if (level <= 0) continue
          light = Math.max(light, level)
          glow = Math.max(glow, level * 0.8)
          if (d > 0.01) {
            p.vx += (dx / d) * level * PING_SHOVE
            p.vy += (dy / d) * level * PING_SHOVE
          }
        }

        p.vx += -p.ox * OFFSET_SPRING
        p.vy += -p.oy * OFFSET_SPRING
        p.vx *= OFFSET_FRICTION
        p.vy *= OFFSET_FRICTION
        p.ox += p.vx
        p.oy += p.vy

        const x = sx + p.ox
        const y = sy + p.oy
        if (x < -40 || x > w + 40 || y < -40 || y > h + 40) continue

        const size = Math.min(4, Math.max(0.4, p.size * scale * 0.9)) * (1 + glow * 0.4)
        const alpha = Math.min(1, p.alpha * fade * light * (1 + glow * 1.4))
        if (alpha < 0.01) continue
        const color = `hsla(277,100%,${55 + glow * 30}%,${alpha.toFixed(3)})`

        if (streaking) {
          // Where this particle was STREAK frames ago (further away)
          const tail = project(wx, wy, dz + speed * STREAK, FOCAL, cx, cy)
          ctx.strokeStyle = color
          ctx.lineWidth = size
          ctx.beginPath()
          ctx.moveTo(tail.sx + p.ox, tail.sy + p.oy)
          ctx.lineTo(x, y)
          ctx.stroke()
        } else {
          ctx.fillStyle = color
          ctx.beginPath()
          ctx.arc(x, y, size, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // ── Ping rings ───────────────────────────────────────────────────────
      for (const ping of live) {
        const age = now - ping.time
        const life = 1 - age / PING_LIFE
        const r = pingRadius(age)
        ctx.lineWidth = 1.5
        ctx.strokeStyle = `hsla(277,100%,72%,${(life * 0.55).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(ping.x, ping.y, r, 0, Math.PI * 2)
        ctx.stroke()
        ctx.lineWidth = 14
        ctx.strokeStyle = `hsla(277,100%,60%,${(life * 0.08).toFixed(3)})`
        ctx.beginPath()
        ctx.arc(ping.x, ping.y, r * 0.96, 0, Math.PI * 2)
        ctx.stroke()
      }
    }

    const tick = (now: number) => {
      idle += IDLE_DRIFT
      roll += ROLL_SPEED
      draw(now)
      rafId = requestAnimationFrame(tick)
    }

    resize()
    if (still) {
      draw(performance.now())
      const onResize = () => {
        resize()
        draw(performance.now())
      }
      window.addEventListener("resize", onResize)
      return () => {
        pings.dispose()
        window.removeEventListener("resize", onResize)
      }
    }

    // Any primary press anywhere sends a ping (capture: fires even if a
    // component stops propagation).
    const onPointerDown = (e: PointerEvent) => {
      if (e.button === 0) emitPing(e.clientX, e.clientY)
    }

    window.addEventListener("resize", resize)
    window.addEventListener("pointerdown", onPointerDown, { capture: true })
    rafId = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafId)
      pings.dispose()
      window.removeEventListener("resize", resize)
      window.removeEventListener("pointerdown", onPointerDown, { capture: true })
    }
  }, [])

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
      <canvas ref={canvasRef} data-testid="signal-field" className="h-full w-full" />
    </div>
  )
}
