'use client'

import { User } from 'lucide-react'
import { useState } from 'react'
import { usePersonName } from '@/modules/shared/hooks/use-person-name'
import { cn } from '@/modules/shared/lib/utils'

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/** A person's Renown picture, or a plain person icon without one (or when it fails to load). */
function PersonAvatar({ src, name }: { src: string | null; name: string }) {
  const [failed, setFailed] = useState<string | null>(null)
  if (src && failed !== src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Renown /media 302s to short-lived storage URLs
      <img
        src={src}
        alt={name}
        onError={() => setFailed(src)}
        className="h-4 w-4 shrink-0 rounded-full object-cover"
      />
    )
  }
  return (
    <span
      aria-hidden
      className="bg-muted text-muted-foreground inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
    >
      <User className="h-2.5 w-2.5" />
    </span>
  )
}

/**
 * A person, by Renown profile name (else ENS name, else the short address), with the full
 * address as a tooltip. `avatar` puts their Renown picture in front, for lists; leave it off
 * inside sentences. Anything that is not an address or did:pkh is shown as given.
 */
export function PersonName({
  value,
  className,
  avatar = false,
}: {
  value: string
  className?: string
  avatar?: boolean
}) {
  const { name, avatarUrl, address } = usePersonName(value)
  if (!address) return <span className={className}>{value}</span>
  const label = name ?? shortAddress(address)
  if (!avatar) {
    return (
      <span title={address} className={className}>
        {label}
      </span>
    )
  }
  return (
    <span title={address} className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <PersonAvatar src={avatarUrl} name={label} />
      <span className="truncate">{label}</span>
    </span>
  )
}
