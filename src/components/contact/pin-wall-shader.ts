/**
 * The Contact wall's shaders: thousands of steel pins in one draw call.
 *
 * - Vertex: one pin per instance. Each reads its row of the pin data (a
 *   float texture written by pin-field's shadePins every frame) for how far
 *   it stands out, and slides out of the wall by that much.
 * - Fragment: polished steel. Unlit steel falls back to the page's own black,
 *   so the wall shows only where light reaches it: a soft, cool light from
 *   the top left, low and raking, so it catches the pins that stand out (the
 *   letters) and barely the flat wall around them, and the letters throw a
 *   short shadow down and right; the visitor's light low over the wall under
 *   the cursor (its shadows are worked out per pin on the CPU); and the paper
 *   plane's pale light as it comes in. Glints are plain steel-white; purple
 *   is only in small bright things: the glints on the few pin heads right
 *   under the cursor (the brightest lavender-white), and a faint glint on
 *   pins riding a ripple. The view's edges and the insides of the
 *   wall fade to black, and pins sunk deep into the hole at the end fade out
 *   altogether (premultiplied alpha), so the Hero's name shows through it.
 */

import { RELIEF_HEIGHT } from "./pin-field"

/** The visitor's light: how high over the wall's face it floats, and how far it reaches (units). */
export const WALL_LAMP = { height: 7, range: 17 }
/** The paper plane's light, as it comes in (units). */
export const WALL_FLARE = { range: 13 }

const f = (n: number) => n.toFixed(4)

export const pinVertexShader = /* glsl */ `
attribute vec2 aCell; // this pin's column, and row from the top

uniform sampler2D uPins; // per pin: height, open-ness, lamp shadow, speed
uniform vec2 uGrid;      // columns, rows

varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vPin;
varying float vTip;

void main() {
  vec4 pin = texture2D(uPins, (aCell + 0.5) / uGrid);
  vec3 base = vec3(
    aCell.x - (uGrid.x - 1.0) * 0.5,
    (uGrid.y - 1.0) * 0.5 - aCell.y,
    pin.x
  );
  vec3 p = position + base;
  vWorld = p;
  vNormal = normal;
  vPin = pin;
  vTip = smoothstep(0.02, 0.18, position.z); // the dome of the head
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`

export const pinFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uLamp;
uniform float uLampOn;
uniform vec3 uFlare;
uniform float uFlareOn;
uniform float uKey;
uniform vec2 uResolution;

varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vPin;
varying float vTip;

const vec3 BLACK = vec3(0.039);           // the page (--color-base, #0a0a0a)
const vec3 STEEL = vec3(0.17, 0.17, 0.19);
const vec3 WARM = vec3(1.0, 0.96, 0.9);
const vec3 ACCENT = vec3(0.6, 0.0, 0.98); // #9900fa
const vec3 LAVENDER = vec3(0.88, 0.78, 1.0);
const vec3 KEY_DIR = vec3(-0.46, 0.5, 0.73);
const float LAMP_RANGE2 = ${f(WALL_LAMP.range * WALL_LAMP.range)};
const float FLARE_RANGE2 = ${f(WALL_FLARE.range * WALL_FLARE.range)};
const float RELIEF = ${f(RELIEF_HEIGHT)};
const vec3 GLINT = vec3(0.86, 0.87, 0.92); // plain steel highlight
const float NEAR2 = 14.0;                  // how close to the cursor (units², across the wall) glints turn purple

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  float open = vPin.y;
  float blocked = vPin.z;
  float speed = vPin.w;

  // ── The soft light over the wall: cool, from the top left, raking low, so
  //    it lights the pins that stand out (the letters) and barely the rest ──
  vec3 K = normalize(KEY_DIR);
  float kd = max(dot(N, K), 0.0);
  float ks = pow(max(dot(N, normalize(K + V)), 0.0), 40.0);
  float proud = smoothstep(0.25, RELIEF * 0.85, vPin.x);
  float catchLight = (0.22 + 1.25 * proud) * open * uKey;
  vec3 col = STEEL * kd * catchLight;
  col += GLINT * ks * catchLight * 0.3;

  // ── The visitor's light: warm, low over the wall under the cursor ──
  vec3 L = uLamp - vWorld;
  float d2 = dot(L, L);
  L *= inversesqrt(d2);
  float lit = uLampOn / (1.0 + d2 / LAMP_RANGE2) * (1.0 - 0.85 * blocked);
  col += STEEL * WARM * max(dot(N, L), 0.0) * lit * 3.0;
  // Glints on the heads: steel-white, turning purple (the brightest
  // lavender-white) only on the few pins right under the cursor
  float g = pow(max(dot(N, normalize(L + V)), 0.0), 90.0) * lit;
  vec2 across = uLamp.xy - vWorld.xy;
  float near = exp(-dot(across, across) / NEAR2);
  vec3 tint = mix(GLINT, mix(ACCENT, LAVENDER, smoothstep(0.3, 0.85, g)), near);
  col += tint * g * 1.4;

  // ── The paper plane's light as it comes in, and its flash when it arrives ──
  vec3 F = uFlare - vWorld;
  float f2 = dot(F, F);
  F *= inversesqrt(f2);
  float fl = uFlareOn / (1.0 + f2 / FLARE_RANGE2);
  col += mix(GLINT, LAVENDER, 0.5) * STEEL * max(dot(N, F), 0.0) * fl * 2.2;
  col += LAVENDER * pow(max(dot(N, normalize(F + V)), 0.0), 50.0) * fl * 0.9;

  // ── A pin riding a ripple catches a glint on its tip, so a ring shows
  //    running across the wall even before the wall's own light is up ──
  col += mix(ACCENT, LAVENDER, 0.25) * smoothstep(2.0, 8.0, speed) * vTip * 0.3;

  // ── Deep inside the wall, and toward the view's edges, it's black ──
  vec2 q = gl_FragCoord.xy / uResolution - 0.5;
  float edge = 1.0 - smoothstep(0.32, 0.72, length(q * vec2(1.0, 1.25)));
  float inside = smoothstep(-3.5, -0.2, vWorld.z);
  // …and deeper still it's not there at all: what's behind shows through
  // (the page's own black, or the Hero's name through the hole)
  float here = smoothstep(-7.0, -4.0, vWorld.z);
  gl_FragColor = vec4((BLACK + col * edge * inside) * here, here);
}
`
