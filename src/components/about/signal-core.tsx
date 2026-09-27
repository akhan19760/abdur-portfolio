/**
 * SignalCore — the About section's 3D world.
 *
 * A faceted crystal in a wireframe shell at the vanishing point, with 2,600
 * particles around it. The particles are the thread through the whole
 * section: they take a new shape for every layer and flock from one to the
 * next as the visitor dives —
 *   01 Signal    → a sparse shell around the crystal, dust far out in space
 *   02 Origin    → a spiral galaxy (the sky the story is written in)
 *   03 Field log → a double helix (the record, turning behind the case files)
 *   04 Status    → planetary rings around the crystal
 * Each layer holds its shape while it's being explored (`windows`, from the
 * depth timeline) and morphs in between, every particle on its own delay,
 * arcing sideways as it goes.
 *
 * Readability comes first: particles are faint and mostly purple, and every
 * particle near the middle of the view is dimmed (centreDimming), so text in
 * front always sits on darkness.
 *
 * - Cursor: a purple point light follows the lerped cursor across the
 *   crystal's facets, the crystal turns toward it, and the camera floats
 *   toward it for real parallax on the particles.
 * - Pings (lib/ping): every click swells the particles and flares the light.
 * - Finale — dawn: when the signal locks (`burstRef`, tweened by the section)
 *   or the scroll reaches the end (`dispersalStart`), the crystal quietly
 *   folds into nothing and the particles flow down into the glowing horizon
 *   of a vast planet along the bottom of the view, embers rising off it,
 *   while "Open to work" rises in the dark above. The camera stops drifting
 *   with the cursor as it forms, so the horizon holds still for the Work
 *   section's sea, which locks onto it as About scrolls away.
 *
 * Budget: 4 draw calls, 2,600 points, pixel ratio capped at 1.5, render loop
 * stopped while the section is off screen.
 *
 * This module pulls in three.js, so the section loads it with React.lazy and
 * it is NOT re-exported from the about components barrel, to keep it in its
 * own chunk. Decorative only: aria-hidden, no pointer events. Only mounted in
 * depth mode (every device, unless reduced motion is on).
 * Verified manually in-browser (R3F, per the `testing` skill).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { RefObject } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { AdditiveBlending, CanvasTexture, Color, MathUtils, Vector3 } from "three"
import type {
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PointLight,
  Points,
  PointsMaterial,
  Sprite,
  SpriteMaterial,
} from "three"
import { cn } from "@/lib/utils"
import { onPing } from "@/lib/ping"
import {
  centreDimming,
  dispersalAt,
  formationBlend,
  galaxyFormation,
  helixFormation,
  horizonFormation,
  ringsFormation,
  seededRandom,
  shellCloudFormation,
  staggeredMorph,
  toNdc,
} from "./signal-core-utils"

// ── Particles ─────────────────────────────────────────────────────────────────
const POINT_COUNT = 2600
const POINT_OPACITY = 0.55
const SWIRL = 1.4 // world units particles arc sideways mid-morph
const PING_SWELL = 0.1 // particles push out by this fraction on a ping

// Brand purple (#9900fa, --color-accent) and its tints, as literal colours
// because three.js can't read CSS variables. Mostly purple, very little white.
const ACCENT = "#9900fa"
const PALETTE = ["#9900fa", "#b44dff", "#c084fc", "#e9d5ff", "#ffffff"]
const PALETTE_WEIGHTS = [0.3, 0.34, 0.27, 0.07, 0.02]

// ── Per formation: 0 shell · 1 galaxy · 2 helix · 3 rings ─────────────────────
const CAMERA_Z = [7.5, 10.5, 9, 8]
const CAMERA_SWAY = [0.5, 1.6, 0.9, 0.8] // how far the camera floats toward the cursor
const CRYSTAL_SCALE = [1, 0.5, 0.001, 1.1]
const WIRE_OPACITY = [0.35, 0.1, 0, 0.16]
const POINT_SIZE = [0.034, 0.04, 0.032, 0.034]

const SHELL_SPIN = 0.12 // rad/s
const GALAXY_SPIN = 0.06
const GALAXY_TILT = -1.1 // rad around x — the disc seen at an angle
const HELIX_SPIN = 0.35
const RINGS_SPIN = 0.14
const RINGS_TILT_X = 1.22
const RINGS_TILT_Z = 0.28

// ── Finale (dawn) ─────────────────────────────────────────────────────────────
const HORIZON_RIM_Y = -1.6
const EMBER_EVERY = 12 // every nth particle rises off the horizon as an ember
const EMBER_RISE = 4.2 // world units an ember climbs before fading out

// ── Crystal & light ───────────────────────────────────────────────────────────
const TILT_Y = 0.45 // rad of yaw toward the cursor at the screen edge
const TILT_X = 0.3
const LIGHT_SPREAD_X = 3.4 // how far the light roams
const LIGHT_SPREAD_Y = 2.2
const LIGHT_DEPTH = 2.8 // light sits this far in front of the core
const LIGHT_INTENSITY = 60
const PING_FLARE = 100
const PULSE_DECAY = 0.93 // per frame

type SignalCoreProps = {
  /** Scroll progress through the About section (0–1). */
  progressRef: RefObject<number>
  /** 0–1 finale driven by play (all satellites caught). */
  burstRef?: RefObject<number>
  /** Scroll progress at which the finale plays on its own. */
  dispersalStart?: number
  /** Progress windows ([start, end]) in which each formation holds still. */
  windows?: readonly (readonly [number, number])[]
  /** False while About isn't showing yet (e.g. under the Hero): nothing renders. */
  active?: boolean
  className?: string
}

export function SignalCore({
  progressRef,
  burstRef,
  dispersalStart = 0.9,
  windows = [],
  active = true,
  className,
}: SignalCoreProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = wrapperRef.current
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry.isIntersecting)
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={wrapperRef}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
    >
      <Canvas
        // R3F sets pointer-events: auto inline on its container, which would
        // take clicks meant for the Hero under About; only inline style overrides it
        style={{ pointerEvents: "none" }}
        dpr={[1, 1.5]}
        frameloop={inView && active ? "always" : "never"}
        camera={{ position: [0, 0, CAMERA_Z[0]], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <CoreScene
          progressRef={progressRef}
          burstRef={burstRef}
          dispersalStart={dispersalStart}
          windows={windows}
        />
      </Canvas>
    </div>
  )
}

type CoreSceneProps = {
  progressRef: RefObject<number>
  burstRef?: RefObject<number>
  dispersalStart: number
  windows: readonly (readonly [number, number])[]
}

/** A soft radial glow, for the dawn light behind the horizon. */
function dawnTexture(): CanvasTexture {
  const canvas = document.createElement("canvas")
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext("2d")
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, "rgba(192,132,252,0.9)")
    g.addColorStop(0.4, "rgba(153,0,250,0.35)")
    g.addColorStop(1, "rgba(153,0,250,0)")
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 128, 128)
  }
  return new CanvasTexture(canvas)
}

function CoreScene({ progressRef, burstRef, dispersalStart, windows }: CoreSceneProps) {
  const { camera, gl } = useThree()

  const coreGroupRef = useRef<Group>(null)
  const fieldGroupRef = useRef<Group>(null)
  const crystalRef = useRef<Mesh>(null)
  const crystalMaterialRef = useRef<MeshStandardMaterial>(null)
  const wireRef = useRef<Mesh>(null)
  const wireMaterialRef = useRef<MeshBasicMaterial>(null)
  const pointsRef = useRef<Points>(null)
  const pointsMaterialRef = useRef<PointsMaterial>(null)
  const lightRef = useRef<PointLight>(null)
  const dawnRef = useRef<Sprite>(null)

  // ── Particle data (fixed on mount) ──────────────────────────────────────
  const particles = useMemo(() => {
    const random = seededRandom(91)
    const baseColors = new Float32Array(POINT_COUNT * 3)
    const color = new Color()
    const delays = new Float32Array(POINT_COUNT)
    const swirl = new Float32Array(POINT_COUNT * 3)
    for (let i = 0; i < POINT_COUNT; i++) {
      let pick = random()
      let c = 0
      while (c < PALETTE.length - 1 && pick > PALETTE_WEIGHTS[c])
        pick -= PALETTE_WEIGHTS[c++]
      color.set(PALETTE[c])
      baseColors[i * 3] = color.r
      baseColors[i * 3 + 1] = color.g
      baseColors[i * 3 + 2] = color.b
      delays[i] = random()
      // A random sideways direction for the arc each particle takes mid-morph
      const z = random() * 2 - 1
      const theta = random() * Math.PI * 2
      const s = Math.sqrt(1 - z * z)
      swirl[i * 3] = Math.cos(theta) * s
      swirl[i * 3 + 1] = z
      swirl[i * 3 + 2] = Math.sin(theta) * s
    }
    return {
      shell: shellCloudFormation(POINT_COUNT, seededRandom(7)),
      galaxy: galaxyFormation(POINT_COUNT, seededRandom(11)),
      helix: helixFormation(POINT_COUNT, seededRandom(23)),
      rings: ringsFormation(POINT_COUNT, seededRandom(37)),
      horizon: horizonFormation(POINT_COUNT, seededRandom(53), 16, HORIZON_RIM_Y),
      positions: new Float32Array(POINT_COUNT * 3),
      colors: new Float32Array(baseColors),
      baseColors,
      delays,
      swirl,
    }
  }, [])

  const dawn = useMemo(() => dawnTexture(), [])
  useEffect(() => () => dawn.dispose(), [dawn])

  const lightTarget = useMemo(() => new Vector3(0, 0, LIGHT_DEPTH), [])
  const scratch = useMemo(() => ({ a: new Vector3(), b: new Vector3() }), [])
  const motion = useRef({ tiltX: 0, tiltY: 0, pulse: 0 })

  useEffect(
    () =>
      onPing(() => {
        motion.current.pulse = 1
      }),
    []
  )

  useFrame((state) => {
    const coreGroup = coreGroupRef.current
    const fieldGroup = fieldGroupRef.current
    const light = lightRef.current
    const points = pointsRef.current
    if (!coreGroup || !fieldGroup || !light || !points) return

    const m = motion.current
    const time = state.clock.elapsedTime
    const progress = progressRef.current ?? 0
    const { from, to, t } = formationBlend(progress, windows)
    const e = t * t * (3 - 2 * t)
    const mix = (values: readonly number[]) =>
      values[from] + (values[to] - values[from]) * e
    const finale = Math.max(
      dispersalAt(progress, dispersalStart, Math.min(1, dispersalStart + 0.08)),
      burstRef?.current ?? 0
    )
    m.pulse *= PULSE_DECAY

    // ── Cursor: light, tilt, camera float ─────────────────────────────────
    const root = document.documentElement.style
    const cx = parseFloat(root.getPropertyValue("--cursor-x"))
    const cy = parseFloat(root.getPropertyValue("--cursor-y"))
    const ndc =
      Number.isFinite(cx) && Number.isFinite(cy)
        ? toNdc(cx, cy, gl.domElement.getBoundingClientRect())
        : { x: 0, y: 0 }

    lightTarget.set(ndc.x * LIGHT_SPREAD_X, ndc.y * LIGHT_SPREAD_Y, LIGHT_DEPTH)
    light.position.lerp(lightTarget, 0.12)
    light.intensity = LIGHT_INTENSITY + m.pulse * PING_FLARE

    m.tiltY = MathUtils.lerp(m.tiltY, ndc.x * TILT_Y, 0.06)
    m.tiltX = MathUtils.lerp(m.tiltX, -ndc.y * TILT_X, 0.06)
    coreGroup.rotation.set(m.tiltX, time * SHELL_SPIN + m.tiltY, 0)
    // The view settles as the dawn forms, so the horizon holds still where the
    // Work section's sea picks it up (see ABOUT_HORIZON_Y in sea-choreography)
    const settle = 1 - finale
    fieldGroup.rotation.set(m.tiltX * 0.4 * settle, m.tiltY * 0.4 * settle, 0)

    const sway = mix(CAMERA_SWAY) * settle
    camera.position.x = MathUtils.lerp(camera.position.x, ndc.x * sway, 0.05)
    camera.position.y = MathUtils.lerp(camera.position.y, ndc.y * sway * 0.6, 0.05)
    camera.position.z = mix(CAMERA_Z)
    camera.lookAt(0, 0, 0)

    // ── Particles: place each formation, morph, swell, dawn ──────────────
    const shellAngle = time * SHELL_SPIN
    const galaxyAngle = time * GALAXY_SPIN
    const helixAngle = time * HELIX_SPIN
    const ringsAngle = time * RINGS_SPIN
    const sh = [Math.cos(shellAngle), Math.sin(shellAngle)]
    const ga = [Math.cos(galaxyAngle), Math.sin(galaxyAngle)]
    const gt = [Math.cos(GALAXY_TILT), Math.sin(GALAXY_TILT)]
    const he = [Math.cos(helixAngle), Math.sin(helixAngle)]
    const ri = [Math.cos(ringsAngle), Math.sin(ringsAngle)]
    const rx = [Math.cos(RINGS_TILT_X), Math.sin(RINGS_TILT_X)]
    const rz = [Math.cos(RINGS_TILT_Z), Math.sin(RINGS_TILT_Z)]

    const place = (formation: number, i: number, out: Vector3) => {
      const o = i * 3
      if (formation === 0) {
        const x = particles.shell[o]
        const z = particles.shell[o + 2]
        return out.set(
          x * sh[0] + z * sh[1],
          particles.shell[o + 1],
          -x * sh[1] + z * sh[0]
        )
      }
      if (formation === 1) {
        const bx = particles.galaxy[o]
        const by = particles.galaxy[o + 1]
        const bz = particles.galaxy[o + 2]
        const x = bx * ga[0] + bz * ga[1]
        const z = -bx * ga[1] + bz * ga[0]
        return out.set(x, by * gt[0] - z * gt[1], by * gt[1] + z * gt[0])
      }
      if (formation === 2) {
        const bx = particles.helix[o]
        const bz = particles.helix[o + 2]
        return out.set(
          bx * he[0] + bz * he[1],
          particles.helix[o + 1],
          -bx * he[1] + bz * he[0]
        )
      }
      const bx = particles.rings[o]
      const by = particles.rings[o + 1]
      const bz = particles.rings[o + 2]
      const x1 = bx * ri[0] + bz * ri[1]
      const z1 = -bx * ri[1] + bz * ri[0]
      const y2 = by * rx[0] - z1 * rx[1]
      const z2 = by * rx[1] + z1 * rx[0]
      return out.set(x1 * rz[0] - y2 * rz[1], x1 * rz[1] + y2 * rz[0], z2)
    }

    // The dawn horizon; every EMBER_EVERY-th particle drifts up off it instead
    const placeDawn = (i: number, out: Vector3) => {
      const o = i * 3
      out.set(particles.horizon[o], particles.horizon[o + 1], particles.horizon[o + 2])
      if (i % EMBER_EVERY === 0) {
        const delay = particles.delays[i]
        const rise = (time * 0.08 * (0.6 + delay) + delay) % 1
        out.x += Math.sin(time * 0.6 + i) * 0.2
        out.y = HORIZON_RIM_Y + rise * EMBER_RISE
      }
      return out
    }

    const { a, b } = scratch
    const pos = particles.positions
    const col = particles.colors
    const base = particles.baseColors
    const swell = 1 + m.pulse * PING_SWELL
    for (let i = 0; i < POINT_COUNT; i++) {
      place(from, i, a)
      if (to !== from) {
        place(to, i, b)
        const lt = staggeredMorph(t, particles.delays[i])
        const arc = Math.sin(Math.PI * lt) * SWIRL
        a.lerp(b, lt)
        a.x += particles.swirl[i * 3] * arc
        a.y += particles.swirl[i * 3 + 1] * arc
        a.z += particles.swirl[i * 3 + 2] * arc
      }
      a.multiplyScalar(swell)

      let fade = 1
      if (finale > 0) {
        placeDawn(i, b)
        const lf = staggeredMorph(finale, particles.delays[i], 0.5)
        const arc = Math.sin(Math.PI * lf) * SWIRL * 0.6
        a.lerp(b, lf)
        a.x += particles.swirl[i * 3] * arc
        a.y += particles.swirl[i * 3 + 1] * arc
        // Embers fade as they climb toward the text
        if (i % EMBER_EVERY === 0)
          fade = 1 - lf * Math.min(1, Math.max(0, (a.y - HORIZON_RIM_Y) / EMBER_RISE))
      }

      pos[i * 3] = a.x
      pos[i * 3 + 1] = a.y
      pos[i * 3 + 2] = a.z

      // Dim everything near the middle of the view, where the text sits
      const k = centreDimming(Math.hypot(a.x, a.y)) * fade
      col[i * 3] = base[i * 3] * k
      col[i * 3 + 1] = base[i * 3 + 1] * k
      col[i * 3 + 2] = base[i * 3 + 2] * k
    }
    points.geometry.getAttribute("position").needsUpdate = true
    points.geometry.getAttribute("color").needsUpdate = true

    if (pointsMaterialRef.current) pointsMaterialRef.current.size = mix(POINT_SIZE)

    // ── Crystal: size per layer; folds away quietly for the dawn ─────────
    const fold = 1 - MathUtils.smootherstep(finale, 0, 0.45)
    crystalRef.current?.scale.setScalar(Math.max(mix(CRYSTAL_SCALE) * fold, 0.001))
    wireRef.current?.scale.setScalar(Math.max(fold, 0.001))
    if (crystalMaterialRef.current) {
      crystalMaterialRef.current.emissiveIntensity =
        0.08 + Math.sin(Math.PI * Math.min(1, finale / 0.45)) * 0.35
    }
    if (wireMaterialRef.current)
      wireMaterialRef.current.opacity = mix(WIRE_OPACITY) * fold

    // ── Dawn light behind the horizon, well below the text ───────────────
    if (dawnRef.current) {
      const grow = 1 - (1 - finale) ** 3
      dawnRef.current.scale.set(
        10 * Math.max(grow, 0.001),
        3.2 * Math.max(grow, 0.001),
        1
      )
      ;(dawnRef.current.material as SpriteMaterial).opacity = finale * 0.2
    }
  })

  return (
    <>
      <ambientLight intensity={0.12} />
      <pointLight
        ref={lightRef}
        color="#b44dff"
        intensity={LIGHT_INTENSITY}
        distance={16}
        decay={2}
        position={[0, 0, LIGHT_DEPTH]}
      />

      <group ref={coreGroupRef}>
        {/* Faceted crystal — lit by the cursor light */}
        <mesh ref={crystalRef}>
          <icosahedronGeometry args={[1.1, 0]} />
          <meshStandardMaterial
            ref={crystalMaterialRef}
            color="#1b0b2e"
            emissive={ACCENT}
            emissiveIntensity={0.08}
            roughness={0.35}
            metalness={0.4}
            flatShading
          />
        </mesh>

        {/* Wireframe shell */}
        <mesh ref={wireRef}>
          <icosahedronGeometry args={[1.5, 1]} />
          <meshBasicMaterial
            ref={wireMaterialRef}
            color={ACCENT}
            wireframe
            transparent
            opacity={WIRE_OPACITY[0]}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* The particles: shell → galaxy → helix → rings → dawn horizon */}
      <group ref={fieldGroupRef}>
        <points ref={pointsRef} frustumCulled={false}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              args={[particles.positions, 3]}
            />
            <bufferAttribute attach="attributes-color" args={[particles.colors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            ref={pointsMaterialRef}
            size={POINT_SIZE[0]}
            sizeAttenuation
            vertexColors
            transparent
            opacity={POINT_OPACITY}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </points>
      </group>

      {/* Dawn: a wide, soft glow rising behind the horizon */}
      <sprite ref={dawnRef} position={[0, HORIZON_RIM_Y - 1.2, -1.5]} scale={0.001}>
        <spriteMaterial
          map={dawn}
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </sprite>
    </>
  )
}
