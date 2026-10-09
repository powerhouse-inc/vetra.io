'use client'

import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { AppAvatar } from '../app-avatar'

/** Legacy profile logos that may be shown: https URLs and raster data URLs. */
export function safeLegacyLogo(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https:\/\//i.test(url) || /^data:image\/(png|jpeg|webp|gif);base64,/i.test(url)
    ? url
    : null
}

/** The app's logo image, or its monogram tile when there is none (or it fails to load). */
export function AppLogo({
  name,
  seed,
  src,
  size = 'lg',
  className,
}: {
  name: string
  seed: string
  src: string | null
  size?: 'md' | 'lg'
  className?: string
}) {
  const [failed, setFailed] = useState<string | null>(null)
  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Renown /media 302s to short-lived storage URLs
      <img
        src={src}
        alt={`${name} logo`}
        onError={() => setFailed(src)}
        className={cn(
          'bg-card shrink-0 object-cover shadow-sm',
          size === 'md' ? 'h-10 w-10 rounded-xl' : 'h-16 w-16 rounded-2xl',
          className,
        )}
      />
    )
  }
  return (
    <AppAvatar
      name={name}
      seed={seed}
      size={size}
      className={cn(size === 'lg' && 'h-16 w-16 text-2xl', className)}
    />
  )
}
