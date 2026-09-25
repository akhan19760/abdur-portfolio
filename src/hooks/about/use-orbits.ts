import { useEffect, useRef } from "react"
import { onPing } from "@/lib/ping"

const PING_KICK_R = 380 // px — satellites within this range of a ping get knocked
const PING_KICK = 3.2 // rad/s of extra spin right at the ping
const SPIN_DECAY = 0.96 // per frame

export type Orbit = {
  /** Horizontal / vertical radius, as a fraction of the container's half-size. */
  rx: number
  ry: number
  /** Tilt of the ellipse in radians. */
  tilt: number
  /** Angular speed in radians per second. */
  speed: number
  /** Starting angle in radians. */
  phase: number
}

/** A dock slot, as a fraction of the container's half-size from its centre. */
export type Dock = { x: number; y: number }

/**
 * Position on a tilted elliptical orbit, in px from the container centre.
 * The ellipse is tilted in normalised space and then stretched to the
 * container, which matches an SVG drawn with preserveAspectRatio="none".
 * `depth` is -1 at the back of the orbit and 1 at the front.
 */
export function orbitPoint(
  angle: number,
  orbit: Orbit,
  width: number,
  height: number
): { x: number; y: number; depth: number } {
  const ex = Math.cos(angle) * orbit.rx
  const ey = Math.sin(angle) * orbit.ry
  const cos = Math.cos(orbit.tilt)
  const sin = Math.sin(orbit.tilt)
  return {
    x: (ex * cos - ey * sin) * (width / 2),
    y: (ex * sin + ey * cos) * (height / 2),
    depth: Math.sin(angle),
  }
}

type OrbitsOptions = {
  orbits: readonly Orbit[]
  docks: readonly Dock[]
  /** False in the flat fallback: satellites stay in normal layout. */
  enabled: boolean
}

/**
 * Moves the About section's status satellites.
 *
 * Every `[data-orbit-index="i"]` element inside the container circles on
 * `orbits[i]`. It slows down under the cursor light (reading the `--light`
 * value useLightProximity writes), so it can be caught. Once it has
 * `data-caught`, it eases out of its orbit into `docks[i]` and stays there.
 * Satellites at the back of their orbit are smaller and dimmer. A ping
 * (lib/ping) nearby knocks them along their orbit, and the spin decays.
 *
 * Runs only while enabled and on screen. With `enabled: false` it leaves the
 * elements alone.
 */
export function useOrbits<T extends HTMLElement = HTMLElement>({
  orbits,
  docks,
  enabled,
}: OrbitsOptions) {
  const containerRef = useRef<T>(null)
  const orbitsRef = useRef(orbits)
  const docksRef = useRef(docks)
  useEffect(() => {
    orbitsRef.current = orbits
    docksRef.current = docks
  }, [orbits, docks])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    const angles = orbitsRef.current.map((o) => o.phase)
    const docked = orbitsRef.current.map(() => 0)
    const spin = orbitsRef.current.map(() => 0)

    const offPing = onPing((ping) => {
      for (const el of container.querySelectorAll<HTMLElement>("[data-orbit-index]")) {
        const i = Number(el.dataset.orbitIndex)
        const orbit = orbitsRef.current[i]
        if (!orbit) continue
        const r = el.getBoundingClientRect()
        const d = Math.hypot(r.left + r.width / 2 - ping.x, r.top + r.height / 2 - ping.y)
        if (d < PING_KICK_R)
          spin[i] += (1 - d / PING_KICK_R) * PING_KICK * Math.sign(orbit.speed || 1)
      }
    })
    let rafId = 0
    let last = performance.now()
    let visible = typeof IntersectionObserver === "undefined"

    const tick = (now: number) => {
      rafId = 0
      if (!visible) return
      // A frame timestamp can land just before the last reading: never step back
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05))
      last = now

      const w = container.offsetWidth
      const h = container.offsetHeight
      const els = container.querySelectorAll<HTMLElement>("[data-orbit-index]")

      for (const el of els) {
        const i = Number(el.dataset.orbitIndex)
        const orbit = orbitsRef.current[i]
        const dock = docksRef.current[i]
        if (!orbit || !dock) continue

        const light = parseFloat(el.style.getPropertyValue("--light")) || 0
        angles[i] += (orbit.speed * (1 - light * 0.85) + spin[i]) * dt
        spin[i] *= SPIN_DECAY
        docked[i] += ((el.hasAttribute("data-caught") ? 1 : 0) - docked[i]) * 0.07

        const p = orbitPoint(angles[i], orbit, w, h)
        const d = docked[i]
        const x = p.x + (dock.x * (w / 2) - p.x) * d
        const y = p.y + (dock.y * (h / 2) - p.y) * d
        const front = (p.depth + 1) / 2
        const orbitScale = 0.7 + 0.45 * front
        const orbitOpacity = 0.45 + 0.55 * front

        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) scale(${(orbitScale + (1 - orbitScale) * d).toFixed(3)})`
        el.style.opacity = (orbitOpacity + (1 - orbitOpacity) * d).toFixed(3)
        el.style.zIndex = String(Math.round(front * 10) + (d > 0.5 ? 20 : 0))
      }

      rafId = requestAnimationFrame(tick)
    }

    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible && !rafId) {
              last = performance.now()
              rafId = requestAnimationFrame(tick)
            }
          })

    observer?.observe(container)
    if (visible) rafId = requestAnimationFrame(tick)

    return () => {
      offPing()
      observer?.disconnect()
      cancelAnimationFrame(rafId)
      for (const el of container.querySelectorAll<HTMLElement>("[data-orbit-index]")) {
        el.style.transform = ""
        el.style.opacity = ""
        el.style.zIndex = ""
      }
    }
  }, [enabled])

  return { containerRef }
}
