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
 * Layers back → front (all above the page-level SignalField):
 *   1. Canvas (fixed to the viewport) — letter particles + connections
 *   2. Corner accents + floating logos (fixed to the viewport)
 *   3. Content (z-10) — role label, tagline, CTA as HTML
 *
 * All animation is RAF + canvas 2D — no GSAP, no external libs.
 * Manually verified in-browser per the `testing` skill (animation / canvas code).
 */

import { useCallback, useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { LanguageSwitcher } from "@/components/shared"
import { prefersReducedMotion } from "@/lib/media"
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
  const { t } = useTranslation()
  const sectionRef = useRef<HTMLElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const groupsRef = useRef<LetterGroup[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 }) // viewport coordinates
  const sizeRef = useRef({ w: 0, h: 0 })

  // ── Build particles from offscreen text ────────────────────────────────────
  const buildParticles = useCallback((w: number, h: number) => {
    const off = document.createElement("canvas")
    off.width = w
    off.height = h
    const octx = off.getContext("2d")!

    // Font size mirrors CSS clamp(4.5rem, 13vw, 12rem) in raw pixels
    const fontSize = Math.min(w * 0.13, 192)
    // Adaptive gap — denser on small screens so letters form clearly
    const gap = Math.max(3, Math.round(fontSize / 38))

    octx.font = `400 ${fontSize}px "Kiloy", Georgia, serif`
    octx.textAlign = "left"
    octx.textBaseline = "alphabetic"
    octx.fillStyle = "white"

    // Both lines centred vertically at h/2
    const lineY = [
      h * 0.5 - fontSize * 0.5, // ABDUR baseline — above centre
      h * 0.5 + fontSize * 0.62, // KHAN baseline  — below centre
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
              size: 1.4 + Math.random() * 0.7,
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
    let rafId = 0
    let timerId: ReturnType<typeof setTimeout>
    let active = true
    let ro: ResizeObserver | null = null

    const resize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      sizeRef.current = { w, h }
      canvas.width = w
      canvas.height = h
      const built = buildParticles(w, h)
      particlesRef.current = built.particles
      groupsRef.current = built.groups
    }

    const tick = () => {
      if (!active) return
      const { w, h } = sizeRef.current

      // How far the Hero has scrolled away: 0 at rest, 1 once it's gone
      const rect = section.getBoundingClientRect()
      const exit = Math.min(1, Math.max(0, -rect.top / Math.max(rect.height, 1)))
      if (Math.abs(exit - lastExit) > 0.001) {
        section.style.setProperty("--hero-exit", exit.toFixed(3))
        container.style.visibility = exit >= 1 ? "hidden" : ""
        lastExit = exit
      }
      if (exit >= 1) {
        rafId = requestAnimationFrame(tick)
        return
      }

      // e: 0 → 1 over the first EXIT_END of the scroll-away (eased in)
      const e = still ? 0 : Math.min(1, exit / EXIT_END) ** 1.6
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
      const fade = 1 - e * e
      const exiting = e > 0.002

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
        const glow = Math.max(0, 1 - dc / 220) * (1 - e)
        const brightness = 50 + glow * 40

        // Exit projection: pull toward the camera around the viewport centre
        const z = e * p.depth * EXIT_MAX_Z
        const scale = 1 / (1 - z)
        const drift = e * e * EXIT_SCATTER
        const dx = cx + (p.x - cx) * scale + p.scatterX * drift
        const dy = cy + (p.y + scrollShift - cy) * scale + p.scatterY * drift

        if (exiting) {
          const moved = Math.hypot(dx - p.lastX, dy - p.lastY)
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

    // Wait for Kiloy to load before sampling offscreen text
    document.fonts.ready.then(() => {
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
      offPing()
    }
  }, [buildParticles, revealDelay])

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-screen flex-col overflow-hidden"
      aria-label="Hero"
    >
      {/* Accessible text — canvas is purely visual */}
      <div className="sr-only">
        <h1>Abdur Khan — Frontend Developer</h1>
        <p>Building interfaces where precision meets intent.</p>
      </div>

      {/* ── Layer 1: particle canvas — fixed so the exit isn't clipped ──────── */}
      <div
        ref={containerRef}
        aria-hidden="true"
        className={cn("pointer-events-none fixed inset-0", CURSOR_LIGHT_MASK)}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
      </div>

      {/* ── Corner accents + floating logos — pinned, fly past the camera on exit ── */}
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none fixed inset-0",
          CURSOR_LIGHT_MASK,
          "opacity-[calc(1_-_var(--hero-exit,0)_*_1.6)]",
          "motion-safe:scale-[calc(1_+_var(--hero-exit,0)_*_1.1)]"
        )}
      >
        <div className="absolute left-8 top-8 h-14 w-14 border-l border-t border-accent/20" />
        <div className="absolute right-8 top-8 h-14 w-14 border-r border-t border-accent/20" />
        <div className="absolute bottom-8 left-8 h-14 w-14 border-b border-l border-accent/20" />
        <div className="absolute bottom-8 right-8 h-14 w-14 border-b border-r border-accent/20" />

        {/* Floating tech logos — decorative */}
        <FloatingTags />
      </div>

      {/* ── Language switcher — EN · UR, top-right ───────────────────────────── */}
      <div className="absolute right-10 top-10 z-10">
        <LanguageSwitcher />
      </div>

      {/* ── Layer 2: HTML content (role, tagline, CTA) ───────────────────────── */}
      {/* Fades out on exit, but comes back if the CTA receives keyboard focus */}
      <div
        className={cn(
          "pointer-events-none relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center",
          "opacity-[calc(1_-_var(--hero-exit,0)_*_2.4)] has-[:focus-visible]:opacity-100"
        )}
      >
        <p className="mb-6 font-sans text-xs uppercase tracking-[0.4em] text-accent/60">
          {t("hero.role")}
        </p>

        {/*
          Invisible spacer — reserves the canvas text area in the flex column.
          Height approximates two lines of Kiloy at clamp(4.5rem, 13vw, 12rem).
          Tune in browser if the role/tagline drift relative to the canvas name.
        */}
        <div aria-hidden="true" style={{ height: "clamp(9rem, 24vw, 22rem)" }} />

        <p className="mb-10 mt-6 font-sans text-sm tracking-widest text-text/35">
          {t("hero.tagline")}
        </p>

        <a
          href="#work"
          className={cn(
            "pointer-events-auto inline-flex items-center gap-3",
            "border border-accent/30 px-6 py-3",
            "font-sans text-xs uppercase tracking-widest text-accent/70",
            "transition-colors duration-300 hover:border-accent/60 hover:bg-accent/10",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          )}
        >
          {t("hero.cta")} <span aria-hidden="true">↓</span>
        </a>
      </div>
    </section>
  )
}
