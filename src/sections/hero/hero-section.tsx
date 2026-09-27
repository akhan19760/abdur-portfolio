/**
 * Hero section — Particle Assembly + Magnetic Letter Groups + Atmosphere
 *
 * "ABDUR KHAN" is sampled letter by letter onto an offscreen canvas. Each lit
 * pixel becomes a particle with a `groupIndex` identifying its parent letter.
 *
 * On mount, particles start scattered and spring toward their home positions,
 * assembling the name from chaos (Variant A's visual reveal).
 *
 * When the cursor enters a letter's radius, the ENTIRE letter group's offset is
 * driven by spring physics — the block moves as a cohesive unit, not as loose
 * individuals (Variant B's magnetic-letter feel).
 *
 * Additional atmosphere:
 * - The background (drifting particles, purple haze, darkness away from the
 *   light) is the shared SignalField behind every section, so the Hero and
 *   About have exactly the same backdrop
 * - The name and floating logos are masked by the cursor light: full strength
 *   near it, dim far from it (mouse devices only)
 * - Constellation connections: faint lines drawn between close letter particles
 *   near the cursor, forming a glowing web effect wherever the cursor hovers
 * - Pings: a click anywhere (lib/ping) jolts nearby letters away from it
 * - Corner accent marks (CSS) frame the hero
 *
 * Exit — flying through the name:
 * As the Hero scrolls away, the name stays where it is and breaks apart
 * toward the camera: each particle is projected closer by its own depth,
 * pushed away from the viewport centre, and drawn as a streak, so you fly
 * through the letters into About (which overlaps the Hero's last screen and
 * brings its first layer in through the debris). The HTML content fades and
 * the floating logos scale past the camera via the --hero-exit variable.
 * The canvas and the logo layer are fixed to the viewport so nothing flying
 * past is cut off at the section edge. Reduced motion: no explosion, the name
 * just scrolls away and fades.
 *
 * Arrival — round the loop from Contact:
 * The page loops (lib/page-loop): past Contact the camera flies through the
 * pin wall, and the name comes toward you out of the dark, each particle
 * starting far off and small near the middle of the view (deeper ones
 * arriving last) until it's back in place and the scroll wraps to the top.
 * The logos fade in and grow into place with it. The frame where it
 * arrives is exactly this Hero at rest, so the wrap doesn't show.
 *
 * Layers back → front (all above the page-level SignalField):
 *   1. Canvas (fixed to the viewport) — letter particles + connections
 *   2. Corner accents + floating logos (fixed to the viewport)
 *   3. Content (z-10) — role label, tagline, CTA as HTML
 *
 * All animation is RAF + canvas 2D — no GSAP, no external libs.
 * Manually verified in-browser per the `testing` skill (animation / canvas code).
 */

import { useCallback, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { HERO_FRAME, HeroContent } from "@/components/hero"
import { prefersReducedMotion } from "@/lib/media"
import { heroFontSize } from "@/lib/hero-name"
import { loopArrival } from "@/lib/page-loop"
import { onPing } from "@/lib/ping"
import { FloatingTags } from "./floating-tags"

// ── Letter particle physics ───────────────────────────────────────────────────
const PARTICLE_SPRING = 0.065 // spring toward (home + groupOffset) — soft, A-like
const PARTICLE_FRICTION = 0.88

// ── Letter-group physics (B-like) ─────────────────────────────────────────────
const GROUP_REPEL_R = 210 // px — cursor influence range per letter group
const GROUP_MAX_OFFSET = 80 // px — max letter block displacement
const GROUP_SPRING = 0.12 // snappy return spring
const GROUP_FRICTION = 0.72

// ── Pings (click anywhere) ────────────────────────────────────────────────────
const PING_JOLT_R = 420 // px — letters within this range get knocked
const PING_JOLT_F = 26 // px/frame — kick for a letter right at the ping

// ── Exit (fly through the name) ─────────────────────────────────────────────
const EXIT_END = 0.7 // fraction of the Hero scrolled away when the name is gone
const EXIT_MAX_Z = 0.96 // how close to the camera the deepest particles get
const EXIT_SCATTER = 180 // px — sideways drift so letters don't just scale up
const EXIT_STREAK_MIN = 3 // px moved per frame before a particle becomes a streak

// ── Arrival (round the loop from Contact) ───────────────────────────────────
const ARRIVE_FROM = 20 // the name starts this many times further off than where it lands
const ARRIVE_SPREAD = 0.8 // the deepest particles are this much further off again

// ── Constellation connections ─────────────────────────────────────────────────
const CONN_CURSOR_R = 210 // px — look for connections within this cursor radius
const CONN_MAX_DIST = 70 // px — max inter-particle distance for a connection line
const CONN_LOOKAHEAD = 18 // array neighbours to check (spatial locality shortcut)

const WORDS = ["ABDUR", "KHAN"] as const

// ── Types ─────────────────────────────────────────────────────────────────────
type Particle = {
  homeX: number
  homeY: number
  x: number
  y: number
  vx: number
  vy: number
  groupIndex: number
  size: number
  alpha: number
  depth: number // 0.5–1 — how fast this particle flies at you on exit
  scatterX: number // unit direction of its sideways drift on exit
  scatterY: number
  lastX: number // last drawn position, for exit streaks
  lastY: number
}

type LetterGroup = {
  centerX: number // geometric centre of all particles in this letter (rest)
  centerY: number
  offsetX: number // current magnetic displacement
  offsetY: number
  vx: number // velocity of the group offset
  vy: number
}

// The cursor light on the name and logos: full strength at the light, fading
// to 15% by 900px away — the falloff the Hero's old dark overlay had, applied
// to these layers only so the shared backdrop behind them stays untouched.
// Viewport coordinates work because both layers are fixed to the viewport.
// Mouse devices only; on touch they show at full strength.
const CURSOR_LIGHT_MASK =
  "pointer-fine:[mask-image:radial-gradient(circle_900px_at_var(--cursor-x,50%)_var(--cursor-y,50%),#000_0%,rgba(0,0,0,0.15)_100%)]"

type HeroSectionProps = {
  /**
   * Seconds before the particle animation starts.
   * Defaults to 4.2 s to clear the loading screen.
   * Pass 0 in tests / isolation.
   */
  revealDelay?: number
}

export function HeroSection({ revealDelay = 4.2 }: HeroSectionProps) {
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const logosRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const groupsRef = useRef<LetterGroup[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 }) // viewport coordinates
  const sizeRef = useRef({ w: 0, h: 0 })

  // ── Build particles from offscreen text ────────────────────────────────────
  const buildParticles = useCallback((w: number, h: number, centreY: number) => {
    const off = document.createElement("canvas")
    off.width = w
    off.height = h
    const octx = off.getContext("2d")!

    const fontSize = heroFontSize(w, h)
    // Adaptive gap — denser on small screens so letters form clearly
    const gap = Math.max(3, Math.round(fontSize / 38))
    // Dots scale with the gap, so small names stay dotted instead of solid
    const dot = Math.min(1.4, gap * 0.28)

    octx.font = `400 ${fontSize}px "Kiloy", Georgia, serif`
    octx.textAlign = "left"
    octx.textBaseline = "alphabetic"
    octx.fillStyle = "white"

    // Baselines 1.45 × fontSize apart around centreY
    const lineY = [
      centreY - fontSize * 0.66, // ABDUR baseline — above centre
      centreY + fontSize * 0.79, // KHAN baseline  — below centre
    ]

    const particles: Particle[] = []
    const groups: LetterGroup[] = []
    const acc: { sumX: number; sumY: number; n: number }[] = []

    let globalGi = 0 // global letter index across all words

    for (let wi = 0; wi < WORDS.length; wi++) {
      const word = WORDS[wi]
      const wordWidth = octx.measureText(word).width
      const startX = w / 2 - wordWidth / 2
      const y = lineY[wi]

      // Per-letter x-bounds for this word
      const bounds: { x0: number; x1: number; gi: number }[] = []
      let cx = startX
      for (let li = 0; li < word.length; li++) {
        const lw = octx.measureText(word[li]).width
        bounds.push({ x0: cx, x1: cx + lw, gi: globalGi + li })
        cx += lw
        groups.push({ centerX: 0, centerY: 0, offsetX: 0, offsetY: 0, vx: 0, vy: 0 })
        acc.push({ sumX: 0, sumY: 0, n: 0 })
      }
      globalGi += word.length

      // Draw only this word, then sample its pixels
      octx.clearRect(0, 0, w, h)
      octx.fillText(word, startX, y)

      const sX0 = Math.max(0, Math.floor(startX) - 6)
      const sY0 = Math.max(0, Math.floor(y - fontSize * 1.1) - 6)
      const sX1 = Math.min(w, Math.ceil(startX + wordWidth) + 6)
      const sY1 = Math.min(h, Math.ceil(y + fontSize * 0.25) + 6)
      const imgW = sX1 - sX0
      const imgH = sY1 - sY0
      const { data } = octx.getImageData(sX0, sY0, imgW, imgH)

      for (let sy = sY0; sy < sY1; sy += gap) {
        for (let sx = sX0; sx < sX1; sx += gap) {
          const idx = ((sy - sY0) * imgW + (sx - sX0)) * 4
          if (data[idx] > 128) {
            let gi = -1
            for (const b of bounds) {
              if (sx >= b.x0 && sx <= b.x1) {
                gi = b.gi
                break
              }
            }
            if (gi < 0) continue

            acc[gi].sumX += sx
            acc[gi].sumY += sy
            acc[gi].n++

            const angle = Math.random() * Math.PI * 2

            particles.push({
              homeX: sx,
              homeY: sy,
              x: Math.random() * w, // start scattered — convergence = assembly
              y: Math.random() * h,
              vx: (Math.random() - 0.5) * 3,
              vy: (Math.random() - 0.5) * 3,
              groupIndex: gi,
              size: dot * (1 + Math.random() * 0.5),
              alpha: 0.55 + Math.random() * 0.45,
              depth: 0.5 + Math.random() * 0.5,
              scatterX: Math.cos(angle),
              scatterY: Math.sin(angle),
              lastX: 0,
              lastY: 0,
            })
          }
        }
      }
    }

    // Geometric centre of each letter group
    for (let gi = 0; gi < groups.length; gi++) {
      if (acc[gi].n > 0) {
        groups[gi].centerX = acc[gi].sumX / acc[gi].n
        groups[gi].centerY = acc[gi].sumY / acc[gi].n
      }
    }

    return { particles, groups }
  }, [])

  // ── Animation loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const section = sectionRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !container || !section || !ctx) return

    const still = prefersReducedMotion()
    let lastExit = -1
    let lastArrive = -1
    let lastCursor = ""
    // True for the first frame drawn after being hidden: no streaks from
    // wherever the particles were last drawn
    let fresh = true
    let rafId = 0
    let timerId: ReturnType<typeof setTimeout>
    let active = true
    let ro: ResizeObserver | null = null
    // Sharp on high-density phone and tablet screens; desktops keep 1× so
    // the per-frame fill cost doesn't grow on large Retina displays
    const dpr = () =>
      window.innerWidth < 1024 ? Math.min(2, window.devicePixelRatio || 1) : 1

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      // Rebuilding scatters the name to reassemble it, so only do it when the
      // size really changed (not for a resize event with the same box)
      if (w === sizeRef.current.w && h === sizeRef.current.h) return
      sizeRef.current = { w, h }
      const scale = dpr()
      canvas.width = Math.round(w * scale)
      canvas.height = Math.round(h * scale)
      ctx.setTransform(scale, 0, 0, scale, 0, 0)
      // Desktops keep the name where it was tuned (baselines around h/2). On
      // narrower screens the tagline wraps and shifts the column, so the name
      // is centred on the slot HeroContent reserves for it instead (the
      // letters' middle sits 0.3 × the font size above centreY).
      let centreY = h * 0.5
      const slot = section.querySelector<HTMLElement>("[data-hero-slot]")
      if (slot && w < 1024) {
        const s = slot.getBoundingClientRect()
        const top = s.top - section.getBoundingClientRect().top
        centreY = top + s.height / 2 + heroFontSize(w, h) * 0.3
      }
      const built = buildParticles(w, h, centreY)
      particlesRef.current = built.particles
      groupsRef.current = built.groups
    }

    const tick = () => {
      if (!active) return
      const { w, h } = sizeRef.current

      // How far the Hero has scrolled away: 0 at rest, 1 once it's gone
      const rect = section.getBoundingClientRect()
      let exit = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)))
      // …or, once it's gone, how far off the name is as the visitor comes
      // round the loop from Contact (1 far away, 0 arrived)
      const loop = exit >= 1 ? loopArrival() : null
      const arriving = loop !== null && loop < 1
      const arrive = arriving ? loop : 0
      if (arriving) exit = 0
      const gone = exit >= 1
      if (Math.abs(exit - lastExit) > 0.001 || Math.abs(arrive - lastArrive) > 0.0005) {
        section.style.setProperty("--hero-exit", exit.toFixed(3))
        section.style.setProperty("--hero-arrive", arrive.toFixed(4))
        container.style.visibility = gone || arrive >= 1 ? "hidden" : ""
        lastExit = exit
        lastArrive = arrive
      }
      if (gone) {
        fresh = true
        rafId = requestAnimationFrame(tick)
        return
      }

      // The light masks read --cursor-x/y on their own layers: the variables
      // are non-inherited (index.css), so they don't flow down from :root
      const root = document.documentElement.style
      const cursorX = root.getPropertyValue("--cursor-x")
      const cursorY = root.getPropertyValue("--cursor-y")
      if (cursorX + cursorY !== lastCursor) {
        for (const layer of [container, logosRef.current]) {
          layer?.style.setProperty("--cursor-x", cursorX)
          layer?.style.setProperty("--cursor-y", cursorY)
        }
        lastCursor = cursorX + cursorY
      }

      // e: 0 → 1 over the first EXIT_END of the scroll-away (eased in)
      const e = still ? 0 : Math.min(1, exit / EXIT_END) ** 1.6
      // a: 1 → 0 as the name comes in round the loop (eased so it slows as it lands)
      const a = still ? 0 : arrive * arrive
      // How much further off than its place the name is: a steady zoom in
      // (ARRIVE_FROM times as far at the start, landing gently at 0)
      const far = ARRIVE_FROM ** a - 1
      // With motion the name stays pinned while it breaks apart; with reduced
      // motion it scrolls away with the page like normal content.
      const scrollShift = still ? rect.top : 0

      ctx.clearRect(0, 0, w, h)

      // Physics runs in section coordinates; the mouse is in viewport coordinates.
      const mx = mouseRef.current.x
      const my = mouseRef.current.y - scrollShift
      const groups = groupsRef.current

      // ── 1. Letter-group magnetic physics ─────────────────────────────────
      for (const g of groups) {
        const curX = g.centerX + g.offsetX
        const curY = g.centerY + g.offsetY

        const dx = curX - mx
        const dy = curY - my
        const dist2 = dx * dx + dy * dy
        const r2 = GROUP_REPEL_R * GROUP_REPEL_R

        let targetX = 0
        let targetY = 0

        if (dist2 < r2 && dist2 > 0.01) {
          const dist = Math.sqrt(dist2)
          const strength = ((GROUP_REPEL_R - dist) / GROUP_REPEL_R) ** 1.8
          targetX = (dx / dist) * strength * GROUP_MAX_OFFSET
          targetY = (dy / dist) * strength * GROUP_MAX_OFFSET
        }

        g.vx += (targetX - g.offsetX) * GROUP_SPRING
        g.vy += (targetY - g.offsetY) * GROUP_SPRING
        g.vx *= GROUP_FRICTION
        g.vy *= GROUP_FRICTION
        g.offsetX += g.vx
        g.offsetY += g.vy
      }

      // ── 2. Letter particle update + draw ──────────────────────────────────
      const ps = particlesRef.current
      const cx = w / 2
      const cy = h / 2
      // Coming round the loop it shows almost at once, tiny and far off
      const appear = 1 - Math.max(0, (arrive - 0.8) / 0.2) ** 2
      const fade = (1 - e * e) * appear
      const exiting = e > 0.002 || a > 0.002

      if (exiting) {
        ctx.save()
        ctx.lineCap = "round"
        ctx.lineWidth = 1.3
        ctx.strokeStyle = `hsla(277,100%,72%,${(0.6 * fade).toFixed(3)})`
        ctx.beginPath()
      }

      for (const p of ps) {
        const g = groups[p.groupIndex]

        const tx = p.homeX + (g?.offsetX ?? 0)
        const ty = p.homeY + (g?.offsetY ?? 0)

        p.vx += (tx - p.x) * PARTICLE_SPRING
        p.vy += (ty - p.y) * PARTICLE_SPRING
        p.vx *= PARTICLE_FRICTION
        p.vy *= PARTICLE_FRICTION
        p.x += p.vx
        p.y += p.vy

        const dc = Math.sqrt((p.x - mx) ** 2 + (p.y - my) ** 2)
        const glow = Math.max(0, 1 - dc / 220) * (1 - e) * (1 - a)
        const brightness = 50 + glow * 40

        // Exit projection: pull toward the camera around the viewport centre.
        // Arrival: push away from it, deeper particles further off.
        const z = e * p.depth * EXIT_MAX_Z
        const scale = 1 / (1 - z) / (1 + far * (1 + ARRIVE_SPREAD * (1 - p.depth)))
        const drift = e * e * EXIT_SCATTER
        const dx = cx + (p.x - cx) * scale + p.scatterX * drift
        const dy = cy + (p.y + scrollShift - cy) * scale + p.scatterY * drift

        if (exiting) {
          const moved = fresh ? 0 : Math.hypot(dx - p.lastX, dy - p.lastY)
          const onScreen = dx > -50 && dx < w + 50 && dy > -50 && dy < h + 50
          if (onScreen && moved > EXIT_STREAK_MIN) {
            ctx.moveTo(p.lastX, p.lastY)
            ctx.lineTo(dx, dy)
          } else if (onScreen) {
            const d = 2 * Math.min(scale, 3)
            ctx.fillStyle = `hsla(277,100%,${brightness}%,${(p.alpha * 0.8 * fade).toFixed(3)})`
            ctx.fillRect(dx - d / 2, dy - d / 2, d, d)
          }
        } else {
          ctx.fillStyle = `hsla(277,100%,${brightness}%,${p.alpha * (0.8 + glow * 0.2)})`
          ctx.beginPath()
          ctx.arc(dx, dy, p.size * (1 + glow * 0.5), 0, Math.PI * 2)
          ctx.fill()
        }

        p.lastX = dx
        p.lastY = dy
      }

      if (exiting) {
        ctx.stroke()
        ctx.restore()
      }
      fresh = false

      // ── 3. Constellation connections near cursor (only while at rest) ─────
      // Batched into a single ctx.stroke() call for performance.
      // Checks array-neighbours only (O(n × lookahead)) — particles are stored
      // in raster order per letter so near-array = near-space within a letter.
      if (!exiting) {
        const connR2 = CONN_CURSOR_R * CONN_CURSOR_R
        const connD2 = CONN_MAX_DIST * CONN_MAX_DIST

        ctx.save()
        ctx.lineWidth = 0.5
        ctx.beginPath()

        for (let i = 0; i < ps.length; i++) {
          const p = ps[i]
          if ((p.x - mx) ** 2 + (p.y - my) ** 2 > connR2) continue
          const end = Math.min(ps.length, i + CONN_LOOKAHEAD + 1)
          for (let j = i + 1; j < end; j++) {
            const q = ps[j]
            if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 < connD2) {
              ctx.moveTo(p.x, p.y + scrollShift)
              ctx.lineTo(q.x, q.y + scrollShift)
            }
          }
        }

        ctx.strokeStyle = "rgba(153,0,250,0.18)"
        ctx.stroke()
        ctx.restore()
      }

      rafId = requestAnimationFrame(tick)
    }

    // Request Kiloy explicitly — nothing in Hero's DOM uses it, so the
    // browser wouldn't fetch it on its own — then sample once fonts settle
    document.fonts
      .load('400 1em "Kiloy"')
      .catch(() => {})
      .then(() => document.fonts.ready)
      .then(() => {
        if (!active) return
        resize()
        ro = new ResizeObserver(resize)
        ro.observe(container)
        timerId = setTimeout(tick, revealDelay * 1000)
      })

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMouseMove)
    // On touch a finger does what the cursor does: letters shy away from it
    // while it's down (it can still scroll — the listeners are passive)
    const onTouch = (e: TouchEvent) => {
      const touch = e.touches[0]
      if (touch) mouseRef.current = { x: touch.clientX, y: touch.clientY }
    }
    const onTouchEnd = () => {
      mouseRef.current = { x: -9999, y: -9999 }
    }
    window.addEventListener("touchstart", onTouch, { passive: true })
    window.addEventListener("touchmove", onTouch, { passive: true })
    window.addEventListener("touchend", onTouchEnd)
    window.addEventListener("touchcancel", onTouchEnd)

    // A ping knocks nearby letters away from it; the group springs pull them back.
    const offPing = onPing((ping) => {
      const shift = still ? section.getBoundingClientRect().top : 0
      for (const g of groupsRef.current) {
        const dx = g.centerX + g.offsetX - ping.x
        const dy = g.centerY + g.offsetY + shift - ping.y
        const d = Math.hypot(dx, dy)
        if (d > PING_JOLT_R || d < 0.01) continue
        const f = (1 - d / PING_JOLT_R) ** 2 * PING_JOLT_F
        g.vx += (dx / d) * f
        g.vy += (dy / d) * f
      }
    })

    return () => {
      active = false
      clearTimeout(timerId)
      cancelAnimationFrame(rafId)
      ro?.disconnect()
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("touchstart", onTouch)
      window.removeEventListener("touchmove", onTouch)
      window.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("touchcancel", onTouchEnd)
      offPing()
    }
  }, [buildParticles, revealDelay])

  return (
    <section ref={sectionRef} className={HERO_FRAME} aria-label="Hero">
      {/* Accessible text — canvas is purely visual */}
      <div className="sr-only">
        <h1>Abdur Khan — Frontend Developer</h1>
        <p>Building interfaces where precision meets intent.</p>
      </div>

      {/* ── Layer 1: particle canvas — fixed so the exit isn't clipped ──────── */}
      {/* h-lvh, not inset-0: a phone's toolbar sliding away mustn't resize it
          (that would rebuild and re-scatter the name mid-scroll) */}
      <div
        ref={containerRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 h-lvh",
          CURSOR_LIGHT_MASK
        )}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      {/* ── Corner accents + floating logos — pinned, fly past the camera on exit ── */}
      <div
        ref={logosRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 h-lvh overflow-hidden",
          CURSOR_LIGHT_MASK,
          // Flies past the camera as the Hero leaves; grows into place as it arrives
          "opacity-[calc(1_-_var(--hero-exit,0)_*_1.6_-_var(--hero-arrive,0)_*_1.6)]",
          "motion-safe:scale-[calc(1_+_var(--hero-exit,0)_*_1.1_-_var(--hero-arrive,0)_*_0.6)]"
        )}
      >
        {/* Corner accents — wide screens only; smaller ones use the corners
            for the social links and language switcher */}
        <div className="hidden lg:block">
          <div className="absolute left-8 top-8 h-14 w-14 border-l border-t border-accent/20" />
          <div className="absolute right-8 top-8 h-14 w-14 border-r border-t border-accent/20" />
          <div className="absolute bottom-8 left-8 h-14 w-14 border-b border-l border-accent/20" />
          <div className="absolute bottom-8 right-8 h-14 w-14 border-b border-r border-accent/20" />
        </div>

        {/* Floating tech logos — decorative */}
        <FloatingTags />
      </div>

      {/* ── Layer 2: HTML content (language switcher, role, tagline, CTA) ─── */}
      <HeroContent />
    </section>
  )
}
