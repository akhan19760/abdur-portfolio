/**
 * The pictures on the projects' screens, packed into one canvas the sea's
 * shader samples (a texture atlas, two screens per row).
 *
 * A project with an `image` shows that picture, cover-fitted. One without
 * gets a placeholder: a dark mock of a web page with the project's name on
 * it, labelled as a placeholder, so it still reads as "a project" until a
 * real screenshot is added.
 */

import type { Project } from "@/types/projects"

export const SLOT_WIDTH = 1024
export const SLOT_HEIGHT = 576 // 16:9, the screens' shape
const COLUMNS = 2

export type AtlasLayout = {
  columns: number
  rows: number
  width: number
  height: number
}

/** Size of the atlas for `count` screens. */
export function atlasLayout(count: number): AtlasLayout {
  const columns = COLUMNS
  const rows = Math.max(1, Math.ceil(count / columns))
  return { columns, rows, width: columns * SLOT_WIDTH, height: rows * SLOT_HEIGHT }
}

/** Top-left corner (px) of a screen's slot in the atlas. */
export function slotOrigin(index: number, layout: AtlasLayout): { x: number; y: number } {
  return {
    x: (index % layout.columns) * SLOT_WIDTH,
    y: Math.floor(index / layout.columns) * SLOT_HEIGHT,
  }
}

/** Source rectangle that cover-fits an image into a slot (centred crop). */
export function coverCrop(
  imageWidth: number,
  imageHeight: number
): { sx: number; sy: number; sw: number; sh: number } {
  const slotRatio = SLOT_WIDTH / SLOT_HEIGHT
  if (imageWidth / imageHeight > slotRatio) {
    const sw = imageHeight * slotRatio
    return { sx: (imageWidth - sw) / 2, sy: 0, sw, sh: imageHeight }
  }
  const sh = imageWidth / slotRatio
  return { sx: 0, sy: (imageHeight - sh) / 2, sw: imageWidth, sh }
}

// ── Drawing (browser only) ──────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** A dark mock web page with the project's name: the stand-in for a screenshot. */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  name: string,
  x: number,
  y: number,
  label: string
) {
  const w = SLOT_WIDTH
  const h = SLOT_HEIGHT
  ctx.save()
  ctx.translate(x, y)

  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, "#131318")
  bg.addColorStop(1, "#0c0c10")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // Browser bar
  ctx.fillStyle = "#191920"
  ctx.fillRect(0, 0, w, 40)
  ;["#34343d", "#34343d", "#34343d"].forEach((c, i) => {
    ctx.fillStyle = c
    ctx.beginPath()
    ctx.arc(24 + i * 20, 20, 6, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.fillStyle = "#22222a"
  roundRect(ctx, 100, 11, 380, 18, 9)
  ctx.fill()

  // Hero: the name, two lines of copy, a button
  ctx.fillStyle = "#f0ede8"
  ctx.font = "700 60px Outfit, system-ui, sans-serif"
  ctx.textBaseline = "alphabetic"
  let size = 60
  while (ctx.measureText(name).width > 500 && size > 28) {
    size -= 4
    ctx.font = `700 ${size}px Outfit, system-ui, sans-serif`
  }
  ctx.fillText(name, 64, 160)
  ctx.fillStyle = "#2c2c35"
  roundRect(ctx, 64, 190, 400, 12, 6)
  ctx.fill()
  roundRect(ctx, 64, 214, 300, 12, 6)
  ctx.fill()
  ctx.fillStyle = "#9900fa"
  roundRect(ctx, 64, 256, 132, 38, 19)
  ctx.fill()

  // Picture block with a soft light in it
  const art = ctx.createLinearGradient(600, 80, 960, 330)
  art.addColorStop(0, "#1f1f28")
  art.addColorStop(1, "#15151b")
  ctx.fillStyle = art
  roundRect(ctx, 600, 78, 360, 250, 14)
  ctx.fill()
  const glow = ctx.createRadialGradient(830, 170, 0, 830, 170, 150)
  glow.addColorStop(0, "rgba(153,0,250,0.28)")
  glow.addColorStop(1, "rgba(153,0,250,0)")
  ctx.fillStyle = glow
  roundRect(ctx, 600, 78, 360, 250, 14)
  ctx.fill()

  // Three cards
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = "#18181f"
    roundRect(ctx, 64 + i * 304, 380, 288, 120, 12)
    ctx.fill()
    ctx.fillStyle = "#2a2a33"
    roundRect(ctx, 88 + i * 304, 408, 150, 10, 5)
    ctx.fill()
    roundRect(ctx, 88 + i * 304, 430, 220, 10, 5)
    ctx.fill()
    roundRect(ctx, 88 + i * 304, 452, 180, 10, 5)
    ctx.fill()
  }

  // Say what it is
  ctx.fillStyle = "#5a5a66"
  ctx.font = "500 14px 'JetBrains Mono', monospace"
  ctx.textAlign = "right"
  ctx.fillText(label, w - 24, h - 22)
  ctx.restore()
}

/**
 * Each screen's average colour (linear light), for the glow its picture casts
 * on the water. Read once per atlas change on a 1×1 canvas, so the shader
 * doesn't sample a blurred texture for every pixel of water.
 */
export function averageSlotColors(
  atlas: HTMLCanvasElement,
  layout: AtlasLayout,
  count: number
): [number, number, number][] {
  const probe = document.createElement("canvas")
  probe.width = 1
  probe.height = 1
  const ctx = probe.getContext("2d", { willReadFrequently: true })
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return Array.from({ length: count }, (_, index) => {
    if (!ctx) return [0, 0, 0]
    const { x, y } = slotOrigin(index, layout)
    ctx.clearRect(0, 0, 1, 1)
    ctx.drawImage(atlas, x, y, SLOT_WIDTH, SLOT_HEIGHT, 0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    return [toLinear(r), toLinear(g), toLinear(b)]
  })
}

/**
 * Draws every screen's picture into one canvas. Placeholders are drawn at
 * once; real images are drawn as they load, calling `onChange` each time so
 * the texture can be re-uploaded. Returns null without canvas support.
 */
export function buildAtlas(
  projects: Pick<Project, "name" | "image">[],
  placeholderLabel: string,
  onChange: () => void
): { canvas: HTMLCanvasElement; layout: AtlasLayout; dispose: () => void } | null {
  const layout = atlasLayout(projects.length)
  const canvas = document.createElement("canvas")
  canvas.width = layout.width
  canvas.height = layout.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  let disposed = false
  projects.forEach((project, index) => {
    const { x, y } = slotOrigin(index, layout)
    drawPlaceholder(ctx, project.name, x, y, placeholderLabel)
    if (!project.image) return
    const img = new Image()
    img.decoding = "async"
    img.onload = () => {
      if (disposed) return
      const crop = coverCrop(img.naturalWidth, img.naturalHeight)
      ctx.drawImage(
        img,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        x,
        y,
        SLOT_WIDTH,
        SLOT_HEIGHT
      )
      onChange()
    }
    img.src = project.image
  })

  return {
    canvas,
    layout,
    dispose: () => {
      disposed = true
    },
  }
}
