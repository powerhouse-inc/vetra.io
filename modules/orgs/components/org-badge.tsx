'use client'

import { BadgeCheck, Building2 } from 'lucide-react'
import { useOrgSummary } from '../hooks/use-orgs'
import { orgAvatarUrl, renownOrgPageUrl } from '../lib/links'

/** The organisation owning an app or environment, linked to its Renown page. */
export function OrgBadge({
  orgId,
  size = 'sm',
}: {
  orgId: string | null | undefined
  size?: 'sm' | 'md'
}) {
  const { data: org } = useOrgSummary(orgId)
  if (!orgId || !org) return null
  const avatar = orgAvatarUrl(org)
  const verified = org.verifiedDomains[0]
  return (
    <a
      href={renownOrgPageUrl(org.handle)}
      target="_blank"
      rel="noreferrer"
      className={`bg-muted text-foreground hover:bg-muted/70 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${size === 'md' ? 'text-sm' : 'text-xs'}`}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- Renown media redirects to storage.
        <img src={avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 truncate">{org.name}</span>
      {verified && (
        <BadgeCheck
          className="text-primary h-3.5 w-3.5 shrink-0"
          aria-label={`Verified: ${verified}`}
        />
      )}
    </a>
  )
}
