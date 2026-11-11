'use client'

import { useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { GeneratedAvatar } from '@/modules/shared/components/generated-avatar'
import { AppAvatar } from '../app-avatar'

/**
 * The app's logo image; without one (or when it fails to load), renown.id's avatar generated
 * from the app's DID, or the monogram tile for an app with no Renown identity.
 */
export function AppLogo({
  name,
  seed,
  src,
  appDid,
  size = 'lg',
  className,
}: {
  name: string
  seed: string
  src: string | null
  /** The app's Renown identity, which renown.id seeds its generated avatar with. */
  appDid?: string | null
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
  if (appDid) {
    return (
      <GeneratedAvatar
        seed={appDid}
        className={cn(size === 'md' ? 'h-10 w-10 rounded-xl' : 'h-16 w-16 rounded-2xl', className)}
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
