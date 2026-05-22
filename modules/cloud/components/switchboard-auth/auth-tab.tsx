'use client'

import { useMemo } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'

import { createSwitchboardAuthClient } from '@/modules/cloud/lib/switchboard-auth-client'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/modules/shared/components/ui/tabs'

import { DocumentPermissionsTab } from './document-permissions-tab'
import { GroupsTab } from './groups-tab'
import { MyPermissionsTab } from './my-permissions-tab'

interface Props {
  /** Tenant switchboard base URL (from `service.url`). `null` when the env
   *  hasn't been provisioned yet or the service has no URL configured. */
  switchboardUrl: string | null
  /** The viewer's Ethereum address (lowercase). `null` when the viewer is
   *  unauthenticated; we show a sign-in banner in that case. */
  viewerAddress: string | null
  /** Whether the viewer owns this env. Owner-only sub-tabs render a
   *  placeholder otherwise. */
  canEdit: boolean
}

/**
 * The "Auth" sub-tab container inside the Switchboard service drawer.
 *
 * Hosts three sub-tabs that talk to the *tenant's* switchboard auth surface
 * (reactor-api's `DocumentPermissionService`):
 *  - My Permissions (read-only, always rendered)
 *  - Groups (owner-only)
 *  - Document Permissions (owner-only)
 *
 * Auth flows through {@link createSwitchboardAuthClient} which mints a
 * Renown bearer (no `aud` claim) and POSTs each query to
 * `${switchboardUrl}/graphql`.
 */
export function AuthTab({ switchboardUrl, viewerAddress, canEdit }: Props) {
  const renown = useRenown()

  // Memoise the client so each sub-tab's useEffect deps stay stable.
  const client = useMemo(
    () => (switchboardUrl ? createSwitchboardAuthClient(switchboardUrl, renown) : null),
    [switchboardUrl, renown],
  )

  if (!switchboardUrl) {
    return (
      <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
        Switchboard not yet running. The auth surface becomes available once the service is
        deployed.
      </p>
    )
  }

  if (!viewerAddress) {
    return (
      <div className="text-foreground bg-info/5 border-info/30 rounded-md border p-4 text-sm">
        <p className="font-semibold">Sign in with Renown</p>
        <p className="text-muted-foreground mt-1 text-xs">
          The Auth tab needs a signed Renown bearer to talk to the switchboard. Use the Renown
          button to log in and refresh the drawer.
        </p>
      </div>
    )
  }

  if (!client) return null

  return (
    <Tabs defaultValue="my-permissions" className="flex-1">
      <TabsList>
        <TabsTrigger value="my-permissions">My permissions</TabsTrigger>
        <TabsTrigger value="groups">Groups</TabsTrigger>
        <TabsTrigger value="documents">Document permissions</TabsTrigger>
      </TabsList>

      <TabsContent value="my-permissions" className="mt-4">
        <MyPermissionsTab client={client} viewerAddress={viewerAddress} />
      </TabsContent>

      <TabsContent value="groups" className="mt-4">
        {canEdit ? (
          <GroupsTab client={client} />
        ) : (
          <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
            Owner-only. Group management requires environment owner permissions on this switchboard.
          </p>
        )}
      </TabsContent>

      <TabsContent value="documents" className="mt-4">
        {canEdit ? (
          <DocumentPermissionsTab client={client} />
        ) : (
          <p className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
            Owner-only. Document permission management requires environment owner permissions on
            this switchboard.
          </p>
        )}
      </TabsContent>
    </Tabs>
  )
}
