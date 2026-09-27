/**
 * PinWall — the Contact section's world: a vast wall of steel pins in the
 * dark, like a pin-art toy, spelling SAY HELLO.
 *
 * It picks up where Process leaves off. Process's paper plane flies off into
 * the dark, and this is what it flies into: the wall waits far ahead, unlit,
 * and the plane's light shows on it where the plane is heading. When it
 * arrives (lib/paper-plane) the pins where it hit are driven in and a ring
 * runs out across the wall. Then, as the section comes up, the camera comes
 * down and in until the wall fills the view, and the letters push out from
 * behind, spreading out from where the plane hit.
 *
 * - The cursor is a fingertip and a lamp. Pins sink where it presses and
 *   spring back once it moves on, leaving a wake; its light, low over the
 *   wall, rakes across the pin heads, throwing their shadows away from it
 *   and catching purple glints on the tips nearest to it.
 * - Holding the mouse button down presses deeper and wider; a click strikes
 *   the wall and sends a ring out from the spot.
 * - The camera moves a little with the cursor, so the pins' depth shows.
 *
 * Scrolling on past the section (the page loop), a hole opens in the middle
 * of the wall and the camera flies through it; the Hero's name is already
 * coming in behind it (this canvas is see-through where the pins have sunk
 * away), and the page wraps back round to the top.
 *
 * Choreography: wall-choreography (pure, unit-tested); pins: pin-field
 * (pure, unit-tested); letters: wall-lettering; shading: pin-wall-shader.
 * Drawn from GSAP's ticker right after Lenis has moved the page; nothing
 * renders while the section is out of range. Clicks arrive as the page's
 * pings (lib/ping).
 *
 * Pulls in three.js: the section loads it with React.lazy, and it's not
 * re-exported from the contact barrel. Decorative only (aria-hidden, no
 * pointer events; the letters' words are the section's heading and text).
 * Only mounted in immersive mode. Verified manually in-browser (R3F, per the
 * `testing` skill).
 */

import { useEffect, useMemo, useRef } from "react"
import type { RefObject } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { gsap } from "gsap"
import {
  DataTexture,
  FloatType,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LatheGeometry,
  Matrix4,
  Mesh,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three"
import type { PerspectiveCamera } from "three"
import { cn } from "@/lib/utils"
import { onPing } from "@/lib/ping"
import { PLANE_ARRIVAL, onPlaneArrival, planeSighting } from "@/lib/paper-plane"
import type { WallPhases } from "@/hooks/contact"
import {
  PIN_CHANNELS,
  createPinField,
  setRelief,
  setRevealOrigin,
  settlePins,
  shadePins,
  stepPins,
  strikePins,
} from "./pin-field"
import type { Press } from "./pin-field"
import { WALL_LAMP, pinFragmentShader, pinVertexShader } from "./pin-wall-shader"
import {
  WALL_EXIT_END,
  WALL_FOV,
  WALL_VISIBLE_FROM,
  clamp,
  letteringBox,
  pinGridFor,
  mix,
  smoothstep,
  toCell,
  wallPoint,
  wallStateAt,
} from "./wall-choreography"
import type { WallCamera } from "./wall-choreography"
import { drawLettering } from "./wall-lettering"

/** The fingertip: resting on the wall, and pressed in with the button held. */
const FINGER = {
  hover: { radius: 4.5, depth: 0.8 },
  hold: { radius: 6.5, depth: 2.6 },
  /** How quickly it presses in / lets go (per frame at 60 fps). */
  ease: { down: 0.14, up: 0.08 },
}
/** A click, and the plane's arrival: how hard they strike (units a second) and how wide. */
const STRIKE = {
  click: { strength: 26, radius: 1.8 },
  arrival: { strength: 60, radius: 4.5 },
}
/** The plane's light: how high over the wall it starts, and where it ends up (units). */
const FLARE = { from: 34, to: 1.6, flash: 2.6, fade: 1.2 }

type PinWallProps = {
  /** The timeline position (screens) straight from the scroll (useWallScroll). */
  readUnits: () => number
  phases: WallPhases
  /** The words the pins spell out. */
  lettering: string
  className?: string
}

export function PinWall({ className, ...props }: PinWallProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={cn("pointer-events-none invisible fixed inset-0 opacity-0", className)}
    >
      <Canvas
        // R3F sets pointer-events: auto inline on its container, which would
        // take clicks meant for the page; only inline style overrides it
        style={{ pointerEvents: "none" }}
        frameloop="never"
        dpr={[1, 1.5]}
        flat
        linear
        camera={{ fov: (WALL_FOV * 180) / Math.PI, near: 1, far: 800 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <WallScene wrapperRef={wrapperRef} {...props} />
      </Canvas>
    </div>
  )
}

type WallSceneProps = Omit<PinWallProps, "className"> & {
  wrapperRef: RefObject<HTMLDivElement | null>
}

function cursorOnScreen(): { sx: number; sy: number } | null {
  const style = document.documentElement.style
  const x = parseFloat(style.getPropertyValue("--cursor-x"))
  const y = parseFloat(style.getPropertyValue("--cursor-y"))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { sx: x / window.innerWidth, sy: y / window.innerHeight }
}

/** One pin (shaft and domed head, pointing along +z), repeated for every cell. */
function createPins(cols: number, rows: number): InstancedBufferGeometry {
  // Profile from the far end of the shaft, deep in the wall, out to the tip
  const profile = [
    [0.17, -6],
    [0.17, -0.04],
    [0.4, 0.02],
    [0.29, 0.15],
    [0, 0.22],
  ].map(([r, y]) => new Vector2(r, y))
  const lathe = new LatheGeometry(profile, 8)
  lathe.rotateX(Math.PI / 2) // its axis from y to z
  const geometry = new InstancedBufferGeometry()
  geometry.setIndex(lathe.getIndex())
  geometry.setAttribute("position", lathe.getAttribute("position"))
  geometry.setAttribute("normal", lathe.getAttribute("normal"))
  const cells = new Float32Array(cols * rows * 2)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = (r * cols + c) * 2
      cells[i] = c
      cells[i + 1] = r
    }
  }
  geometry.setAttribute("aCell", new InstancedBufferAttribute(cells, 2))
  geometry.instanceCount = cols * rows
  lathe.dispose()
  return geometry
}

function WallScene({ wrapperRef, readUnits, phases, lettering }: WallSceneProps) {
  const advance = useThree((s) => s.advance)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const camera = useThree((s) => s.camera) as PerspectiveCamera

  // A tall wall for portrait views, a wide one for landscape (lib/stage-framing)
  const { cols, rows } = pinGridFor(size.width / Math.max(1, size.height))
  const field = useMemo(() => createPinField(cols, rows), [cols, rows])
  const data = useMemo(() => new Float32Array(cols * rows * PIN_CHANNELS), [cols, rows])
  const texture = useMemo(() => {
    const t = new DataTexture(data, cols, rows, RGBAFormat, FloatType)
    t.magFilter = NearestFilter
    t.minFilter = NearestFilter
    t.generateMipmaps = false
    t.needsUpdate = true
    return t
  }, [data, cols, rows])
  const geometry = useMemo(() => createPins(cols, rows), [cols, rows])
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uPins: { value: texture },
          uGrid: { value: new Vector2(cols, rows) },
          uLamp: { value: new Vector3(0, 0, WALL_LAMP.height) },
          uLampOn: { value: 0 },
          uFlare: { value: new Vector3(0, 0, FLARE.from) },
          uFlareOn: { value: 0 },
          uKey: { value: 0 },
          uResolution: { value: new Vector2(1, 1) },
        },
        vertexShader: pinVertexShader,
        fragmentShader: pinFragmentShader,
        toneMapped: false,
      }),
    [texture, cols, rows]
  )
  const mesh = useMemo(() => {
    const m = new Mesh(geometry, material)
    // The vertex shader places every pin, so the one pin's bounds mean nothing
    m.frustumCulled = false
    return m
  }, [geometry, material])
  const uniforms = material.uniforms

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      texture.dispose()
    },
    [geometry, material, texture]
  )

  const viewRef = useRef({ aspect: 1 })
  useEffect(() => {
    viewRef.current = { aspect: size.width / Math.max(1, size.height) }
    ;(uniforms.uResolution.value as Vector2).set(size.width * dpr, size.height * dpr)
  }, [size.width, size.height, dpr, uniforms])

  // ── The letters (drawn once the site's font has loaded, and again when the
  //    view changes shape, since they're sized to fit it) ──────────────────
  // Rounded so a resize only redraws when the shape really changes
  const aspectKey = Math.round((size.width / Math.max(1, size.height)) * 20) / 20
  useEffect(() => {
    let cancelled = false
    const build = () => {
      if (cancelled) return
      const box = letteringBox(aspectKey)
      setRelief(field, drawLettering(lettering, box, cols, rows))
    }
    const fonts = document.fonts
    if (fonts) {
      fonts
        .load("400 60px 'Stellar Core'")
        .catch(() => undefined)
        .then(build)
    } else {
      build()
    }
    return () => {
      cancelled = true
    }
  }, [lettering, aspectKey, field, cols, rows])

  // ── The render loop, on GSAP's ticker (after Lenis) ──────────────────────
  useEffect(() => {
    const t0 = performance.now()
    const basis = new Matrix4()
    const right = new Vector3()
    const up = new Vector3()
    const back = new Vector3()
    const lampAt = uniforms.uLamp.value as Vector3
    const flareAt = uniforms.uFlare.value as Vector3

    let visible = false
    let last = performance.now()
    let holding = false
    let press = 0 // 0 resting on the wall, 1 pressed in
    const parallax = { x: 0, y: 0 }
    let arrival: { x: number; y: number; time: number } | null = null
    let cam: WallCamera | null = null
    let u = -1
    const clicks: { sx: number; sy: number }[] = []

    const offPing = onPing((ping) => {
      if (visible)
        clicks.push({ sx: ping.x / window.innerWidth, sy: ping.y / window.innerHeight })
    })

    /** The cell under a screen point, or null if it's off the wall. */
    const cellAt = (sx: number, sy: number) => {
      if (!cam) return null
      const p = wallPoint(cam, sx, sy)
      if (!p) return null
      const cell = toCell(p.x, p.y, field)
      const inside =
        cell.col > -8 && cell.col < cols + 8 && cell.row > -8 && cell.row < rows + 8
      return inside ? { ...cell, x: p.x, y: p.y } : null
    }

    // The plane arrives: the wall is struck where it hit, and the letters
    // rise from there. Only on the way in, not when scrolling back up past
    // a plane that's already here.
    const offArrival = onPlaneArrival((at) => {
      if (!visible || u >= 0.3) return
      const cell = cellAt(at.sx, at.sy)
      if (!cell) return
      setRevealOrigin(field, cell.col, cell.row)
      const { strength, radius } = STRIKE.arrival
      strikePins(field, cell.col, cell.row, strength, radius)
      arrival = { x: cell.x, y: cell.y, time: (performance.now() - t0) / 1000 }
    })

    const onDown = (event: PointerEvent) => {
      if (event.button === 0) holding = true
    }
    const onUp = () => {
      holding = false
    }
    window.addEventListener("pointerdown", onDown, { passive: true })
    window.addEventListener("pointerup", onUp, { passive: true })
    window.addEventListener("pointercancel", onUp, { passive: true })
    window.addEventListener("blur", onUp)

    const tick = () => {
      u = readUnits()
      const wrapper = wrapperRef.current
      const clock = performance.now()
      const dt = Math.min(0.05, (clock - last) / 1000)
      last = clock
      const now = (clock - t0) / 1000

      if (u < WALL_VISIBLE_FROM || u > phases.total + WALL_EXIT_END) {
        if (visible && wrapper) {
          wrapper.style.visibility = "hidden"
          wrapper.style.opacity = "0"
        }
        visible = false
        clicks.length = 0
        arrival = null
        return
      }

      // ── Where the camera is, a little way toward the cursor ──
      const pointer = cursorOnScreen()
      const aim = pointer ?? { sx: 0.5, sy: 0.5 }
      parallax.x += ((aim.sx - 0.5) * 2 - parallax.x) * 0.04
      parallax.y += (-(aim.sy - 0.5) * 2 - parallax.y) * 0.04
      const { aspect } = viewRef.current
      const state = wallStateAt(u, phases, aspect, parallax)
      cam = state.camera

      if (!visible) {
        // Coming (back) into view: the pins start at rest, and the letters
        // rise from their own middle unless the plane arrives to say otherwise
        const box = letteringBox(aspect)
        setRevealOrigin(field, box.col, box.row)
        settlePins(field, {
          reveal: state.reveal,
          time: now,
          press: null,
          hole:
            state.hole > 0
              ? { col: (cols - 1) / 2, row: (rows - 1) / 2, radius: state.hole }
              : null,
        })
      }
      visible = true
      if (wrapper) {
        wrapper.style.visibility = "visible"
        wrapper.style.opacity = state.opacity.toFixed(3)
      }

      camera.position.set(cam.position.x, cam.position.y, cam.position.z)
      right.set(cam.right.x, cam.right.y, cam.right.z)
      up.set(cam.up.x, cam.up.y, cam.up.z)
      back.set(-cam.forward.x, -cam.forward.y, -cam.forward.z)
      camera.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, back))
      camera.updateMatrixWorld()

      // ── The plane coming in: its light on the wall where it's heading ──
      const sighting = planeSighting()
      let flare = 0
      if (sighting && sighting.flight < PLANE_ARRIVAL) {
        const coming = smoothstep(0.35, PLANE_ARRIVAL, sighting.flight)
        const spot = cam ? wallPoint(cam, sighting.sx, sighting.sy) : null
        if (spot && coming > 0) {
          flareAt.set(spot.x, spot.y, mix(FLARE.from, FLARE.to, coming))
          flare = coming * coming * 1.4
        }
      }
      if (arrival) {
        const age = now - arrival.time
        const flash = FLARE.flash * Math.exp(-age * FLARE.fade)
        if (flash > 0.01) {
          flareAt.set(arrival.x, arrival.y, FLARE.to)
          flare = Math.max(flare, flash)
        }
      }
      uniforms.uFlareOn.value = flare

      // ── The visitor's light and fingertip, under the cursor ──
      press += ((holding ? 1 : 0) - press) * (holding ? FINGER.ease.down : FINGER.ease.up)
      let finger: Press | null = null
      const under = pointer && state.lamp > 0 ? cellAt(pointer.sx, pointer.sy) : null
      if (under) {
        lampAt.set(under.x, under.y, WALL_LAMP.height)
        finger = {
          col: under.col,
          row: under.row,
          radius: mix(FINGER.hover.radius, FINGER.hold.radius, press),
          depth: mix(FINGER.hover.depth, FINGER.hold.depth, press) * state.lamp,
        }
      }
      const lampOn = under ? state.lamp : 0
      uniforms.uLampOn.value += (lampOn - uniforms.uLampOn.value) * 0.12
      uniforms.uKey.value = state.key

      // ── Clicks strike the wall ──
      for (const click of clicks) {
        const cell = cellAt(click.sx, click.sy)
        if (cell) {
          const { strength, radius } = STRIKE.click
          strikePins(field, cell.col, cell.row, strength * clamp(state.lamp * 2), radius)
        }
      }
      clicks.length = 0

      // ── The pins ──
      const hole =
        state.hole > 0
          ? { col: (cols - 1) / 2, row: (rows - 1) / 2, radius: state.hole }
          : null
      stepPins(field, dt, { reveal: state.reveal, time: now, press: finger, hole })
      const lampCell = { col: 0, row: 0, height: WALL_LAMP.height, on: 0 }
      if (under) {
        lampCell.col = under.col
        lampCell.row = under.row
        lampCell.on = uniforms.uLampOn.value
      }
      shadePins(field, lampCell, data)
      texture.needsUpdate = true

      advance(clock)
    }

    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      offPing()
      offArrival()
      window.removeEventListener("pointerdown", onDown)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
      window.removeEventListener("blur", onUp)
    }
  }, [
    advance,
    camera,
    cols,
    data,
    field,
    phases,
    readUnits,
    rows,
    texture,
    uniforms,
    wrapperRef,
  ])

  return <primitive object={mesh} />
}
