'use client'
import { BadgeCheck, Building2, ExternalLink, Plus } from 'lucide-react'
import { TabErrorState } from '@/app/profile/components/tab-error-state'
import { useMyOrgs } from '@/modules/orgs/hooks/use-orgs'
import { orgAvatarUrl, renownCreateOrgUrl, renownOrgManageUrl } from '@/modules/orgs/lib/links'
import type { MyOrg, OrgRole } from '@/modules/orgs/types'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'

const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  PUBLISHER: 'Publisher',
  MEMBER: 'Member',
}

export function CreateOrgButton() {
  return (
    <Button asChild>
      <a href={renownCreateOrgUrl()} target="_blank" rel="noopener noreferrer">
        <Plus className="size-4" />
        New organisation
      </a>
    </Button>
  )
}

function OrgCard({ org }: { org: MyOrg }) {
  const avatar = orgAvatarUrl(org)
  const verified = org.verifiedDomains[0]
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element -- Renown media redirects to storage.
          <img src={avatar} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-lg">
            <Building2 className="text-muted-foreground size-5" aria-hidden />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium">{org.name}</span>
            {verified && (
              <BadgeCheck
                role="img"
                className="text-primary size-4 shrink-0"
                aria-label={`Verified: ${verified}`}
              />
            )}
          </div>
          <div className="text-muted-foreground truncate font-mono text-xs">
            @{org.handle} · {ROLE_LABEL[org.role]}
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <a
            href={renownOrgManageUrl(org.handle)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Manage ${org.name} on Renown`}
          >
            <span className="hidden sm:inline">Manage</span>
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      </CardContent>
    </Card>
  )
}

/** The viewer's Renown organisations. Renown owns membership; Vetra only lists and links. */
export function OrgsTab() {
  const { data, isLoading, isError, refetch } = useMyOrgs()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} data-testid="org-card-skeleton">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="bg-muted size-11 animate-pulse rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                <div className="bg-muted h-3 w-20 animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError && !data) {
    return (
      <TabErrorState message="Couldn’t load your organisations" onRetry={() => void refetch()} />
    )
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Building2 className="text-muted-foreground size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold">You’re not in an organisation yet</h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Organisations live on Renown. Create one there, or ask an admin to invite you; it
              shows up here once you’re a member.
            </p>
          </div>
          <CreateOrgButton />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {data.map((org) => (
        <OrgCard key={org.id} org={org} />
      ))}
    </div>
  )
}
