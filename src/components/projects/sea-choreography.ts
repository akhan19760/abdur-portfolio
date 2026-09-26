/**
 * Where the sea's camera is, and what the sea is doing, at every point of the
 * Work section's scroll. Pure, so it can be unit-tested; the sea reads it
 * every frame and the section reads it for the HUD.
 *
 *   handoff  About's stage scrolls away above. The camera starts high over
 *            the planet with the sea's horizon exactly on About's dawn
 *            horizon and follows it up, coming down to the water as the
 *            planet's curve flattens. The dawn fades; the light becomes yours.
 *   projects Each project's screen rises out of the water as the camera
 *            glides sideways (x) toward it, and stays standing: gliding on
 *            carries it out of view as the next one rises and slides in.
 */

import type { SeaPhases } from "@/hooks/projects"
import { SEA_EXIT } from "@/hooks/projects"
import { clamp, mix, pitchForHorizon, smoothstep } from "./mirror-sea-utils"
import type { Panel, SeaCamera } from "./mirror-sea-utils"

/**
 * Where About's dawn horizon sits on screen once its finale has formed (0 =
 * top, 1 = bottom). From SignalCore: the rim's crest at y −1.6, z −1, seen
 * from z 8 with a 40° field of view.
 */
export const ABOUT_HORIZON_Y = 0.744

/** Metres between projects along the water (x). */
export const SITE_SPACING = 40
/** Vertical field of view (radians). */
export const SEA_FOV = (36 * Math.PI) / 180

// ── Camera beside a project ──────────────────────────────────────────────────
/** Where the horizon sits while you read (0 = top of the view). */
export const HORIZON_Y = 0.35
const HOLD_HEIGHT = 5.5
const HOLD_DISTANCE = 32 // back from the screens
const HOLD_OFFSET = 7 // to the left of the screen, so it stands right of centre

// ── Handoff ──────────────────────────────────────────────────────────────────
const START_HEIGHT = 1200 // high over the planet, where About left off
const START_CURVATURE = 1 / 6000 // curves the horizon like About's planet rim

// ── Glides ───────────────────────────────────────────────────────────────────
const GLIDE_ROLL = 0.03 // radians of bank mid-glide
const GLIDE_LIFT = 0.04 // radians the gaze lifts mid-glide
const GLIDE_RISE = 1.2 // metres the camera rises mid-glide

export const siteX = (index: number) => index * SITE_SPACING
const holdX = (index: number) => siteX(index) - HOLD_OFFSET

const HOLD_PITCH = pitchForHorizon(HORIZON_Y, SEA_FOV, HOLD_HEIGHT, 0)

/** The camera resting beside a project. */
export function holdCamera(index: number, aspect: number): SeaCamera {
  return {
    x: holdX(index),
    y: HOLD_HEIGHT,
    z: HOLD_DISTANCE,
    yaw: 0,
    pitch: HOLD_PITCH,
    roll: 0,
    fov: SEA_FOV,
    aspect,
    curvature: 0,
  }
}

export type SeaState = {
  camera: SeaCamera
  /** 0–1: the dawn sun on the horizon (handoff only). */
  dawn: number
  /** 0–1: how much the cursor's light is on. */
  light: number
  /** 0–1: the whole sea (fades in under About's horizon, out after the section). */
  opacity: number
  /** Every project's screen (position and how far it's risen; yaw is left at 0). */
  panels: Panel[]
  /** The project the camera is at or heading to, for the HUD. */
  active: number
}

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

/** The whole sea's state at timeline position `u` (screens; see seaPhases). */
export function seaStateAt(u: number, phases: SeaPhases, aspect: number): SeaState {
  const count = phases.arrivals.length
  const last = count - 1

  // ── Sideways: resting beside a project, or gliding to the next ──────────
  let x = holdX(0)
  let glide = 0 // 0–1–0 bump through a glide
  let active = 0
  for (let i = 1; i < count; i++) {
    const start = phases.holdEnds[i - 1]
    const end = phases.arrivals[i]
    if (u >= end) {
      x = holdX(i)
      active = i
    } else if (u > start) {
      const s = (u - start) / (end - start)
      x = mix(holdX(i - 1), holdX(i), easeInOutSine(s))
      glide = Math.sin(Math.PI * s)
      active = s < 0.5 ? i - 1 : i
      break
    } else {
      break
    }
  }

  // ── Handoff: down from over the planet, horizon on About's, then settled ──
  const descent = smoothstep(0, 1.1, u)
  const height =
    Math.exp(mix(Math.log(START_HEIGHT), Math.log(HOLD_HEIGHT), descent)) +
    GLIDE_RISE * glide
  const curvature = START_CURVATURE * (1 - smoothstep(0, 0.9, u))
  const horizon = mix(
    ABOUT_HORIZON_Y - Math.max(0, u),
    HORIZON_Y,
    smoothstep(0.28, 0.55, u)
  )
  const pitch = pitchForHorizon(horizon, SEA_FOV, height, curvature) - GLIDE_LIFT * glide

  const camera: SeaCamera = {
    x,
    y: height,
    z: HOLD_DISTANCE,
    yaw: 0,
    pitch,
    roll: -GLIDE_ROLL * glide,
    fov: SEA_FOV,
    aspect,
    curvature,
  }

  // ── Screens: rise out of the water on the way in, then stay standing ────
  const panels = phases.arrivals.map((arrival, i) => ({
    x: siteX(i),
    yaw: 0,
    rise: smoothstep(phases.riseStarts[i], arrival, u),
  }))

  const opacity =
    smoothstep(-0.2, 0.05, u) * (1 - smoothstep(phases.total, phases.total + SEA_EXIT, u))

  return {
    camera,
    dawn: 1 - smoothstep(0.4, 1, u),
    light: smoothstep(0.35, 0.95, u),
    opacity,
    panels,
    active: clamp(active, 0, Math.max(0, last)),
  }
}
