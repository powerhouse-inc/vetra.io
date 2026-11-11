'use client'

import { useState } from 'react'
import { GeneratedAvatar } from '@/modules/shared/components/generated-avatar'
import { usePersonName } from '@/modules/shared/hooks/use-person-name'
import { cn } from '@/modules/shared/lib/utils'

export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`

/** A person's Renown picture, else renown.id's avatar generated from their address. */
function PersonAvatar({
  src,
  name,
  address,
}: {
  src: string | null
  name: string
  address: string
}) {
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
  return <GeneratedAvatar seed={address} className="h-4 w-4 rounded-full" />
}

/**
 * A person, by Renown profile name (else ENS name, else the short address), with the full
 * address as a tooltip. `avatar` puts their Renown picture (or generated avatar) in front, for lists; leave it off
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
      <PersonAvatar src={avatarUrl} name={label} address={address} />
      <span className="truncate">{label}</span>
    </span>
  )
}
