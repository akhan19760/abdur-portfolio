/**
 * MirrorSea — the Work section's world: dark water under a night sky, with
 * each project's screen standing on it.
 *
 * It picks up where About leaves off. About ends on a dawn horizon; as
 * About's stage scrolls away, this sea's horizon is locked onto About's and
 * rises with it while the camera comes down from over the planet to the
 * water. The dawn fades and the light becomes the visitor's.
 *
 * - The cursor is a small light floating over the water: the waves glitter
 *   under it, and the screens' glass catches it.
 * - Each project's screen rises out of the water as the camera arrives and
 *   sinks as it glides on; its reflection wobbles on the waves. The screen
 *   under the cursor turns a little toward it.
 * - Clicks (lib/ping) send rings across the water; so does every screen
 *   breaking the surface.
 * - After the last project it turns to look straight down at the water and
 *   the waves go still; the Process section's sheet of paper lands on it
 *   (another ring) and the sea fades away under it.
 *
 * Rendering: one full-screen shader (mirror-sea-shader), drawn from GSAP's
 * ticker right after Lenis has moved the page, so the horizon never lags
 * About's by a frame. Nothing renders while the sea is out of range.
 *
 * Pulls in three.js: the section loads it with React.lazy, and it's not
 * re-exported from the projects barrel. Decorative only (aria-hidden, no
 * pointer events; everything it shows is in the section's text too). Only
 * mounted in immersive mode. Verified manually in-browser (R3F, per the
 * `testing` skill).
 */

import { useEffect, useMemo, useRef } from "react"
import type { RefObject } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { gsap } from "gsap"
import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  SRGBColorSpace,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from "three"
import type { IUniform } from "three"
import { cn } from "@/lib/utils"
import { onPing } from "@/lib/ping"
import type { SeaPhases } from "@/hooks/projects"
import { SEA_EXIT } from "@/hooks/projects"
import type { Project } from "@/types/projects"
import {
  cameraBasis,
  horizonDip,
  panelScreenRect,
  rayDirection,
  screenToSea,
} from "./mirror-sea-utils"
import type { SeaCamera, Vec3 } from "./mirror-sea-utils"
import {
  MAX_PANELS,
  MAX_RIPPLES,
  seaFragmentShader,
  seaVertexShader,
} from "./mirror-sea-shader"
import { isPortrait, paperScreen } from "@/lib/stage-framing"
import { PAPER_LANDING, seaStateAt } from "./sea-choreography"
import { averageSlotColors, buildAtlas } from "./sea-panels"

const LIGHT_DISTANCE = 20 // metres from the camera along the cursor's ray
const LIGHT_MIN_HEIGHT = 1.2 // never lower than this over the water
const HOVER_YAW = 0.16 // radians a screen turns toward the cursor at its edge
const RISE_RIPPLE = { radius: 8, strength: 1.3 }
const LANDING_RIPPLE = { radius: 1.1, strength: 1.2 } // from under Process's sheet
const PANEL_CULL = 60 // screens further than this from the camera (x) aren't drawn

type MirrorSeaProps = {
  /** The timeline position (screens) straight from the scroll (useSeaScroll). */
  readUnits: () => number
  phases: SeaPhases
  projects: Pick<Project, "name" | "image">[]
  /** Written on each placeholder picture, e.g. "Screenshot placeholder". */
  placeholderLabel: string
  className?: string
}

export function MirrorSea({ className, ...props }: MirrorSeaProps) {
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
        // Soft water doesn't need extra pixels; 1.25x cost over half as much again
        dpr={1}
        flat
        linear
        gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      >
        <SeaScene wrapperRef={wrapperRef} {...props} />
      </Canvas>
    </div>
  )
}

type SeaSceneProps = Omit<MirrorSeaProps, "className"> & {
  wrapperRef: RefObject<HTMLDivElement | null>
}

type Ripple = { x: number; z: number; start: number; radius: number; strength: number }

function createUniforms(): Record<string, IUniform> {
  return {
    uTime: { value: 0 },
    uResolution: { value: new Vector2(1, 1) },
    uCamPos: { value: new Vector3() },
    uCamRight: { value: new Vector3(1, 0, 0) },
    uCamUp: { value: new Vector3(0, 1, 0) },
    uCamForward: { value: new Vector3(0, 0, -1) },
    uTanHalfFov: { value: 0.33 },
    uAspect: { value: 1.6 },
    uCurvature: { value: 0 },
    uHorizonDip: { value: 0 },
    uBase: { value: new Vector3(0.003, 0.003, 0.003) },
    uDawn: { value: 1 },
    uSunDir: { value: new Vector3(0, 0, -1) },
    uLight: { value: new Vector3(0, 4, 10) },
    uLightOn: { value: 0 },
    uSwell: { value: 1 },
    uPanelCount: { value: 0 },
    uPanelX: { value: new Array<number>(MAX_PANELS).fill(0) },
    uPanelYaw: { value: new Array<number>(MAX_PANELS).fill(0) },
    uPanelRise: { value: new Array<number>(MAX_PANELS).fill(0) },
    uAtlas: { value: null },
    uAtlasGrid: { value: new Vector2(2, 1) },
    uPanelGlow: { value: Array.from({ length: MAX_PANELS }, () => new Vector3()) },
    uRipples: { value: Array.from({ length: MAX_RIPPLES }, () => new Vector4()) },
    uRippleRadius: { value: new Array<number>(MAX_RIPPLES).fill(0) },
  }
}

/**
 * The sea's material, made once and handed to the mesh as an object. Its
 * uniforms are updated in place every frame: three.js keeps hold of the
 * uniforms object a material was compiled with, so passing `uniforms` as a
 * JSX prop (which R3F may swap for another object) would leave the shader
 * reading stale values.
 */
function createMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: createUniforms(),
    vertexShader: seaVertexShader,
    fragmentShader: seaFragmentShader,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  })
}

/** The page's background colour, in linear light, so the sky matches it exactly. */
function pageBackground(): Vector3 {
  const match = getComputedStyle(document.body).backgroundColor.match(/\d+(\.\d+)?/g)
  const [r, g, b] = (match ?? ["10", "10", "10"]).map(Number)
  const lin = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return new Vector3(lin(r), lin(g), lin(b))
}

function cursorOnScreen(): { sx: number; sy: number } | null {
  const style = document.documentElement.style
  const x = parseFloat(style.getPropertyValue("--cursor-x"))
  const y = parseFloat(style.getPropertyValue("--cursor-y"))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { sx: x / window.innerWidth, sy: y / window.innerHeight }
}

/**
 * The cursor's light: a little way out along the cursor's ray, never in the
 * water. While the camera looks down at the water (`lookDown`), it comes
 * closer until it hovers just over the water under the cursor.
 */
function lightFor(
  camera: SeaCamera,
  cursor: { sx: number; sy: number } | null,
  lookDown: number
): Vec3 {
  // With no cursor (or finger) on the screen, the light rests over the
  // project's screen: right of centre, or centred up top in portrait
  const rest = isPortrait(camera.aspect) ? { sx: 0.5, sy: 0.42 } : { sx: 0.62, sy: 0.55 }
  const dir = rayDirection(camera, cursor?.sx ?? rest.sx, cursor?.sy ?? rest.sy)
  let reach = LIGHT_DISTANCE
  if (lookDown > 0 && dir.y < 0) {
    const overWater = (camera.y - LIGHT_MIN_HEIGHT) / -dir.y
    reach += (Math.min(LIGHT_DISTANCE, overWater) - LIGHT_DISTANCE) * lookDown
  }
  return {
    x: camera.x + dir.x * reach,
    y: Math.max(LIGHT_MIN_HEIGHT, camera.y + dir.y * reach),
    z: camera.z + dir.z * reach,
  }
}

function SeaScene({
  wrapperRef,
  readUnits,
  phases,
  projects,
  placeholderLabel,
}: SeaSceneProps) {
  const advance = useThree((s) => s.advance)
  const size = useThree((s) => s.size)
  const material = useMemo(createMaterial, [])
  const uniforms = material.uniforms
  useEffect(() => () => material.dispose(), [material])
  const aspect = size.width / Math.max(1, size.height)

  const aspectRef = useRef(aspect)
  useEffect(() => {
    aspectRef.current = aspect
    ;(uniforms.uResolution.value as Vector2).set(size.width, size.height)
  }, [aspect, size.width, size.height, uniforms])

  useEffect(() => {
    uniforms.uBase.value = pageBackground()
  }, [uniforms])

  // ── The pictures on the screens (redrawn once fonts load) ────────────────
  const pictureKey = JSON.stringify(projects.map((p) => [p.name, p.image ?? ""]))
  useEffect(() => {
    let cancelled = false
    let dispose = () => {}
    let texture: CanvasTexture | null = null
    const build = () => {
      if (cancelled) return
      const updateGlow = (
        canvas: HTMLCanvasElement,
        layout: Parameters<typeof averageSlotColors>[1]
      ) => {
        const glows = uniforms.uPanelGlow.value as Vector3[]
        averageSlotColors(canvas, layout, Math.min(projects.length, MAX_PANELS)).forEach(
          ([r, g, b], i) => glows[i].set(r, g, b)
        )
      }
      const atlas = buildAtlas(projects, placeholderLabel, () => {
        if (texture) texture.needsUpdate = true
        if (atlas) updateGlow(atlas.canvas, atlas.layout)
      })
      if (!atlas) return
      updateGlow(atlas.canvas, atlas.layout)
      dispose = atlas.dispose
      texture = new CanvasTexture(atlas.canvas)
      texture.colorSpace = SRGBColorSpace
      texture.minFilter = LinearMipmapLinearFilter
      texture.anisotropy = 4
      uniforms.uAtlas.value = texture
      ;(uniforms.uAtlasGrid.value as Vector2).set(atlas.layout.columns, atlas.layout.rows)
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
      dispose()
      texture?.dispose()
    }
    // pictureKey stands in for `projects`, whose identity changes every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pictureKey, placeholderLabel, uniforms])

  // ── The render loop, on GSAP's ticker (after Lenis) ──────────────────────
  useEffect(() => {
    const t0 = performance.now()
    const ripples: Ripple[] = []
    const yaw = new Array<number>(MAX_PANELS).fill(0)
    const wasUp = new Array<boolean>(MAX_PANELS).fill(false)
    let camera: SeaCamera | null = null
    let visible = false
    let landed: boolean | null = null // unknown until the first frame

    const addRipple = (ripple: Ripple) => {
      ripples.push(ripple)
      if (ripples.length > MAX_RIPPLES) ripples.shift()
    }

    const offPing = onPing((ping) => {
      if (!visible || !camera) return
      const ground = screenToSea(
        camera,
        ping.x / window.innerWidth,
        ping.y / window.innerHeight
      )
      if (ground) {
        addRipple({
          x: ground.x,
          z: ground.z,
          start: (performance.now() - t0) / 1000,
          radius: 0,
          strength: 1,
        })
      }
    })

    const tick = () => {
      const u = readUnits()
      const wrapper = wrapperRef.current
      if (u <= -0.25 || u >= phases.total + SEA_EXIT + 0.05) {
        if (visible && wrapper) {
          wrapper.style.visibility = "hidden"
          wrapper.style.opacity = "0"
        }
        visible = false
        return
      }

      const now = (performance.now() - t0) / 1000
      const aspect = aspectRef.current
      const state = seaStateAt(u, phases, aspect)
      camera = state.camera
      visible = state.opacity > 0
      if (wrapper) {
        wrapper.style.visibility = visible ? "visible" : "hidden"
        wrapper.style.opacity = state.opacity.toFixed(3)
      }
      if (!visible) return

      // ── Camera ──
      const { forward, right, up } = cameraBasis(camera)
      ;(uniforms.uCamPos.value as Vector3).set(camera.x, camera.y, camera.z)
      ;(uniforms.uCamForward.value as Vector3).set(forward.x, forward.y, forward.z)
      ;(uniforms.uCamRight.value as Vector3).set(right.x, right.y, right.z)
      ;(uniforms.uCamUp.value as Vector3).set(up.x, up.y, up.z)
      uniforms.uTanHalfFov.value = Math.tan(camera.fov / 2)
      uniforms.uAspect.value = aspect
      uniforms.uCurvature.value = camera.curvature
      const dip = horizonDip(camera.y, camera.curvature)
      uniforms.uHorizonDip.value = dip
      uniforms.uTime.value = now

      // ── Dawn: the sun sits on the horizon straight ahead ──
      const sunElevation = -dip + 0.006
      ;(uniforms.uSunDir.value as Vector3).set(
        0,
        Math.sin(sunElevation),
        -Math.cos(sunElevation)
      )
      uniforms.uDawn.value = state.dawn

      // ── The cursor's light ──
      const cursor = cursorOnScreen()
      const light = lightFor(camera, cursor, state.lookDown)
      ;(uniforms.uLight.value as Vector3).set(light.x, light.y, light.z)
      uniforms.uLightOn.value = state.light
      uniforms.uSwell.value = state.swell

      // ── Process's sheet of paper landing on the water ──
      const down = u >= phases.total + PAPER_LANDING
      if (down && landed === false) {
        const landing = paperScreen(aspect)
        const under = screenToSea(camera, landing.sx, landing.sy)
        if (under) addRipple({ x: under.x, z: under.z, start: now, ...LANDING_RIPPLE })
      }
      landed = down

      // ── Screens: rise, sink, turn toward the cursor ──
      const count = Math.min(MAX_PANELS, state.panels.length)
      uniforms.uPanelCount.value = count
      const xs = uniforms.uPanelX.value as number[]
      const rises = uniforms.uPanelRise.value as number[]
      const yaws = uniforms.uPanelYaw.value as number[]
      for (let i = 0; i < count; i++) {
        const panel = state.panels[i]
        xs[i] = panel.x
        // Screens out of sight cost the shader nothing
        rises[i] = Math.abs(panel.x - camera.x) < PANEL_CULL ? panel.rise : 0

        const risen = panel.rise > 0.02
        if (risen !== wasUp[i]) {
          addRipple({ x: panel.x, z: 0, start: now, ...RISE_RIPPLE })
          wasUp[i] = risen
        }

        let target = 0
        const rect =
          cursor && panel.rise > 0.5
            ? panelScreenRect(camera, { ...panel, yaw: 0 })
            : null
        if (rect && cursor) {
          const inside =
            cursor.sx > rect.left - 0.03 &&
            cursor.sx < rect.right + 0.03 &&
            cursor.sy > rect.top &&
            cursor.sy < rect.bottom
          const centre = (rect.left + rect.right) / 2
          const half = (rect.right - rect.left) / 2
          if (inside)
            target = Math.max(-1, Math.min(1, (cursor.sx - centre) / half)) * HOVER_YAW
        }
        yaw[i] += (target - yaw[i]) * 0.08
        yaws[i] = yaw[i]
      }

      // ── Ripples ──
      const slots = uniforms.uRipples.value as Vector4[]
      const radii = uniforms.uRippleRadius.value as number[]
      for (let i = 0; i < MAX_RIPPLES; i++) {
        const ripple = ripples[i]
        if (ripple) {
          slots[i].set(ripple.x, ripple.z, ripple.start, ripple.strength)
          radii[i] = ripple.radius
        } else {
          slots[i].set(0, 0, 0, 0)
        }
      }

      advance(performance.now())
    }

    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      offPing()
    }
  }, [advance, phases, readUnits, uniforms, wrapperRef])

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  )
}
