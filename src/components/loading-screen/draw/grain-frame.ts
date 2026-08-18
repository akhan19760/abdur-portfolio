/**
 * Generates one frame of random pixel noise on a low-res buffer.
 * Bilinear browser scaling blurs this into continuous film-grain texture.
 */
export function drawGrainFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
): void {
  const img = ctx.createImageData(width, height)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() * 255
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = Math.random() * 10 // ~4% max alpha per pixel
  }
  ctx.putImageData(img, 0, 0)
}
