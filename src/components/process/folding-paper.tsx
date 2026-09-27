/**
 * FoldingPaper — the Process section's world: one sheet of paper in the
 * dark, lit by the visitor's cursor, folded into a paper plane one step at a
 * time as they scroll, until it flies away.
 *
 * It picks up where Work leaves off. Work's camera turns to look straight
 * down at the calm water; this camera looks straight down too, and the sheet
 * drifts down onto the water and settles there as the sea fades away under
 * it. The small light over the water is now the light over the paper.
 *
 * - The cursor is a warm lamp hovering over the paper: each facet is lit or
 *   in shadow depending on where it is, and the pencil notes (Discover) and
 *   fold lines (Design) show most clearly under it. The note under the
 *   cursor glows purple so it reads clearly.
 * - While it's still flat, the sheet's edge lifts a little toward the light,
 *   and a click on it sends rings running across the paper.
 * - Dust drifts in the dark around it, seen only where the light catches
 *   it; moving the light stirs it and a click blows it outward.
 * - Once it's a plane, it turns and drifts after the cursor, banks when the
 *   cursor moves fast, lights up at its edges when the cursor is over it,
 *   and does a barrel roll when clicked. When it launches it flies the way
 *   it was pointing, with a trail behind each wingtip and a small light at
 *   its tail, into the dark where Contact's wall of pins is waiting. It
 *   reports where it is on screen as it goes (lib/paper-plane), and is gone
 *   the moment it reaches the wall.
 *
 * Choreography: fold-choreography (pure, unit-tested); folds: paper-fold;
 * notes: paper-notes; shading: paper-fold-shader. Drawn from GSAP's ticker
 * right after Lenis has moved the page; nothing renders while the section
 * is out of range. Clicks arrive as the page's pings (lib/ping).
 *
 * Pulls in three.js: the section loads it with React.lazy, and it's not
 * re-exported from the process barrel. Decorative only (aria-hidden, no
 * pointer events; every step, and the notes, are in the section's text).
 * Only mounted in immersive mode. Verified manually in-browser (R3F, per the
 * `testing` skill).
 */

import { useEffect, useMemo, useRef } from "react"
import type { RefObject } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { gsap } from "gsap"
import {
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DoubleSide,
  Euler,
  Line,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  Points,
  Quaternion,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
} from "three"
import type { Group, PerspectiveCamera } from "three"
import { cn } from "@/lib/utils"
import { onPing } from "@/lib/ping"
import { PLANE_ARRIVAL, trackPlane } from "@/lib/paper-plane"
import { paperScreen } from "@/lib/stage-framing"
import type { FoldPhases } from "@/hooks/process"
import {
  PAPER_FOV,
  PAPER_PIVOT,
  clamp,
  flightPath,
  lampPosition,
  paperStateAt,
  projectToScreen,
} from "./fold-choreography"
import type { PaperCamera, PaperPose } from "./fold-choreography"
import {
  FOLDS,
  KEEL_DEPTH,
  NOSE_Z,
  SHEET_LENGTH,
  SHEET_WIDTH,
  TAIL_Z,
  WINGTIPS,
  buildSheet,
} from "./paper-fold"
import {
  PAPER_RIPPLES,
  dustFragmentShader,
  dustVertexShader,
  paperFragmentShader,
  paperVertexShader,
  tailFragmentShader,
  tailVertexShader,
  trailFragmentShader,
  trailVertexShader,
} from "./paper-fold-shader"
import { NOTE_ITEMS, drawNotes, noteAt } from "./paper-notes"
import type { NoteRegion } from "./paper-notes"

// A fold bends within one grid cell, so the grid is fine (~1.25 mm)
const GRID = { columns: 168, rows: 238 }
const TRAIL_POINTS = 48
const TRAIL_SPAN = 0.3 // how much of the flight each trail reaches back over
const AIM = {
  /** Radians the plane turns per screen-width the cursor is from it. */
  gain: 1.4,
  yaw: 0.5,
  pitch: 0.3,
  /** How far it drifts toward the cursor (units, across and up the view). */
  drift: 0.28,
  /** Most it banks when the cursor moves fast (radians). */
  bank: 0.45,
  /** The flight's direction can follow the aim only this far. */
  flightYaw: 0.28,
  flightPitch: 0.12,
  ease: 0.06,
}
const ROLL = { duration: 0.95, hop: 0.22 }
const DUST = { count: 260, x: 2.8, yMin: 0.05, yMax: 2.6, z: 2.6, push: 1.6 }
/** Default spot for the light before the cursor has moved (0–1 across/down). */
// Where the light rests with no cursor (or finger): a little above the paper
const restingLight = (aspect: number) => {
  const place = paperScreen(aspect)
  return { sx: place.sx, sy: place.sy - 0.1 }
}

type FoldingPaperProps = {
  /** The timeline position (screens) straight from the scroll (useFoldScroll). */
  readUnits: () => number
  phases: FoldPhases
  /** The pencil notes jotted on the sheet during Discover. */
  notes: string[]
  className?: string
}

export function FoldingPaper({ className, ...props }: FoldingPaperProps) {
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
        camera={{ fov: 35, near: 0.05, far: 200 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      >
        <PaperScene wrapperRef={wrapperRef} {...props} />
      </Canvas>
    </div>
  )
}

type PaperSceneProps = Omit<FoldingPaperProps, "className"> & {
  wrapperRef: RefObject<HTMLDivElement | null>
}

function cursorOnScreen(): { sx: number; sy: number } | null {
  const style = document.documentElement.style
  const x = parseFloat(style.getPropertyValue("--cursor-x"))
  const y = parseFloat(style.getPropertyValue("--cursor-y"))
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  return { sx: x / window.innerWidth, sy: y / window.innerHeight }
}

function createSheet(): BufferGeometry {
  const sheet = buildSheet(GRID.columns, GRID.rows)
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(sheet.positions, 3))
  geometry.setAttribute("aMask", new BufferAttribute(sheet.masks, 1))
  geometry.setAttribute("aCreaseA", new BufferAttribute(sheet.creasesA, 4))
  geometry.setAttribute("aCreaseB", new BufferAttribute(sheet.creasesB, 4))
  geometry.setIndex(new BufferAttribute(sheet.indices, 1))
  return geometry
}

/**
 * The paper's material, made once. Its uniforms are updated in place every
 * frame (three.js keeps the uniforms object a material was compiled with).
 */
function createPaperMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uFoldPoint: {
        value: FOLDS.map((f) => new Vector3(f.point.x, f.point.y, f.point.z)),
      },
      uFoldDir: { value: FOLDS.map((f) => new Vector3(f.dir.x, f.dir.y, f.dir.z)) },
      uFoldAngle: { value: FOLDS.map(() => 0) },
      uTime: { value: 0 },
      uRipples: { value: Array.from({ length: PAPER_RIPPLES }, () => new Vector4()) },
      uCurl: { value: 0 },
      uCurlAt: { value: new Vector2() },
      uLamp: { value: new Vector3(0, 1.3, 0) },
      uNotes: { value: 0 },
      uLines: { value: 0 },
      uDraw: { value: 0 },
      uNotesMap: { value: null },
      uHasNotes: { value: 0 },
      uNoteGlow: { value: new Array<number>(NOTE_ITEMS).fill(0) },
      uHighlight: { value: 0 },
    },
    vertexShader: paperVertexShader,
    fragmentShader: paperFragmentShader,
    side: DoubleSide,
    toneMapped: false,
  })
}

function createTrail(): Line {
  const geometry = new BufferGeometry()
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(TRAIL_POINTS * 3), 3)
  )
  const ages = new Float32Array(TRAIL_POINTS).map((_, i) => i / (TRAIL_POINTS - 1))
  geometry.setAttribute("aAge", new BufferAttribute(ages, 1))
  const material = new ShaderMaterial({
    uniforms: { uOn: { value: 0 } },
    vertexShader: trailVertexShader,
    fragmentShader: trailFragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  })
  const line = new Line(geometry, material)
  line.frustumCulled = false
  return line
}

function createTailLight(): Points {
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(3), 3))
  const material = new ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uSize: { value: 10 } },
    vertexShader: tailVertexShader,
    fragmentShader: tailFragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  return points
}

type Dust = {
  points: Points
  /** Where each speck drifts about (xyz). */
  home: Float32Array
  velocity: Float32Array
  seeds: Float32Array
}

/** Specks scattered through the dark around the paper (the same every time). */
function createDust(): Dust {
  let s = 11
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const home = new Float32Array(DUST.count * 3)
  const seeds = new Float32Array(DUST.count)
  for (let i = 0; i < DUST.count; i++) {
    home[i * 3] = (rand() * 2 - 1) * DUST.x
    home[i * 3 + 1] = DUST.yMin + rand() * (DUST.yMax - DUST.yMin)
    home[i * 3 + 2] = (rand() * 2 - 1) * DUST.z
    seeds[i] = rand()
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute("position", new BufferAttribute(home.slice(), 3))
  geometry.setAttribute("aSeed", new BufferAttribute(seeds, 1))
  const material = new ShaderMaterial({
    uniforms: {
      uLamp: { value: new Vector3() },
      uOn: { value: 0 },
      uScale: { value: 1000 },
    },
    vertexShader: dustVertexShader,
    fragmentShader: dustFragmentShader,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    toneMapped: false,
  })
  const points = new Points(geometry, material)
  points.frustumCulled = false
  return { points, home, velocity: new Float32Array(DUST.count * 3), seeds }
}

const pivot = new Vector3(PAPER_PIVOT.x, PAPER_PIVOT.y, PAPER_PIVOT.z)

type Scratch = { q: Quaternion; e: Euler; v: Vector3 }

/** The paper's placement as a matrix: turned about PAPER_PIVOT, then moved. */
function poseMatrix(pose: PaperPose, out: Matrix4, scratch: Scratch) {
  scratch.e.set(pose.pitch, pose.yaw, pose.roll, "YXZ")
  scratch.q.setFromEuler(scratch.e)
  out.makeRotationFromQuaternion(scratch.q)
  // p' = R (p − pivot) + pivot + offset
  const offset = scratch.v.copy(pivot).applyMatrix4(out).negate().add(pivot)
  out.setPosition(offset.x + pose.x, offset.y + pose.y, offset.z + pose.z)
  return out
}

/** Turns a flight offset by the aim the plane had when it left. */
function aimedFlight(f: number, yaw: number, pitch: number, from: PaperPose): PaperPose {
  const path = flightPath(f)
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  const cp = Math.cos(pitch)
  const sp = Math.sin(pitch)
  // Pitch about x, then yaw about y
  const y1 = path.y * cp - path.z * sp
  const z1 = path.y * sp + path.z * cp
  return {
    x: from.x + path.x * cy + z1 * sy,
    y: from.y + y1,
    z: from.z - path.x * sy + z1 * cy,
    pitch: path.pitch + pitch,
    yaw: path.yaw + yaw,
    roll: path.roll,
  }
}

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2

function PaperScene({ wrapperRef, readUnits, phases, notes }: PaperSceneProps) {
  const advance = useThree((s) => s.advance)
  const size = useThree((s) => s.size)
  const dpr = useThree((s) => s.viewport.dpr)
  const camera = useThree((s) => s.camera) as PerspectiveCamera

  const geometry = useMemo(createSheet, [])
  const material = useMemo(createPaperMaterial, [])
  const mesh = useMemo(() => {
    const m = new Mesh(geometry, material)
    // The vertex shader moves everything, so the flat sheet's bounds mean nothing
    m.frustumCulled = false
    return m
  }, [geometry, material])
  const trails = useMemo(() => [createTrail(), createTrail()], [])
  const tail = useMemo(createTailLight, [])
  const dust = useMemo(createDust, [])
  const groupRef = useRef<Group>(null)
  const uniforms = material.uniforms

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
      for (const t of trails) {
        t.geometry.dispose()
        ;(t.material as ShaderMaterial).dispose()
      }
      for (const p of [tail, dust.points]) {
        p.geometry.dispose()
        ;(p.material as ShaderMaterial).dispose()
      }
    },
    [geometry, material, trails, tail, dust]
  )

  const viewRef = useRef({ aspect: 1, pxPerUnit: 1000 })
  useEffect(() => {
    viewRef.current = {
      aspect: size.width / Math.max(1, size.height),
      // Point sizes: px per unit of size at a distance of 1
      pxPerUnit: (size.height * dpr) / (2 * Math.tan(PAPER_FOV / 2)),
    }
  }, [size.width, size.height, dpr])

  // ── The pencil notes (drawn once the site's font has loaded) ─────────────
  const notesKey = notes.join("\n")
  const drawingRef = useRef<{ regions: NoteRegion[]; width: number; height: number }>({
    regions: [],
    width: 1,
    height: 1,
  })
  useEffect(() => {
    let cancelled = false
    let texture: CanvasTexture | null = null
    const build = () => {
      if (cancelled) return
      const drawing = drawNotes(notesKey.split("\n").filter(Boolean))
      if (!drawing) return
      texture = new CanvasTexture(drawing.canvas)
      texture.minFilter = LinearMipmapLinearFilter
      texture.anisotropy = 4
      // Premultiplied, so blurred (mipmapped) texels keep each note's ID intact
      texture.premultiplyAlpha = true
      drawingRef.current = {
        regions: drawing.regions,
        width: drawing.canvas.width,
        height: drawing.canvas.height,
      }
      uniforms.uNotesMap.value = texture
      uniforms.uHasNotes.value = 1
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
      uniforms.uHasNotes.value = 0
      drawingRef.current = { regions: [], width: 1, height: 1 }
      texture?.dispose()
    }
  }, [notesKey, uniforms])

  // ── The render loop, on GSAP's ticker (after Lenis) ──────────────────────
  useEffect(() => {
    const t0 = performance.now()
    const basis = new Matrix4()
    const right = new Vector3()
    const up = new Vector3()
    const back = new Vector3()
    const plane = new Matrix4()
    const inverse = new Matrix4()
    const model = new Matrix4()
    const scratch: Scratch = { q: new Quaternion(), e: new Euler(), v: new Vector3() }
    const tip = new Vector3()
    const origin = new Vector3()
    const ray = new Vector3()
    const tips = WINGTIPS.map((w) => new Vector3(w.x, w.y, w.z))
    const tailPoint = new Vector3(0, KEEL_DEPTH * 0.6, TAIL_Z - 0.15)
    const angles = uniforms.uFoldAngle.value as number[]
    const glows = uniforms.uNoteGlow.value as number[]
    const ripples = uniforms.uRipples.value as Vector4[]
    const curlAt = uniforms.uCurlAt.value as Vector2
    const dustMaterial = dust.points.material as ShaderMaterial
    const dustPositions = dust.points.geometry.getAttribute("position") as BufferAttribute

    const aim = { yaw: 0, pitch: 0, driftX: 0, driftY: 0, bank: 0 }
    let launch: { yaw: number; pitch: number; from: PaperPose } | null = null
    let roll: { start: number; side: number } | null = null
    let highlight = 0
    let rippleSlot = 0
    let landed: boolean | null = null // unknown until the first frame
    let visible = false
    let last = performance.now()
    let lastCursor: { sx: number; sy: number } | null = null
    let lastLamp: Vector3 | null = null
    const lampVelocity = new Vector3()
    const clicks: { sx: number; sy: number }[] = []

    const offPing = onPing((ping) => {
      if (visible)
        clicks.push({ sx: ping.x / window.innerWidth, sy: ping.y / window.innerHeight })
    })

    const addRipple = (x: number, z: number, start: number, strength: number) => {
      ripples[rippleSlot].set(x, z, start, strength)
      rippleSlot = (rippleSlot + 1) % PAPER_RIPPLES
    }

    /** Where the ray through a screen point meets the paper, in its own flat coordinates. */
    const onSheet = (cam: PaperCamera, sx: number, sy: number) => {
      const at = lampPosition(cam, sx, sy)
      origin.set(cam.position.x, cam.position.y, cam.position.z).applyMatrix4(inverse)
      ray
        .set(at.x - cam.position.x, at.y - cam.position.y, at.z - cam.position.z)
        .transformDirection(inverse)
      if (Math.abs(ray.y) < 1e-4) return null
      const t = -origin.y / ray.y
      if (t <= 0) return null
      const x = origin.x + ray.x * t
      const z = origin.z + ray.z * t
      const inside = Math.abs(x) <= SHEET_WIDTH / 2 && Math.abs(z) <= SHEET_LENGTH / 2
      return { x, z, inside }
    }

    const tick = () => {
      const u = readUnits()
      const wrapper = wrapperRef.current
      const group = groupRef.current
      const clock = performance.now()
      const dt = Math.min(0.05, (clock - last) / 1000)
      last = clock
      if (u <= 0.02 || u >= phases.total + 0.5 || !group) {
        trackPlane(null)
        if (visible && wrapper) {
          wrapper.style.visibility = "hidden"
          wrapper.style.opacity = "0"
        }
        visible = false
        clicks.length = 0
        return
      }

      const now = (clock - t0) / 1000
      const { aspect, pxPerUnit } = viewRef.current
      const state = paperStateAt(u, phases, aspect)
      visible = state.opacity > 0
      if (wrapper) {
        wrapper.style.visibility = visible ? "visible" : "hidden"
        wrapper.style.opacity = state.opacity.toFixed(3)
      }
      if (!visible) {
        trackPlane(null)
        return
      }

      // ── Camera ──
      const cam = state.camera
      camera.position.set(cam.position.x, cam.position.y, cam.position.z)
      right.set(cam.right.x, cam.right.y, cam.right.z)
      up.set(cam.up.x, cam.up.y, cam.up.z)
      back.set(-cam.forward.x, -cam.forward.y, -cam.forward.z)
      camera.quaternion.setFromRotationMatrix(basis.makeBasis(right, up, back))
      camera.updateMatrixWorld()

      // ── Folds ──
      FOLDS.forEach((fold, i) => {
        angles[i] = fold.angle * state.folds[i]
      })

      // ── The light ──
      const pointer = cursorOnScreen()
      const cursor = pointer ?? restingLight(aspect)
      const lamp = lampPosition(cam, cursor.sx, cursor.sy)
      ;(uniforms.uLamp.value as Vector3).set(lamp.x, lamp.y, lamp.z)
      uniforms.uTime.value = now
      uniforms.uNotes.value = state.notes
      uniforms.uLines.value = state.lines
      uniforms.uDraw.value = state.draw
      uniforms.uCurl.value = state.curl

      // How fast the cursor is moving (screen widths a second), for the bank
      const cursorSpeed =
        pointer && lastCursor && dt > 0 ? (pointer.sx - lastCursor.sx) / dt : 0
      lastCursor = pointer

      // ── The plane turns and drifts toward the cursor (screen-space, so it
      //    reads from any angle), and banks when the cursor moves fast ──
      let pose = state.pose
      const centre = projectToScreen(cam, {
        x: pose.x + PAPER_PIVOT.x,
        y: pose.y + PAPER_PIVOT.y,
        z: pose.z + PAPER_PIVOT.z,
      })
      if (state.aim > 0) {
        const dx = centre ? cursor.sx - centre.sx : 0
        const dy = centre ? cursor.sy - centre.sy : 0
        const yaw = clamp(-dx * AIM.gain * cam.aspect, -AIM.yaw, AIM.yaw)
        const pitch = clamp(-dy * AIM.gain, -AIM.pitch, AIM.pitch)
        aim.yaw += (yaw - aim.yaw) * AIM.ease
        aim.pitch += (pitch - aim.pitch) * AIM.ease
        aim.driftX += (clamp(dx * 2, -1, 1) * AIM.drift - aim.driftX) * AIM.ease
        aim.driftY += (clamp(-dy * 2, -1, 1) * AIM.drift * 0.7 - aim.driftY) * AIM.ease
        const bank = clamp(-cursorSpeed * 0.25, -AIM.bank, AIM.bank)
        aim.bank += (bank - aim.bank) * 0.08
      }

      if (state.flight > 0) {
        // It flies the way it was pointing when it left
        launch ??= {
          yaw: clamp(aim.yaw * state.aim, -AIM.flightYaw, AIM.flightYaw),
          pitch: clamp(aim.pitch * state.aim, -AIM.flightPitch, AIM.flightPitch),
          from: state.perch,
        }
        pose = aimedFlight(state.flight, launch.yaw, launch.pitch, launch.from)
        roll = null
      } else {
        launch = null
        const w = state.aim
        const r = roll ? clamp((now - roll.start) / ROLL.duration) : 1
        if (r >= 1) roll = null
        const spin = roll ? roll.side * 2 * Math.PI * easeInOutCubic(r) : 0
        const hop = roll ? ROLL.hop * Math.sin(Math.PI * r) : 0
        pose = {
          x: pose.x + (cam.right.x * aim.driftX + cam.up.x * aim.driftY) * w,
          y:
            pose.y +
            (cam.right.y * aim.driftX +
              cam.up.y * aim.driftY +
              0.035 * Math.sin(now * 1.4)) *
              w +
            hop,
          z: pose.z + (cam.right.z * aim.driftX + cam.up.z * aim.driftY) * w,
          pitch: pose.pitch + aim.pitch * w,
          yaw: pose.yaw + aim.yaw * w,
          roll:
            pose.roll +
            (aim.yaw * 0.7 + aim.bank + 0.025 * Math.sin(now * 0.9)) * w +
            spin,
        }
      }
      poseMatrix(pose, plane, scratch)
      plane.decompose(group.position, group.quaternion, group.scale)
      inverse.copy(plane).invert()

      // ── In flight, Contact's wall watches for it; once it reaches the wall it's gone ──
      const arrived = launch !== null && state.flight >= PLANE_ARRIVAL
      group.visible = !arrived
      if (launch) {
        tip.copy(pivot).applyMatrix4(plane)
        const seen = projectToScreen(cam, { x: tip.x, y: tip.y, z: tip.z })
        trackPlane(seen ? { sx: seen.sx, sy: seen.sy, flight: state.flight } : null)
      } else {
        trackPlane(null)
      }

      // ── The plane under the cursor lights up at its edges ──
      let over = false
      if (pointer && state.aim > 0 && !launch && centre) {
        tip.copy(tips[0]).applyMatrix4(plane)
        const wing = projectToScreen(cam, { x: tip.x, y: tip.y, z: tip.z })
        if (wing) {
          const reach = Math.hypot(
            (wing.sx - centre.sx) * cam.aspect,
            wing.sy - centre.sy
          )
          over =
            Math.hypot((pointer.sx - centre.sx) * cam.aspect, pointer.sy - centre.sy) <
            reach * 1.15
        }
      }
      highlight += ((over ? 1 : 0) - highlight) * (over ? 0.15 : 0.06)
      uniforms.uHighlight.value = highlight

      // ── The note under the cursor glows ──
      const drawing = drawingRef.current
      let hovered = -1
      if (pointer && state.notes > 0.05 && drawing.regions.length > 0) {
        const hit = onSheet(cam, pointer.sx, pointer.sy)
        if (hit?.inside) {
          const px = (hit.x / SHEET_WIDTH + 0.5) * drawing.width
          const py = ((hit.z - NOSE_Z) / SHEET_LENGTH) * drawing.height
          hovered = noteAt(drawing.regions, px, py)
        }
      }
      for (let i = 0; i < NOTE_ITEMS; i++) {
        const target = i === hovered ? 1 : 0
        glows[i] += (target - glows[i]) * (target ? 0.18 : 0.07)
      }

      // ── The flat sheet's edge lifts toward the light ──
      if (state.curl > 0) {
        tip.set(lamp.x, lamp.y, lamp.z).applyMatrix4(inverse)
        curlAt.x += (tip.x - curlAt.x) * 0.1
        curlAt.y += (tip.z - curlAt.y) * 0.1
      }

      // ── Landing on the water sends a ring across the paper too ──
      const down = u >= phases.landing
      if (down && landed === false) addRipple(0, 0, now, 0.8)
      landed = down

      // ── Clicks: rings across the flat sheet, a roll for the plane, dust blown outward ──
      for (const click of clicks) {
        if (state.curl > 0) {
          const hit = onSheet(cam, click.sx, click.sy)
          if (hit?.inside) addRipple(hit.x, hit.z, now, 1)
        }
        if (state.aim > 0.5 && !launch && !roll && centre) {
          const near =
            Math.hypot((click.sx - centre.sx) * cam.aspect, click.sy - centre.sy) < 0.2
          if (near) roll = { start: now, side: click.sx < centre.sx ? 1 : -1 }
        }
        const at = lampPosition(cam, click.sx, click.sy)
        for (let i = 0; i < DUST.count; i++) {
          const k = i * 3
          const dx = dustPositions.array[k] - at.x
          const dy = dustPositions.array[k + 1] - at.y
          const dz = dustPositions.array[k + 2] - at.z
          const d = Math.hypot(dx, dy, dz)
          if (d < DUST.push && d > 1e-4) {
            const kick = (2 * (1 - d / DUST.push)) / d
            dust.velocity[k] += dx * kick
            dust.velocity[k + 1] += dy * kick
            dust.velocity[k + 2] += dz * kick
          }
        }
      }
      clicks.length = 0

      // ── Dust: drifting, stirred by the moving light ──
      if (lastLamp && dt > 0) {
        lampVelocity.lerp(
          scratch.v.set(lamp.x, lamp.y, lamp.z).sub(lastLamp).divideScalar(dt),
          0.3
        )
      }
      lastLamp = (lastLamp ?? new Vector3()).set(lamp.x, lamp.y, lamp.z)
      dustMaterial.uniforms.uOn.value = state.dust
      dustMaterial.uniforms.uScale.value = pxPerUnit
      ;(dustMaterial.uniforms.uLamp.value as Vector3).set(lamp.x, lamp.y, lamp.z)
      dust.points.visible = state.dust > 0
      if (state.dust > 0 && dt > 0) {
        const p = dustPositions.array as Float32Array
        const v = dust.velocity
        const speed = lampVelocity.length()
        const damping = Math.exp(-1.8 * dt)
        for (let i = 0; i < DUST.count; i++) {
          const k = i * 3
          const seed = dust.seeds[i] * 40
          const hx = dust.home[k] + 0.18 * Math.sin(now * 0.21 + seed)
          const hy = dust.home[k + 1] + 0.12 * Math.sin(now * 0.17 + seed * 0.6)
          const hz = dust.home[k + 2] + 0.18 * Math.cos(now * 0.19 + seed * 0.8)
          v[k] += (hx - p[k]) * 0.35 * dt
          v[k + 1] += (hy - p[k + 1]) * 0.35 * dt
          v[k + 2] += (hz - p[k + 2]) * 0.35 * dt
          // Swept along behind the light, and brushed aside by it
          const dx = p[k] - lamp.x
          const dy = p[k + 1] - lamp.y
          const dz = p[k + 2] - lamp.z
          const d2 = dx * dx + dy * dy + dz * dz
          const near = Math.exp(-d2 / 0.4)
          if (near > 0.01) {
            const d = Math.sqrt(d2) + 1e-4
            const aside = (speed * 0.5 * near * dt) / d
            v[k] += lampVelocity.x * 0.9 * near * dt + dx * aside
            v[k + 1] += lampVelocity.y * 0.9 * near * dt + dy * aside
            v[k + 2] += lampVelocity.z * 0.9 * near * dt + dz * aside
          }
          v[k] *= damping
          v[k + 1] *= damping
          v[k + 2] *= damping
          p[k] += v[k] * dt
          p[k + 1] += v[k + 1] * dt
          p[k + 2] += v[k + 2] * dt
        }
        dustPositions.needsUpdate = true
      }

      // ── Trails and the tail light (only in flight) ──
      const on =
        launch && !arrived
          ? clamp(state.flight / 0.08) * (1 - clamp((state.flight - 0.85) / 0.15))
          : 0
      trails.forEach((trail, side) => {
        ;(trail.material as ShaderMaterial).uniforms.uOn.value = on
        trail.visible = on > 0
        if (!launch || on <= 0) return
        const positions = trail.geometry.getAttribute("position") as BufferAttribute
        for (let k = 0; k < TRAIL_POINTS; k++) {
          const f = Math.max(0, state.flight - (k / (TRAIL_POINTS - 1)) * TRAIL_SPAN)
          poseMatrix(
            aimedFlight(f, launch.yaw, launch.pitch, launch.from),
            model,
            scratch
          )
          tip.copy(tips[side]).applyMatrix4(model)
          positions.setXYZ(k, tip.x, tip.y, tip.z)
        }
        positions.needsUpdate = true
      })
      const tailMaterial = tail.material as ShaderMaterial
      tailMaterial.uniforms.uOn.value = on
      tail.visible = on > 0
      if (on > 0) {
        tip.copy(tailPoint).applyMatrix4(plane)
        const position = tail.geometry.getAttribute("position") as BufferAttribute
        position.setXYZ(0, tip.x, tip.y, tip.z)
        position.needsUpdate = true
      }

      advance(clock)
    }

    gsap.ticker.add(tick)
    return () => {
      gsap.ticker.remove(tick)
      offPing()
      trackPlane(null)
    }
  }, [advance, camera, dust, phases, readUnits, tail, trails, uniforms, wrapperRef])

  return (
    <>
      <group ref={groupRef}>
        <primitive object={mesh} />
      </group>
      <primitive object={dust.points} />
      <primitive object={trails[0]} />
      <primitive object={trails[1]} />
      <primitive object={tail} />
    </>
  )
}
