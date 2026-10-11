'use client'

import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { useQuery } from '@tanstack/react-query'
import { fetchRenownAvatarProfile, resolveAvatarUrl } from '@/modules/shared/lib/renown-avatar'

/**
 * Image URL for the signed-in Renown user, or undefined for the fallback.
 *
 * The first paint uses the session's seeded profile (cookie / localStorage),
 * which may be stale and never carries an uploaded avatar; a lightweight
 * lookup per address then swaps in what Renown has now. A failed lookup keeps
 * the seed; nothing waits on it.
 */
export function useRenownAvatarUrl(): string | undefined {
  const { address, user } = useRenownAuth()
  const ensAvatarUrl = user?.ens?.avatarUrl
  const lower = address?.toLowerCase()

  const { data: profile, isSuccess } = useQuery({
    queryKey: ['renown-avatar', lower],
    queryFn: () => (lower ? fetchRenownAvatarProfile(lower) : null),
    enabled: !!lower,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const resolved = isSuccess
    ? resolveAvatarUrl({ profile, ensAvatarUrl })
    : resolveAvatarUrl({ profile: user?.profile, ensAvatarUrl })
  return resolved ?? undefined
}
