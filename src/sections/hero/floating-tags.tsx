/**
 * FloatingLogos — 29 branded tech icons drifting around the hero perimeter.
 *
 * Icons are sourced from @dev.icons/react (devicons library).
 *
 * Layout — four thematic strips framing the canvas name area:
 *
 *   Left column  (x ≈  1 %, 7 icons) — Languages
 *     JS · TS · HTML · CSS · Dart · LESS · Sass
 *
 *   Right column (x ≈ 87 %, 7 icons) — Frontend stack
 *     React · Next.js · Flutter · Tailwind · MUI · Redux · Orval
 *
 *   Top strip    (y ≈  3 %, 8 icons) — Tooling & platforms
 *     Git · Docker · VS Code · Figma · Postman · Vercel · Swagger · Firebase
 *
 *   Bottom strip (y ≈ 93 %, 7 icons) — Backend, databases & AI
 *     Node.js · Android · Azure · PostgreSQL · TanStack Query · Claude Code · Cursor
 *
 * Notes on substitutions:
 *   - "Zustand" has no icon in @dev.icons/react — replaced with Orval (user's other request).
 *   - "Android Studio" → Android (closest available icon in the package).
 *   - "SQL Server" → PostgreSQL (closest available SQL database icon).
 *
 * Smaller screens get their own layouts (picked once on mount, like the
 * sections' modes), because the desktop frame would cover the name there:
 *   Tablet (< 1024px) — all 29 at 44px; the side columns start lower and the
 *     top strip sits lower, clear of the social links and language switcher.
 *   Phone (< 640px) — 10 at 36px, labels hidden: a row above the name and a
 *     row below the call to action (only the lower row on short phones).
 *   Short (under 1024px wide and 500px tall, a phone on its side) — none:
 *     the name, tagline and call to action fill the screen.
 * Touch works like the cursor: a finger pushes icons away, a tap blasts them.
 *
 * All icons are aria-hidden — purely decorative.
 */

import {
  /* Languages */
  Javascript,
  Typescript,
  Html5,
  Css3,
  Dart,
  Less,
  Sass,
  /* Frontend stack */
  _React as ReactIcon,
  Nextjs,
  Flutter,
  Tailwind,
  MaterialUi,
  Redux,
  Orval,
  /* Tooling & platforms */
  Git,
  Docker,
  VisualStudioCode,
  Figma,
  Postman,
  Vercel,
  Swagger,
  Firebase,
  /* Backend, databases & AI */
  Nodejs,
  Android,
  MicrosoftAzure,
  Postgresql,
  ReactQuery,
  Anthropic,
  Cursor,
} from "@dev.icons/react"
import { useEffect, useRef, useState } from "react"
import { matchesMedia } from "@/lib/media"
import { loopArrival } from "@/lib/page-loop"
import { cn } from "@/lib/utils"
import type { ComponentType, SVGProps } from "react"

// ── Physics ────────────────────────────────────────────────────────────────────
const SPRING = 0.055
const FRICTION = 0.85
const REPEL_R = 170 // px — cursor influence radius
const MAX_REPEL = 70 // px — max push distance
const DRIFT_X = 22 // px — horizontal bounce amplitude
const DRIFT_Y = 18 // px — vertical bounce amplitude
const CLICK_IMPULSE = 40 // px/frame — velocity blast on mousedown

type SvgIcon = ComponentType<SVGProps<SVGSVGElement>>

// ── Icon registry (order matches REST below) ───────────────────────────────────
const LOGOS: { name: string; Icon: SvgIcon }[] = [
  // ── Left column — Languages ─────────────────────────────────────────────────
  { name: "JavaScript", Icon: Javascript },
  { name: "TypeScript", Icon: Typescript },
  { name: "HTML5", Icon: Html5 },
  { name: "CSS3", Icon: Css3 },
  { name: "Dart", Icon: Dart },
  { name: "LESS", Icon: Less },
  { name: "Sass", Icon: Sass },

  // ── Right column — Frontend stack ───────────────────────────────────────────
  { name: "React", Icon: ReactIcon },
  { name: "Next.js", Icon: Nextjs },
  { name: "Flutter", Icon: Flutter },
  { name: "Tailwind CSS", Icon: Tailwind },
  { name: "Material UI", Icon: MaterialUi },
  { name: "Redux", Icon: Redux },
  { name: "Orval", Icon: Orval }, // Zustand not in package

  // ── Top strip — Tooling & platforms ─────────────────────────────────────────
  { name: "Git", Icon: Git },
  { name: "Docker", Icon: Docker },
  { name: "VS Code", Icon: VisualStudioCode },
  { name: "Figma", Icon: Figma },
  { name: "Postman", Icon: Postman },
  { name: "Vercel", Icon: Vercel },
  { name: "Swagger", Icon: Swagger },
  { name: "Firebase", Icon: Firebase },

  // ── Bottom strip — Backend, databases & AI ──────────────────────────────────
  { name: "Node.js", Icon: Nodejs },
  { name: "Android", Icon: Android }, // AndroidStudio not in package
  { name: "Azure", Icon: MicrosoftAzure },
  { name: "PostgreSQL", Icon: Postgresql }, // SQL Server not in package
  { name: "TanStack Query", Icon: ReactQuery },
  { name: "Claude Code", Icon: Anthropic },
  { name: "Cursor", Icon: Cursor },
]

// ── Rest positions [leftPct, topPct] — 29 slots ───────────────────────────────
const REST: [number, number][] = [
  // Left column (7) — Languages
  [1, 5],
  [1, 19],
  [1, 33],
  [1, 47],
  [1, 61],
  [1, 75],
  [1, 89],
  // Right column (7) — Frontend stack
  [87, 5],
  [87, 19],
  [87, 33],
  [87, 47],
  [87, 61],
  [87, 75],
  [87, 89],
  // Top strip (8) — Tooling & platforms
  [13, 3],
  [22, 3],
  [31, 3],
  [40, 3],
  [50, 3],
  [59, 3],
  [68, 3],
  [78, 3],
  // Bottom strip (7) — Backend, databases & AI
  [13, 93],
  [24, 93],
  [35, 93],
  [46, 93],
  [57, 93],
  [68, 93],
  [79, 93],
]

// ── Tablet rest positions — same 29 slots, framed below the top corners ────────
const REST_TABLET: [number, number][] = [
  // Left column (7)
  [2, 15],
  [2, 27],
  [2, 39],
  [2, 51],
  [2, 63],
  [2, 75],
  [2, 87],
  // Right column (7)
  [89, 15],
  [89, 27],
  [89, 39],
  [89, 51],
  [89, 63],
  [89, 75],
  [89, 87],
  // Top strip (8)
  [14, 7],
  [23, 7],
  [32, 7],
  [41, 7],
  [50, 7],
  [59, 7],
  [68, 7],
  [77, 7],
  // Bottom strip (7)
  [14, 92],
  [24, 92],
  [34, 92],
  [44, 92],
  [54, 92],
  [64, 92],
  [74, 92],
]

// ── Phone rest positions — [logo index, leftPct, topPct], one row above the
// name and one below the call to action ─────────────────────────────────────
const REST_PHONE: [number, number, number][] = [
  [0, 5, 13], // JavaScript
  [1, 25, 13], // TypeScript
  [7, 44, 13], // React
  [6, 63, 13], // Sass
  [12, 82, 13], // Redux
  [15, 5, 86], // Docker
  [9, 25, 86], // Flutter
  [17, 44, 86], // Figma
  [22, 63, 86], // Node.js
  [14, 80, 86], // Git
]

type Layout = "desktop" | "tablet" | "phone" | "short-phone" | "none"

function pickLayout(): Layout {
  if (matchesMedia("(min-width: 1024px)", true)) return "desktop"
  if (matchesMedia("(max-height: 500px)", false)) return "none"
  if (matchesMedia("(min-width: 640px)", true)) return "tablet"
  return matchesMedia("(max-height: 640px)", false) ? "short-phone" : "phone"
}

/** The logos to show in a layout, each with its rest position. */
function placements(layout: Layout) {
  if (layout === "none") return []
  if (layout === "phone" || layout === "short-phone") {
    return REST_PHONE.filter(([, , top]) => layout === "phone" || top > 50).map(
      ([i, left, top]) => ({ ...LOGOS[i], left, top })
    )
  }
  const rest = layout === "tablet" ? REST_TABLET : REST
  return LOGOS.map((logo, i) => ({ ...logo, left: rest[i][0], top: rest[i][1] }))
}

const ICON_SIZE: Record<Layout, number> = {
  desktop: 56,
  tablet: 44,
  phone: 36,
  "short-phone": 36,
  none: 0,
}

// ── State ──────────────────────────────────────────────────────────────────────
type IconState = {
  el: HTMLDivElement
  x: number
  y: number
  vx: number
  vy: number
  rot: number // tilt angle in degrees
  vrot: number // angular velocity
  phase: number // harmonic drift phase (unique per icon)
  speed: number // harmonic drift speed  (unique per icon)
}

export function FloatingTags() {
  // Screen size doesn't change mid-session in practice (a rotated tablet
  // keeps its layout, which still fits)
  const [layout] = useState(pickLayout)
  const logos = placements(layout)
  const iconRefs = useRef<(HTMLDivElement | null)[]>([])
  const statesRef = useRef<IconState[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    // Honour prefers-reduced-motion — icons are decorative, skip all motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    statesRef.current = iconRefs.current
      .filter((el): el is HTMLDivElement => el !== null)
      .map((el, i) => ({
        el,
        x: 0,
        y: 0,
        vx: (Math.random() - 0.5) * 5, // initial kick so icons look alive immediately
        vy: (Math.random() - 0.5) * 5,
        rot: 0,
        vrot: 0,
        phase: (i / LOGOS.length) * Math.PI * 2,
        speed: 0.15 + i * 0.035,
      }))

    let rafId = 0
    let active = true
    let t = 0

    const tick = () => {
      if (!active) return
      // Once the Hero has scrolled away the logos have faded out — skip the
      // per-icon layout reads until it's back (at the top, or coming round
      // the page's loop from Contact).
      const arriving = loopArrival()
      if (window.scrollY > window.innerHeight && (arriving === null || arriving >= 1)) {
        rafId = requestAnimationFrame(tick)
        return
      }
      t += 0.016

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (const ts of statesRef.current) {
        const rect = ts.el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2

        // Harmonic drift — target wanders around rest position
        const driftX = Math.sin(t * ts.speed + ts.phase) * DRIFT_X
        const driftY = Math.cos(t * ts.speed * 0.65 + ts.phase + 1.2) * DRIFT_Y

        // Cursor repulsion
        const dx = cx - mx
        const dy = cy - my
        const dist2 = dx * dx + dy * dy
        let repelX = 0
        let repelY = 0

        if (dist2 < REPEL_R * REPEL_R && dist2 > 0.01) {
          const dist = Math.sqrt(dist2)
          const strength = ((REPEL_R - dist) / REPEL_R) ** 1.5
          repelX = (dx / dist) * strength * MAX_REPEL
          repelY = (dy / dist) * strength * MAX_REPEL
        }

        // Spring toward combined drift + repel target
        ts.vx += (driftX + repelX - ts.x) * SPRING
        ts.vy += (driftY + repelY - ts.y) * SPRING
        ts.vx *= FRICTION
        ts.vy *= FRICTION
        ts.x += ts.vx
        ts.y += ts.vy

        // Tilt in the direction of horizontal velocity — feels alive / bouncy
        ts.vrot += ts.vx * 0.15 - ts.rot * 0.04
        ts.vrot *= 0.88
        ts.rot += ts.vrot

        // inline style: physics transform — cannot be expressed as a Tailwind class
        ts.el.style.transform = `translate(${ts.x.toFixed(2)}px,${ts.y.toFixed(2)}px) rotate(${ts.rot.toFixed(2)}deg)`
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }

    // Click blast — scatter all icons away from the click point
    const onDown = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
      for (const ts of statesRef.current) {
        const rect = ts.el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2
        const dx = cx - e.clientX
        const dy = cy - e.clientY
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        // Blast away from click point with a jitter so nearby icons diverge
        ts.vx += (dx / dist) * CLICK_IMPULSE + (Math.random() - 0.5) * 8
        ts.vy += (dy / dist) * CLICK_IMPULSE + (Math.random() - 0.5) * 8
        ts.vrot += (Math.random() - 0.5) * 10 // chaotic spin
      }
    }

    window.addEventListener("mousemove", onMove)
    // A finger pushes icons away like the cursor does, while it's down
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
    // capture: true — fires before any element handler can call stopPropagation,
    // so clicks absorbed by Lenis, the custom cursor, or interactive elements
    // still reach this listener.
    window.addEventListener("mousedown", onDown, { capture: true })

    return () => {
      active = false
      cancelAnimationFrame(rafId)
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("touchstart", onTouch)
      window.removeEventListener("touchmove", onTouch)
      window.removeEventListener("touchend", onTouchEnd)
      window.removeEventListener("touchcancel", onTouchEnd)
      window.removeEventListener("mousedown", onDown, { capture: true })
    }
  }, [])

  return (
    <>
      {logos.map(({ name, Icon, left, top }, i) => (
        <div
          key={name}
          ref={(el) => {
            iconRefs.current[i] = el
          }}
          aria-hidden="true"
          className="pointer-events-none absolute select-none will-change-transform"
          style={{
            // inline style: percentage rest position — cannot be a Tailwind class
            left: `${left}%`,
            top: `${top}%`,
          }}
        >
          <Icon
            width={ICON_SIZE[layout]}
            height={ICON_SIZE[layout]}
            className="opacity-80"
          />
          <span
            className={cn(
              "mt-1 block text-center font-support text-[10px] leading-tight tracking-wide text-white/50",
              (layout === "phone" || layout === "short-phone") && "hidden"
            )}
          >
            {name}
          </span>
        </div>
      ))}
    </>
  )
}
