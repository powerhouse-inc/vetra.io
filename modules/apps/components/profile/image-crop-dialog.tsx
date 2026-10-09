'use client'

import { Loader2, ZoomIn, ZoomOut } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { Slider } from '@/modules/shared/components/ui/slider'
import { cn } from '@/shared/lib/utils'
import {
  cropRegion,
  IMAGE_SPECS,
  INITIAL_CROP,
  MAX_ZOOM,
  MIN_ZOOM,
  panBy,
  renderImage,
  type CropState,
  type ImageKind,
} from '../../lib/app-profile/image'

const VIEWPORT_WIDTH = 360

/** Drag to position, slide to zoom; produces the kind's output image (WebP). */
export function ImageCropDialog({
  image,
  kind,
  onCancel,
  onDone,
}: {
  image: HTMLImageElement
  kind: ImageKind
  onCancel: () => void
  onDone: (blob: Blob) => void
}) {
  const spec = IMAGE_SPECS[kind]
  const viewportHeight = Math.round(VIEWPORT_WIDTH / spec.aspect)
  const canvas = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const width = image.naturalWidth
  const height = image.naturalHeight

  useEffect(() => {
    const context = canvas.current?.getContext('2d')
    if (!context) return
    const { sx, sy, sw, sh } = cropRegion(width, height, spec.aspect, crop)
    context.clearRect(0, 0, VIEWPORT_WIDTH, viewportHeight)
    context.drawImage(image, sx, sy, sw, sh, 0, 0, VIEWPORT_WIDTH, viewportHeight)
  }, [image, width, height, crop, spec.aspect, viewportHeight])

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY }
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x
    const dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    // The canvas may be drawn narrower than its 360 px on small screens.
    const shown = e.currentTarget.clientWidth || VIEWPORT_WIDTH
    setCrop((c) => panBy(c, width, height, spec.aspect, shown, dx, dy))
  }

  const PAN_STEP = 12
  function onKeyDown(e: KeyboardEvent<HTMLCanvasElement>) {
    const shown = e.currentTarget.clientWidth || VIEWPORT_WIDTH
    const step = e.shiftKey ? PAN_STEP * 4 : PAN_STEP
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = moves[e.key]
    if (move) {
      e.preventDefault()
      setCrop((c) => panBy(c, width, height, spec.aspect, shown, move[0], move[1]))
    } else if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      setCrop((c) => ({ ...c, zoom: Math.min(MAX_ZOOM, c.zoom + 0.1) }))
    } else if (e.key === '-') {
      e.preventDefault()
      setCrop((c) => ({ ...c, zoom: Math.max(MIN_ZOOM, c.zoom - 0.1) }))
    }
  }

  function endDrag() {
    drag.current = null
  }

  async function done() {
    setBusy(true)
    setProblem(null)
    try {
      onDone(await renderImage(image, kind, crop))
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Could not prepare the image.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onCancel()
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={!busy}
        onOpenAutoFocus={(e) => {
          // Land on the crop area so the arrow keys work straight away.
          e.preventDefault()
          canvas.current?.focus()
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
        onInteractOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Position the {kind}</DialogTitle>
          <DialogDescription>
            Drag or use the arrow keys to move it, the slider or + and - to zoom. It is saved at{' '}
            {spec.width}×{spec.height}.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center">
          <canvas
            ref={canvas}
            width={VIEWPORT_WIDTH}
            height={viewportHeight}
            tabIndex={0}
            role="img"
            aria-label={`Crop area for the ${kind}. Arrow keys move it, plus and minus zoom.`}
            className={cn(
              'bg-muted ring-border focus-visible:ring-ring h-auto w-full max-w-[360px] cursor-grab touch-none ring-1 focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing',
              kind === 'logo' ? 'rounded-2xl' : 'rounded-xl',
            )}
            onKeyDown={onKeyDown}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
          />
        </div>
        <div className="flex items-center gap-3">
          <ZoomOut className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
          <Slider
            aria-label="Zoom"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={[crop.zoom]}
            onValueChange={(values) => setCrop((c) => ({ ...c, zoom: values[0] ?? c.zoom }))}
          />
          <ZoomIn className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
        </div>
        {problem && (
          <p className="text-destructive text-sm" role="alert">
            {problem}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void done()} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Use this crop
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
