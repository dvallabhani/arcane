import { CanvasTexture, SRGBColorSpace } from 'three'

let glow: CanvasTexture | null = null

/**
 * A soft white radial gradient drawn on a canvas at runtime. Tinted and
 * additively blended, it fakes a "bloom" glow without any post-processing or
 * image files.
 */
export function getGlowTexture(): CanvasTexture {
  if (glow) return glow
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.18, 'rgba(255,255,255,0.65)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.18)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  glow = new CanvasTexture(canvas)
  glow.colorSpace = SRGBColorSpace
  return glow
}

let beam: CanvasTexture | null = null

/** Vertical fade (bright at the bottom, gone at the top) for the light beam. */
export function getBeamTexture(): CanvasTexture {
  if (beam) return beam
  const canvas = document.createElement('canvas')
  canvas.width = 4
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  // Canvas y=0 is the top of the image, which maps to the top of the cylinder.
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(0.55, 'rgba(90,90,90,1)')
  g.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 128)
  beam = new CanvasTexture(canvas)
  beam.colorSpace = SRGBColorSpace
  return beam
}
