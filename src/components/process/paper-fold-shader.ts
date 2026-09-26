/**
 * The Process paper's shaders.
 *
 * - Vertex: folds the flat sheet. Each vertex carries a bitmask of the folds
 *   that turn it (paper-fold's buildSheet); it's turned about each of those
 *   creases in order, by however far that fold has got (foldPoint, in GLSL).
 *   Before folding it can be nudged off the flat: rings running out from a
 *   click, and the edge nearest the light lifting toward it (Discover and
 *   Design). Being done first, those move with the paper as it folds.
 * - Fragment: paper under the visitor's light. Facets are shaded flat (the
 *   normal comes from screen-space derivatives, so every crease is crisp),
 *   lit by a warm lamp that hovers under the cursor, with a little light
 *   showing through when the lamp is behind a flap. Unlit paper falls back to
 *   near the page's black, so the light is what shows it. On top: the grain,
 *   the pencil notes (Discover) and the fold lines (Design), with purple
 *   only in small bright things: the fold lines, the sheet's edges where the
 *   light catches them, and the note under the cursor, which glows purple
 *   (a light lavender core with a soft halo) so it's easy to read.
 */

import { FOLD_COUNT, NOSE_Z, SHEET_LENGTH, SHEET_WIDTH } from "./paper-fold"
import { NOTE_ID_STEP, NOTE_ITEMS } from "./paper-notes"

/** Most rings running across the paper at once. */
export const PAPER_RIPPLES = 4
/** How fast a ring runs across the paper (units a second), and how long it lasts (s). */
export const PAPER_RIPPLE = { speed: 1.6, life: 2.2 }

const f = (n: number) => n.toFixed(4)

export const paperVertexShader = /* glsl */ `
#define FOLDS ${FOLD_COUNT}
#define RIPPLES ${PAPER_RIPPLES}

attribute float aMask;
attribute vec4 aCreaseA;
attribute vec4 aCreaseB;

uniform vec3 uFoldPoint[FOLDS];
uniform vec3 uFoldDir[FOLDS];
uniform float uFoldAngle[FOLDS]; // each fold's turn right now (radians)

uniform float uTime;
uniform vec4 uRipples[RIPPLES]; // flat x, z, start (s), strength (0 = unused)
uniform float uCurl;            // 0–1: the edge nearest the light lifting toward it
uniform vec2 uCurlAt;           // the light's spot over the flat sheet (x, z)

const float HALF_W = ${f(SHEET_WIDTH / 2)};
const float HALF_L = ${f(SHEET_LENGTH / 2)};
const float RIPPLE_SPEED = ${f(PAPER_RIPPLE.speed)};
const float RIPPLE_LIFE = ${f(PAPER_RIPPLE.life)};

varying vec3 vWorld;
varying vec2 vFlat;
varying vec4 vCreaseA;
varying vec4 vCreaseB;

vec3 turn(vec3 p, vec3 a, vec3 k, float t) {
  vec3 v = p - a;
  float c = cos(t);
  float s = sin(t);
  return a + v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c);
}

// How far the flat sheet is nudged up at a point, before it's folded
float lift(vec2 q) {
  float h = 0.0;
  for (int i = 0; i < RIPPLES; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > RIPPLE_LIFE) continue;
    float x = length(q - r.xy) - age * RIPPLE_SPEED;
    float fade = 1.0 - age / RIPPLE_LIFE;
    h += sin(x * 14.0) * exp(-x * x * 18.0) * r.w * fade * fade * 0.022;
  }
  if (uCurl > 0.0) {
    float edge = min(HALF_W - abs(q.x), HALF_L - abs(q.y));
    vec2 d = q - uCurlAt;
    float rim = 1.0 - smoothstep(0.0, 0.5, edge);
    h += uCurl * exp(-dot(d, d) * 2.2) * rim * rim * 0.16;
  }
  return h;
}

void main() {
  vec3 p = position;
  p.y += lift(position.xz);
  for (int i = 0; i < FOLDS; i++) {
    float turned = mod(floor(aMask / exp2(float(i))), 2.0);
    if (turned > 0.5 && uFoldAngle[i] != 0.0) {
      p = turn(p, uFoldPoint[i], uFoldDir[i], uFoldAngle[i]);
    }
  }
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorld = world.xyz;
  vFlat = position.xz;
  vCreaseA = aCreaseA;
  vCreaseB = aCreaseB;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`

export const paperFragmentShader = /* glsl */ `
precision highp float;

uniform vec3 uLamp;        // the visitor's light
uniform float uNotes;      // 0–1, the pencil notes
uniform float uLines;      // 0–1, the fold lines
uniform float uDraw;       // 0–1, how much of the fold lines is drawn
uniform sampler2D uNotesMap;
uniform float uHasNotes;
uniform float uNoteGlow[${NOTE_ITEMS}]; // 0–1 per note: the one under the cursor glows
uniform float uHighlight;  // 0–1: the plane under the cursor

varying vec3 vWorld;
varying vec2 vFlat;
varying vec4 vCreaseA;
varying vec4 vCreaseB;

const float HALF_W = ${f(SHEET_WIDTH / 2)};
const float HALF_L = ${f(SHEET_LENGTH / 2)};
const float NOSE_Z = ${f(NOSE_Z)};

const vec3 LAMP = vec3(1.0, 0.93, 0.84);        // warm
const float LAMP_POWER = 4.2;
const vec3 MOON = vec3(0.55, 0.58, 0.75);        // faint, cool, from above
const vec3 ACCENT = vec3(0.319, 0.0, 0.955);     // #9900fa, linear
const vec3 FRONT = vec3(0.155, 0.152, 0.16);     // the sheet's top side
const vec3 BACK = vec3(0.13, 0.128, 0.138);
const vec3 GLOW_CORE = vec3(1.25, 0.72, 2.1);    // lit writing: light lavender
const vec3 GLOW_HALO = vec3(0.42, 0.0, 1.25);    // and the purple around it

// Which note a texel of the drawing belongs to (its red channel, see paper-notes).
// The drawing is uploaded premultiplied, so blurred texels still average to the right ID.
float noteGlow(vec4 t) {
  if (t.a < 0.01) return 0.0;
  float id = floor(t.r / t.a * 255.0 / ${NOTE_ID_STEP.toFixed(1)} + 0.5) - 1.0;
  float g = 0.0;
  for (int i = 0; i < ${NOTE_ITEMS}; i++) {
    g += uNoteGlow[i] * (1.0 - step(0.5, abs(id - float(i))));
  }
  return g;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 u = fract(p);
  u = u * u * (3.0 - 2.0 * u);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// A dashed pencil line where a crease value crosses zero
float creaseLine(float d, float along) {
  float aa = fwidth(d) * 1.2;
  float core = 1.0 - smoothstep(0.006, 0.006 + aa, abs(d));
  float dash = smoothstep(0.0, 0.08, fract(along * 7.0)) * (1.0 - smoothstep(0.55, 0.63, fract(along * 7.0)));
  return core * dash;
}

vec3 toneMap(vec3 x) {
  return x * (1.0 + x * 0.25) / (1.0 + x);
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  // Flat-shaded facets: every crease stays crisp
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  vec3 v = normalize(cameraPosition - vWorld);
  if (dot(n, v) < 0.0) n = -n;
  bool top = gl_FrontFacing;

  // ── Light ──
  vec3 toL = uLamp - vWorld;
  float dL2 = dot(toL, toL);
  vec3 l = toL * inversesqrt(dL2);
  float atten = LAMP_POWER / (dL2 + 0.3);
  float ndl = dot(n, l);
  float lit = max(ndl, 0.0) * atten;
  float through = max(-ndl, 0.0) * atten * 0.2; // lamp behind a flap glows through it
  float moon = 0.02 + 0.05 * max(dot(n, normalize(vec3(-0.3, 1.0, 0.45))), 0.0);

  // ── The paper ──
  vec3 albedo = top ? FRONT : BACK;
  float grain = noise(vFlat * 55.0) * 0.55 + noise(vFlat * 160.0) * 0.3 + noise(vec2(vFlat.x * 22.0, vFlat.y * 380.0)) * 0.15;
  albedo *= 0.9 + 0.2 * grain;

  // Pencil notes, clearest where the light falls; the one under the cursor glows
  float ink = 0.0;
  float glowInk = 0.0;
  float glowHalo = 0.0;
  if (top && uNotes > 0.0 && uHasNotes > 0.5) {
    vec2 nuv = vec2(vFlat.x / (2.0 * HALF_W) + 0.5, 1.0 - (vFlat.y - NOSE_Z) / (2.0 * HALF_L));
    float pool = 1.0 - smoothstep(0.25, 1.35, length(vWorld.xz - uLamp.xz));
    vec4 t = texture2D(uNotesMap, nuv);
    vec4 soft = texture2D(uNotesMap, nuv, 3.0); // blurred: the glow's halo
    float glow = noteGlow(t);
    ink = t.a * uNotes * (0.3 + 0.7 * pool);
    glowInk = t.a * glow * uNotes;
    glowHalo = soft.a * noteGlow(soft) * uNotes;
    albedo = mix(albedo, vec3(0.03, 0.03, 0.035), ink * 0.85 * (1.0 - glow));
  }

  vec3 col = albedo * (MOON * moon + LAMP * (lit + through));

  // A soft sheen, a little stronger on graphite
  vec3 h = normalize(l + v);
  float sheen = pow(max(dot(n, h), 0.0), 24.0) * atten * max(ndl, 0.0);
  col += LAMP * sheen * (0.035 + ink * 0.25);

  // The note under the cursor, glowing so it reads clearly
  col += GLOW_HALO * glowHalo * 0.9;
  col = mix(col, GLOW_CORE, clamp(glowInk, 0.0, 1.0));

  // ── Fold lines: drawn outward from the nose ──
  if (top && uLines > 0.0) {
    float along = length(vFlat - vec2(0.0, NOSE_Z));
    float drawn = 1.0 - smoothstep(uDraw * 3.4 - 0.12, uDraw * 3.4, along);
    float line = max(
      max(max(creaseLine(vCreaseA.x, along), creaseLine(vCreaseA.y, along)),
          max(creaseLine(vCreaseA.z, along), creaseLine(vCreaseA.w, along))),
      max(creaseLine(vCreaseB.x, along), max(creaseLine(vCreaseB.y, along), creaseLine(vCreaseB.z, along)))
    );
    line *= drawn * uLines;
    col = mix(col, ACCENT * (0.35 + 1.6 * lit), line * 0.9);
  }

  // ── The sheet's edges glint purple where the light catches them ──
  float edge = min(HALF_W - abs(vFlat.x), HALF_L - abs(vFlat.y));
  float rim = 1.0 - smoothstep(0.0, fwidth(edge) * 1.5 + 0.006, edge);
  col += ACCENT * rim * (0.04 + 0.9 * lit + 1.2 * uHighlight);

  // Facets turned edge-on to you catch a faint purple (more under the cursor)
  float grazing = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  col += ACCENT * grazing * (0.03 + 0.25 * lit + 0.35 * uHighlight);

  gl_FragColor = vec4(toSrgb(toneMap(col)), 1.0);
}
`

/** The trails behind the wingtips during the flight: bright at the plane, fading back. */
export const trailVertexShader = /* glsl */ `
attribute float aAge;
varying float vAge;

void main() {
  vAge = aAge;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const trailFragmentShader = /* glsl */ `
precision highp float;
uniform float uOn;
varying float vAge;

void main() {
  float a = pow(1.0 - vAge, 1.6) * uOn;
  gl_FragColor = vec4(vec3(0.72, 0.42, 1.0) * a, a);
}
`

/**
 * Dust drifting in the dark around the paper, seen only where the light
 * catches it: a few specks near the cursor, none over the text on the left,
 * and none right in front of the camera.
 */
export const dustVertexShader = /* glsl */ `
attribute float aSeed;
uniform vec3 uLamp;
uniform float uOn;
uniform float uScale; // px per unit of size at a distance of 1
varying float vGlow;
varying float vTint;

void main() {
  vec4 view = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * view;
  vec3 d = position - uLamp;
  float lit = 1.0 / (1.0 + dot(d, d) * 3.0);
  float sx = gl_Position.x / gl_Position.w * 0.5 + 0.5;
  float clear = smoothstep(0.44, 0.54, sx) * smoothstep(0.9, 1.8, -view.z);
  vGlow = lit * clear * uOn * (0.45 + 0.55 * fract(aSeed * 7.13));
  vTint = step(0.86, fract(aSeed * 3.71)); // a few purple ones
  float size = 0.004 + 0.008 * fract(aSeed * 13.7);
  gl_PointSize = clamp(size * uScale / -view.z, 1.0, 6.0);
}
`

export const dustFragmentShader = /* glsl */ `
precision highp float;
varying float vGlow;
varying float vTint;

void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.0, 1.0, d)) * vGlow;
  vec3 c = mix(vec3(1.0, 0.9, 0.78), vec3(0.72, 0.4, 1.0), vTint);
  gl_FragColor = vec4(c * a, a);
}
`

/** The plane's tail light: a small soft point that stays visible as it flies off. */
export const tailVertexShader = /* glsl */ `
uniform float uSize;
void main() {
  gl_PointSize = uSize;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const tailFragmentShader = /* glsl */ `
precision highp float;
uniform float uOn;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.2, 1.0, d)) * uOn;
  gl_FragColor = vec4(mix(vec3(0.72, 0.4, 1.0), vec3(1.0), 1.0 - smoothstep(0.0, 0.45, d)) * a, a);
}
`
