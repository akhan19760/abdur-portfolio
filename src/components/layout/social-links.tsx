/**
 * SocialLinks — GitHub, LinkedIn, and email icon links with magnetic cursor pull.
 *
 * Floating: `fixed` to the viewport so the links stay reachable on every
 * section, not just the hero. z-40 sits above page content but below the
 * loading screen (z-50) and the custom cursor (z-[9999]).
 *
 * All three are real <a>/href elements: fully keyboard-navigable, focus-visible,
 * and screen-reader labelled. The magnetic pull effect is purely visual and does
 * not affect keyboard or SR access.
 *
 * Physics: cursor *attracts* each icon when within ~120 px (opposite of the
 * repulsion used for floating logos) — feels like a gentle pull toward the link.
 */

import { useEffect, useRef } from "react"
import { CONTACT } from "@/constants"

// ── Physics ────────────────────────────────────────────────────────────────────
const ATTRACT_R = 120 // px — cursor influence radius
const MAX_PULL = 14 // px — max displacement toward cursor
const SPRING = 0.1
const FRICTION = 0.7

// ── Social data ────────────────────────────────────────────────────────────────
const SOCIALS = [
  { name: "GitHub", href: CONTACT.github, Icon: GithubIcon },
  { name: "LinkedIn", href: CONTACT.linkedin, Icon: LinkedinIcon },
  { name: "Email", href: `mailto:${CONTACT.email}`, Icon: EmailIcon },
] as const

// ── Icon SVGs ──────────────────────────────────────────────────────────────────

function GithubIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="
          M50 5 C25.147 5 5 25.147 5 50
          C5 69.86 17.865 86.733 35.721 92.477
          C37.971 92.887 38.812 91.493 38.812 90.3
          C38.812 89.232 38.771 86.027 38.75 82.656
          C26.515 85.38 23.871 77.027 23.871 77.027
          C21.822 71.976 18.906 70.588 18.906 70.588
          C14.875 67.793 19.214 67.847 19.214 67.847
          C23.678 68.158 26.027 72.437 26.027 72.437
          C29.99 79.11 36.396 77.206 38.893 76.064
          C39.294 73.153 40.464 71.252 41.76 70.176
          C31.946 69.088 21.619 65.315 21.619 47.889
          C21.619 43.104 23.371 39.192 26.107 36.11
          C25.65 35.024 24.107 30.556 26.54 24.519
          C26.54 24.519 30.278 23.365 38.695 29.034
          C42.225 28.072 46.027 27.592 49.8 27.574
          C53.573 27.592 57.378 28.072 60.914 29.034
          C69.322 23.365 73.057 24.519 73.057 24.519
          C75.493 30.556 73.95 35.024 73.493 36.11
          C76.237 39.192 77.981 43.104 77.981 47.889
          C77.981 65.356 67.634 69.077 57.797 70.143
          C59.416 71.488 60.859 74.137 60.859 78.189
          C60.859 83.991 60.806 88.677 60.806 90.3
          C60.806 91.504 61.632 92.909 63.913 92.471
          C81.752 86.72 95 69.852 95 50
          C95 25.147 74.853 5 50 5Z
        "
      />
    </svg>
  )
}

function LinkedinIcon() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" rx="14" fill="currentColor" />
      <rect x="15" y="38" width="16" height="48" fill="#0a0a0a" />
      <circle cx="23" cy="23" r="10" fill="#0a0a0a" />
      <path
        d="M42 38 L58 38 L58 46 C61 41 67 37 74 37 C86 37 88 45 88 56 L88 86 L72 86 L72 58 C72 53 70 49 65 49 C60 49 58 53 58 58 L58 86 L42 86 Z"
        fill="#0a0a0a"
      />
    </svg>
  )
}

function EmailIcon() {
  return (
    <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <rect
        x="5"
        y="22"
        width="90"
        height="56"
        rx="8"
        stroke="currentColor"
        strokeWidth="6"
      />
      <path
        d="M5 30 L50 60 L95 30"
        stroke="currentColor"
        strokeWidth="6"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ── State type ─────────────────────────────────────────────────────────────────
type LinkState = {
  el: HTMLAnchorElement
  x: number
  y: number
  vx: number
  vy: number
}

export function SocialLinks() {
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>(
    new Array(SOCIALS.length).fill(null)
  )
  const statesRef = useRef<LinkState[]>([])
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    statesRef.current = linkRefs.current
      .filter((el): el is HTMLAnchorElement => el !== null)
      .map((el) => ({ el, x: 0, y: 0, vx: 0, vy: 0 }))

    let rafId = 0
    let active = true

    const tick = () => {
      if (!active) return
      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      for (const ts of statesRef.current) {
        const rect = ts.el.getBoundingClientRect()
        const cx = rect.left + rect.width / 2
        const cy = rect.top + rect.height / 2

        // Attraction toward cursor (inverse of repulsion)
        const dx = mx - cx
        const dy = my - cy
        const dist2 = dx * dx + dy * dy
        let pullX = 0
        let pullY = 0

        if (dist2 < ATTRACT_R * ATTRACT_R && dist2 > 0.01) {
          const dist = Math.sqrt(dist2)
          const strength = ((ATTRACT_R - dist) / ATTRACT_R) ** 1.5
          pullX = (dx / dist) * strength * MAX_PULL
          pullY = (dy / dist) * strength * MAX_PULL
        }

        ts.vx += (pullX - ts.x) * SPRING
        ts.vy += (pullY - ts.y) * SPRING
        ts.vx *= FRICTION
        ts.vy *= FRICTION
        ts.x += ts.vx
        ts.y += ts.vy

        // inline style: computed physics offset — cannot be a Tailwind class
        ts.el.style.transform = `translate(${ts.x.toFixed(2)}px,${ts.y.toFixed(2)}px)`
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener("mousemove", onMove)

    return () => {
      active = false
      cancelAnimationFrame(rafId)
      window.removeEventListener("mousemove", onMove)
    }
  }, [])

  return (
    <div className="pointer-events-none fixed bottom-20 left-10 z-40 flex flex-col gap-4">
      {SOCIALS.map(({ name, href, Icon }, i) => (
        <a
          key={name}
          ref={(el) => {
            linkRefs.current[i] = el
          }}
          href={href}
          target={href.startsWith("mailto") ? undefined : "_blank"}
          rel={href.startsWith("mailto") ? undefined : "noopener noreferrer"}
          aria-label={
            href.startsWith("mailto")
              ? `Send email to ${name}`
              : `${name} profile (opens in new tab)`
          }
          className="
            social-btn-3d
            pointer-events-auto flex h-14 w-14 items-center justify-center
            rounded-[22px] text-white will-change-transform
            transition-[background,box-shadow,translate] duration-200
            focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4
            focus-visible:outline-white
          "
        >
          <div className="h-6 w-6 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.45))]">
            <Icon />
          </div>
        </a>
      ))}
    </div>
  )
}
