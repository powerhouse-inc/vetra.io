// Logo and cover preparation, ported from renown.id's avatar cropper
// (utils/image-crop.ts, identity hub phase 1) and generalised to an aspect
// ratio. The math is pure (and unit tested); rendering needs a canvas.

export type ImageKind = 'logo' | 'cover'

export const IMAGE_SPECS = {
  logo: {
    label: 'Logo',
    aspect: 1,
    width: 512,
    height: 512,
    maxBytes: 1024 * 1024,
    hint: 'Square, ideally 512×512 or larger. PNG, JPEG or WebP up to 2 MB.',
  },
  cover: {
    label: 'Cover',
    aspect: 3,
    width: 1500,
    height: 500,
    maxBytes: 2 * 1024 * 1024,
    hint: 'Wide 3:1, ideally 1500×500 or larger. PNG, JPEG or WebP up to 2 MB.',
  },
} as const

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const
/** Largest source file accepted (before resizing). */
export const MAX_SOURCE_BYTES = 2 * 1024 * 1024
export const MIN_ZOOM = 1
export const MAX_ZOOM = 4

export interface CropState {
  /** 1 = the largest centred region; 4 = a quarter of its width. */
  zoom: number
  /** Pan of the region's centre, -1 (left/top edge) … 1 (right/bottom edge). */
  panX: number
  panY: number
}

/** The source rectangle (in image pixels) a crop selects. */
export interface CropRegion {
  sx: number
  sy: number
  sw: number
  sh: number
}

export const INITIAL_CROP: CropState = { zoom: 1, panX: 0, panY: 0 }

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Why `file` can't be used as a source image, or null when it can. */
export function sourceImageProblem(file: { type: string; size: number }): string | null {
  if (!(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return 'Choose a PNG, JPEG or WebP image.'
  }
  if (file.size > MAX_SOURCE_BYTES) return 'Choose an image of at most 2 MB.'
  return null
}

/** Unrounded region size and slack, shared by cropRegion and panBy. */
function geometry(width: number, height: number, aspect: number, zoom: number) {
  const sw = Math.min(width, height * aspect) / clamp(zoom, MIN_ZOOM, MAX_ZOOM)
  const sh = sw / aspect
  return { sw, sh, slackX: (width - sw) / 2, slackY: (height - sh) / 2 }
}

/** The largest centred `aspect` (width/height) region, shrunk by zoom and moved by pan; always inside the image. */
export function cropRegion(width: number, height: number, aspect: number, crop: CropState): CropRegion {
  const { sw, sh, slackX, slackY } = geometry(width, height, aspect, crop.zoom)
  return {
    sx: Math.round(slackX + clamp(crop.panX, -1, 1) * slackX),
    sy: Math.round(slackY + clamp(crop.panY, -1, 1) * slackY),
    sw: Math.round(sw),
    sh: Math.round(sh),
  }
}

/** The pan after dragging by (dx, dy) screen pixels in a viewport `viewportWidth` pixels wide. */
export function panBy(
  crop: CropState,
  width: number,
  height: number,
  aspect: number,
  viewportWidth: number,
  dx: number,
  dy: number,
): CropState {
  const { sw, slackX, slackY } = geometry(width, height, aspect, crop.zoom)
  const scale = sw / viewportWidth
  return {
    ...crop,
    panX: slackX > 0 ? clamp(crop.panX - (dx * scale) / slackX, -1, 1) : 0,
    panY: slackY > 0 ? clamp(crop.panY - (dy * scale) / slackY, -1, 1) : 0,
  }
}

function encode(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode the image.'))), type, quality),
  )
}

/**
 * Draws the crop at the kind's output size and encodes WebP (JPEG where the
 * browser cannot encode WebP and silently answers PNG, e.g. Safari), lowering the
 * quality until it fits the cap.
 */
export async function renderImage(image: HTMLImageElement, kind: ImageKind, crop: CropState): Promise<Blob> {
  const spec = IMAGE_SPECS[kind]
  const { sx, sy, sw, sh } = cropRegion(image.naturalWidth, image.naturalHeight, spec.aspect, crop)
  const canvas = document.createElement('canvas')
  canvas.width = spec.width
  canvas.height = spec.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot resize images.')
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, sx, sy, sw, sh, 0, 0, spec.width, spec.height)
  let type = 'image/webp'
  for (const quality of [0.9, 0.75, 0.6]) {
    let blob = await encode(canvas, type, quality)
    if (blob.type !== type && type === 'image/webp') {
      // The browser ignored the WebP request (it falls back to PNG): use JPEG, which honours quality.
      type = 'image/jpeg'
      blob = await encode(canvas, type, quality)
    }
    if (blob.size <= spec.maxBytes) return blob
  }
  throw new Error(`This ${kind} is still too large after compression. Try a simpler image.`)
}

/** Lowercase hex SHA-256 of the bytes (WebCrypto). */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}
