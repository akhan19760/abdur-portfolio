/**
 * The Work sea's shaders. One full-screen quad: every pixel casts a ray from
 * the camera, checks the projects' screens standing on the water, then the
 * water itself (optionally curved, like a planet), then the sky.
 *
 * - Water: dark, glossy, with long swells and fine ripples; it reflects the
 *   sky's stars, the screens (wobbling with the waves) and glitters under the
 *   cursor's light. Wave detail smaller than a pixel melts into a smooth sheen
 *   so nothing shimmers or aliases in the distance.
 * - Screens: each project's picture on a rounded glass pane with a thin lit
 *   frame and a soft sheen from the cursor's light.
 * - Sky: the page's own near-black (matched exactly), a few stars, and one
 *   thin line of light along the horizon. Purple only ever appears as small
 *   bright accents: the horizon line, the dawn sun, glints.
 */

import { RIPPLE } from "./mirror-sea-utils"
import { PANEL_HEIGHT, PANEL_WIDTH } from "./mirror-sea-utils"

export const MAX_PANELS = 8
export const MAX_RIPPLES = 8

export const seaVertexShader = /* glsl */ `
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`

export const seaFragmentShader = /* glsl */ `
precision highp float;

#define MAX_PANELS ${MAX_PANELS}
#define MAX_RIPPLES ${MAX_RIPPLES}
#define PI 3.14159265

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamForward;
uniform float uTanHalfFov;
uniform float uAspect;
uniform float uCurvature;
uniform float uHorizonDip;   // radians the horizon sits below eye level

uniform vec3 uBase;          // the page's background, linear
uniform float uDawn;         // 0–1, the sun on the horizon
uniform vec3 uSunDir;

uniform vec3 uLight;         // the cursor's light, floating over the water
uniform float uLightOn;
uniform float uSwell;        // 0–1, how much of the waves is running

uniform int uPanelCount;
uniform float uPanelX[MAX_PANELS];
uniform float uPanelYaw[MAX_PANELS];
uniform float uPanelRise[MAX_PANELS];
uniform sampler2D uAtlas;
uniform vec2 uAtlasGrid;     // columns, rows
uniform vec3 uPanelGlow[MAX_PANELS]; // each picture's average colour, linear

uniform vec4 uRipples[MAX_RIPPLES];      // x, z, start (s), strength (0 = unused)
uniform float uRippleRadius[MAX_RIPPLES]; // where each ring starts

const float PANEL_W = ${PANEL_WIDTH.toFixed(1)};
const float PANEL_H = ${PANEL_HEIGHT.toFixed(1)};
const float CORNER = 0.32;
const vec3 LAMP = vec3(0.96, 0.92, 1.0);
const float RIPPLE_SPEED = ${RIPPLE.speed.toFixed(2)};
const float RIPPLE_WIDTH = ${RIPPLE.width.toFixed(2)};
const float RIPPLE_LIFE = ${RIPPLE.life.toFixed(2)};

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float ggx(float nh, float a) {
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}

// ── Sky ─────────────────────────────────────────────────────────────────────
// Stars are left out of reflections: they cost trig per pixel for little gain.
vec3 sky(vec3 d, bool withStars) {
  float e = d.y + uHorizonDip; // height above the (possibly dipped) horizon
  vec3 col = uBase;

  // A few faint stars, twinkling
  if (withStars && e > 0.0) {
    vec2 sp = vec2(atan(d.x, -d.z), asin(clamp(d.y, -1.0, 1.0))) * 140.0;
    vec2 cell = floor(sp);
    float h = hash12(cell);
    float star = step(0.992, h) * smoothstep(0.16, 0.0, length(fract(sp) - 0.5));
    star *= 0.55 + 0.45 * sin(uTime * (0.6 + h * 2.0) + h * 40.0);
    col += vec3(0.75, 0.72, 0.9) * star * 0.16 * smoothstep(0.0, 0.06, e);
  }

  // One thin line of light along the horizon
  float line = exp(-abs(e) * 160.0);
  col += (vec3(0.020, 0.017, 0.030) + uDawn * vec3(0.10, 0.03, 0.26)) * line;

  // The dawn sun, small, sitting on the horizon
  float a = max(dot(d, uSunDir), 0.0);
  col += uDawn * (vec3(0.62, 0.40, 1.0) * pow(a, 900.0) * 1.4 + vec3(0.30, 0.06, 0.85) * pow(a, 140.0) * 0.045);
  return col;
}

// ── Screens ─────────────────────────────────────────────────────────────────
// Signed distance (metres) from a point on a screen's face to its rounded edge
float panelSdf(vec2 local) {
  vec2 q = abs(local) - vec2(PANEL_W, PANEL_H) * 0.5 + CORNER;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - CORNER;
}

// Ray against screen i. Returns the distance along the ray (or -1), the
// picture's uv, and the signed distance to the screen's edge.
float hitPanel(vec3 ro, vec3 rd, int i, float margin, out vec2 uv, out float sdf, out vec3 n) {
  float yaw = uPanelYaw[i];
  n = vec3(sin(yaw), 0.0, cos(yaw));
  uv = vec2(0.0);
  sdf = 1e3;
  float denom = dot(rd, n);
  if (abs(denom) < 1e-5) return -1.0;
  vec3 base = vec3(uPanelX[i], 0.0, 0.0);
  float t = dot(base - ro, n) / denom;
  if (t <= 0.0) return -1.0;
  vec3 q = ro + rd * t;
  if (q.y < 0.0) return -1.0; // under the water
  float top = PANEL_H * uPanelRise[i];
  float bottom = top - PANEL_H;
  vec3 tangent = vec3(cos(yaw), 0.0, -sin(yaw));
  float lx = dot(q - base, tangent);
  sdf = panelSdf(vec2(lx, q.y - bottom - PANEL_H * 0.5));
  if (sdf > margin) return -1.0;
  uv = vec2(lx / PANEL_W + 0.5, (q.y - bottom) / PANEL_H);
  return t;
}

vec3 panelPicture(int i, vec2 uv, float blur) {
  float col = mod(float(i), uAtlasGrid.x);
  float row = floor(float(i) / uAtlasGrid.x);
  vec2 auv = vec2((col + clamp(uv.x, 0.002, 0.998)) / uAtlasGrid.x, 1.0 - (row + 1.0 - clamp(uv.y, 0.002, 0.998)) / uAtlasGrid.y);
  return texture2D(uAtlas, auv, blur).rgb;
}

// ── Water ───────────────────────────────────────────────────────────────────
// One wave's slope, faded out once it's smaller than a pixel; what fades is
// handed back as extra roughness so the glitter becomes a smooth sheen.
vec2 wave(vec2 p, vec2 dir, float len, float slope, float speed, float fw, inout float lost) {
  float fade = 1.0 - smoothstep(len * 0.1, len * 0.3, fw);
  lost += slope * slope * (1.0 - fade);
  return dir * cos(dot(dir, p) * (6.2832 / len) - uTime * speed) * slope * fade;
}

vec3 waterNormal(vec2 p, float fw, out float lost) {
  lost = 0.0;
  vec2 s = vec2(0.0);
  s += wave(p, normalize(vec2(0.25, 1.0)), 38.0, 0.045, 0.8, fw, lost);
  s += wave(p, normalize(vec2(-0.5, 1.0)), 21.0, 0.04, 1.05, fw, lost);
  s += wave(p, normalize(vec2(0.9, 0.35)), 11.0, 0.045, 1.4, fw, lost);
  s += wave(p, normalize(vec2(0.1, 1.0)), 6.1, 0.04, 1.9, fw, lost);
  s += wave(p, normalize(vec2(-0.85, 0.55)), 3.3, 0.034, 2.6, fw, lost);
  s += wave(p, normalize(vec2(0.6, -0.25)), 1.9, 0.028, 3.5, fw, lost);
  s += wave(p, normalize(vec2(-0.3, -1.0)), 1.05, 0.022, 4.6, fw, lost);
  // Still water for Process's paper to land on (the rings below keep going)
  s *= uSwell;
  lost *= uSwell * uSwell;

  // Rings from clicks and from screens rising out of the water
  for (int i = 0; i < MAX_RIPPLES; i++) {
    vec4 r = uRipples[i];
    float age = uTime - r.z;
    if (r.w <= 0.0 || age < 0.0 || age > RIPPLE_LIFE) continue;
    vec2 d = p - r.xy;
    float dist = max(length(d), 1e-3);
    float x = dist - (uRippleRadius[i] + RIPPLE_SPEED * age);
    float fadeOut = 1.0 - age / RIPPLE_LIFE;
    float env = exp(-x * x / (RIPPLE_WIDTH * RIPPLE_WIDTH)) * r.w * fadeOut * fadeOut;
    s += (d / dist) * sin(x * 3.4) * env * 0.45 * (1.0 - smoothstep(0.4, 1.2, fw));
  }
  return vec3(-s.x, 1.0, -s.y);
}

// Keeps the darks exact (the sky matches the page) and rolls off highlights
vec3 toneMap(vec3 x) {
  return x * (1.0 + x * 0.25) / (1.0 + x);
}

vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  vec3 dir = normalize(uCamForward + uCamRight * (ndc.x * uTanHalfFov * uAspect) + uCamUp * (ndc.y * uTanHalfFov));

  // ── The water under this pixel (worked out for every pixel so the
  //    derivatives below stay valid) ──
  float h = uCamPos.y;
  float k = uCurvature * dot(dir.xz, dir.xz) * 0.5;
  float disc = dir.y * dir.y - 4.0 * k * h;
  bool hitWater = dir.y < 0.0 && disc >= 0.0;
  float tWater = hitWater ? 2.0 * h / (-dir.y + sqrt(max(disc, 0.0))) : 1e6;
  vec3 P = uCamPos + dir * min(tWater, 1e5);
  vec2 fwv = fwidth(P.xz);
  float fw = max(fwv.x, fwv.y);

  // Size of one pixel at a distance, for the screens' anti-aliased edges
  float pixel = 2.0 * uTanHalfFov / uResolution.y;

  // ── The nearest screen in front of the water ──
  float tPanel = 1e9;
  vec2 pUv = vec2(0.0);
  float pSdf = 0.0;
  vec3 pN = vec3(0.0, 0.0, 1.0);
  int pIndex = -1;
  for (int i = 0; i < MAX_PANELS; i++) {
    if (i >= uPanelCount) break;
    if (uPanelRise[i] <= 0.001) continue;
    vec2 uv;
    float sdf;
    vec3 n;
    float t = hitPanel(uCamPos, dir, i, 0.0, uv, sdf, n);
    if (t < 0.0) t = hitPanel(uCamPos, dir, i, pixel * 1e3, uv, sdf, n); // edge pixels
    if (t > 0.0 && t < tPanel && sdf < pixel * t * 1.5) {
      tPanel = t;
      pUv = uv;
      pSdf = sdf;
      pN = n;
      pIndex = i;
    }
  }

  vec3 col;

  // ── Water ──
  if (hitWater) {
    vec2 rel = P.xz - uCamPos.xz;
    float lost;
    vec3 n = waterNormal(P.xz, fw, lost);
    n = normalize(n + vec3(-rel.x, 0.0, -rel.y) * uCurvature);
    vec3 v = -dir;
    float nv = max(dot(n, v), 0.0);
    float fres = 0.02 + 0.98 * pow(1.0 - nv, 5.0);

    vec3 r = reflect(dir, n);
    r.y = abs(r.y);
    vec3 refl = sky(r, false);
    // The screens, reflected (wobbling with the waves, a little soft)
    for (int i = 0; i < MAX_PANELS; i++) {
      if (i >= uPanelCount) break;
      if (uPanelRise[i] <= 0.001) continue;
      vec2 uv;
      float sdf;
      vec3 pn;
      float t = hitPanel(P + vec3(0.0, 0.002, 0.0), r, i, 0.0, uv, sdf, pn);
      if (t > 0.0) {
        refl = panelPicture(i, uv, 2.0) * 1.1;
        fres = max(fres, 0.14); // a lit screen shows in the water even from above
      }
    }

    float rough = sqrt(0.006 + lost * 1.6);
    col = uBase * 0.55 + refl * fres;

    // Light spilling from the screens onto the water in front of them
    for (int i = 0; i < MAX_PANELS; i++) {
      if (i >= uPanelCount) break;
      if (uPanelRise[i] <= 0.001) continue;
      vec3 glowCol = uPanelGlow[i];
      float across = exp(-abs(P.x - uPanelX[i]) / 9.0);
      float ahead = exp(-max(P.z, 0.0) / 7.0) * step(-0.5, P.z);
      col += glowCol * across * ahead * uPanelRise[i] * 0.35;
    }

    // The cursor's light: a glittering path on the water, and a soft pool
    vec3 toL = uLight - P;
    float dL = length(toL);
    vec3 l = toL / dL;
    vec3 hv = normalize(l + v);
    float atten = uLightOn / (1.0 + dL * dL / 300.0);
    // Keep the water behind the text (the left of the view) calmer
    float calm = 1.0 - smoothstep(0.36, 0.5, vUv.x);
    col += LAMP * ggx(max(dot(n, hv), 0.0), rough) * max(dot(n, l), 0.0) * atten * 0.05 * (1.0 - 0.65 * calm);
    col += LAMP * 0.02 * atten * exp(-length(P.xz - uLight.xz) * 0.25);

    // The dawn sun's glitter path (handoff only)
    vec3 hs = normalize(uSunDir + v);
    col += vec3(0.7, 0.5, 1.0) * ggx(max(dot(n, hs), 0.0), rough + 0.02) * uDawn * 0.035 * fres * 4.0;

    // Far water fades into the page's dark, so the horizon line stands alone
    float fog = 1.0 - exp(-tWater / 1400.0);
    col = mix(col, uBase, fog);
  } else {
    col = sky(dir, true);
  }

  // ── A screen, if it's in front of the water ──
  if (pIndex >= 0 && tPanel < tWater) {
    vec3 q = uCamPos + dir * tPanel;
    vec3 v = -dir;
    vec3 pic = panelPicture(pIndex, pUv, 0.0) * 0.9;
    // Glass: a soft sheen where the cursor's light catches it
    vec3 toL = uLight - q;
    float dL = length(toL);
    vec3 l = toL / dL;
    vec3 hv = normalize(l + v);
    float sheen = ggx(max(dot(pN, hv), 0.0), 0.16) * max(dot(pN, l), 0.0) / (1.0 + dL * dL / 250.0);
    vec3 glass = pic + LAMP * sheen * 0.012 * uLightOn;
    // A thin lit frame, and a bright seam where it leaves the water
    float px = pixel * tPanel;
    float frame = 1.0 - smoothstep(px * 0.6, px * 2.2, abs(pSdf + px * 1.5));
    glass += vec3(0.55, 0.52, 0.66) * frame * 0.35;
    glass += vec3(0.62, 0.5, 1.0) * exp(-q.y * 14.0) * 0.35;
    float coverage = clamp(0.5 - pSdf / px, 0.0, 1.0);
    col = mix(col, glass, coverage);
  }

  gl_FragColor = vec4(toSrgb(toneMap(col)), 1.0);
}
`
