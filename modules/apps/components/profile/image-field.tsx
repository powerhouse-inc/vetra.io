'use client'

import { ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import { IMAGE_SPECS, sourceImageProblem, type ImageKind } from '../../lib/app-profile/image'
import { renownMediaUrl } from '../../lib/app-profile/renown'
import { uploadRenownImage } from '../../lib/app-profile/upload'
import { ImageCropDialog } from './image-crop-dialog'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      // Decoded: the pixels stay available without the object URL.
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This file could not be read as an image.'))
    }
    image.src = url
  })
}

/** Drop or pick an image → crop → upload to Renown; or remove the current one. */
export function ImageField({
  kind,
  documentId,
  value,
  previewUrl,
  fallbackUrl = null,
  getBearer,
  onUploaded,
  onClear,
  onBusyChange,
  error,
}: {
  kind: ImageKind
  /** The saved profile document, for showing the stored image. */
  documentId: string | null
  /** The ref the form holds (null = none). */
  value: string | null
  /** A local preview of an image uploaded in this session. */
  previewUrl: string | null
  /** Shown while there is no uploaded image (the legacy logo URL). */
  fallbackUrl?: string | null
  getBearer: () => Promise<string>
  onUploaded: (ref: string, previewUrl: string) => void
  onClear: () => void
  onBusyChange: (busy: boolean) => void
  error?: string
}) {
  const spec = IMAGE_SPECS[kind]
  const input = useRef<HTMLInputElement>(null)
  const [source, setSource] = useState<HTMLImageElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const shown =
    previewUrl ??
    (value ? (documentId ? renownMediaUrl(documentId, kind, value) : null) : fallbackUrl)

  async function choose(file: File | undefined) {
    if (!file) return
    const refused = sourceImageProblem(file)
    if (refused) {
      setProblem(refused)
      return
    }
    setProblem(null)
    try {
      setSource(await loadImage(file))
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'This file could not be read as an image.')
    }
  }

  async function upload(blob: Blob) {
    setSource(null)
    setUploading(true)
    onBusyChange(true)
    try {
      const ref = await uploadRenownImage(blob, kind, await getBearer())
      onUploaded(ref, URL.createObjectURL(blob))
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      onBusyChange(false)
    }
  }

  function onDrop(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    setDragging(false)
    void choose(e.dataTransfer.files[0])
  }

  const message = problem ?? error
  const errorId = `image-${kind}-error`
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{spec.label}</p>
        <p className="text-muted-foreground text-xs">{spec.hint}</p>
      </div>
      <div className={cn('flex gap-4', kind === 'logo' ? 'items-center' : 'flex-col')}>
        <button
          type="button"
          aria-label={shown ? `Replace ${kind}` : `Add ${kind}`}
          aria-disabled={uploading || undefined}
          aria-describedby={message ? errorId : undefined}
          onClick={() => {
            if (!uploading) input.current?.click()
          }}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'bg-muted/40 border-border hover:border-foreground/30 relative flex shrink-0 items-center justify-center overflow-hidden border border-dashed transition-colors',
            kind === 'logo' ? 'h-24 w-24 rounded-2xl' : 'aspect-[3/1] w-full rounded-xl',
            shown && 'border-solid',
            dragging && 'border-primary bg-primary/5',
          )}
        >
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- Renown /media 302s to short-lived storage URLs
            <img src={shown} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-muted-foreground flex flex-col items-center gap-1 px-2 text-center text-xs">
              <ImagePlus className="h-5 w-5" aria-hidden />
              {kind === 'logo' ? 'Add logo' : 'Drop a cover image here, or click to choose one'}
            </span>
          )}
          {uploading && (
            <span className="bg-background/70 absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </span>
          )}
        </button>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-disabled={uploading || undefined}
            onClick={() => {
              if (!uploading) input.current?.click()
            }}
          >
            <Upload className="h-3.5 w-3.5" />
            {shown ? 'Replace' : 'Upload'}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" disabled={uploading} onClick={onClear}>
              <Trash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={`Upload ${kind}`}
        aria-describedby={message ? errorId : undefined}
        onChange={(e) => {
          void choose(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      {message && (
        <p id={errorId} className="text-destructive text-sm" role="alert">
          {message}
        </p>
      )}
      {source && (
        <ImageCropDialog
          image={source}
          kind={kind}
          onCancel={() => setSource(null)}
          onDone={(blob) => void upload(blob)}
        />
      )}
    </div>
  )
}
