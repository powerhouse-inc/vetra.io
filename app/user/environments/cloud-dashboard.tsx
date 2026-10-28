'use client'

import { Boxes, Plus } from 'lucide-react'
import Link from 'next/link'

import { useStandaloneEnvFilter } from '@/modules/apps/hooks/use-apps'
import { splitEnvironments } from '@/modules/apps/lib/split'
import { useEnvironments } from '@/modules/cloud/hooks/use-environment'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import { PageHeader } from '@/modules/shared/components/page-header'
import { Button } from '@/modules/shared/components/ui/button'
import { CloudEnvironments } from './cloud-projects'

export function CloudDashboard() {
  // Envs managed by an App (production + previews) live on their App's page.
  const { appIds, isStandalone } = useStandaloneEnvFilter()
  const { orgId, org } = useActiveOrg()
  const { standalone: environments, appOwned } = splitEnvironments(
    useEnvironments('MINE', null, { orgId }).environments,
    appIds,
  )
  const readyCount = environments.filter((e) => e.state.status === 'READY').length
  const totalPackages = environments.reduce((sum, e) => sum + e.state.packages.length, 0)

  return (
    <main className="mx-auto mt-20 max-w-screen-xl space-y-8 px-6 py-8">
      <PageHeader
        title={org ? `${org.name} environments` : 'Your environments'}
        description="Environments you manage by hand, not linked to an app."
        actions={
          <Button asChild>
            <Link href="/user/environments/new">
              <Plus className="h-4 w-4" />
              New environment
            </Link>
          </Button>
        }
      />

      {environments.length > 0 && (
        <div className="flex gap-6">
          <div className="bg-card border-border rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs font-medium">Environments</p>
            <p className="text-2xl font-bold">{environments.length}</p>
          </div>
          <div className="bg-card border-border rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs font-medium">Ready</p>
            <p className="text-success text-2xl font-bold">{readyCount}</p>
          </div>
          <div className="bg-card border-border rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs font-medium">Packages</p>
            <p className="text-2xl font-bold">{totalPackages}</p>
          </div>
        </div>
      )}

      {appOwned.length > 0 && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Boxes className="h-4 w-4" aria-hidden />
          {appOwned.length} environment{appOwned.length === 1 ? ' is' : 's are'} managed by your
          apps.
          <Link href="/user" className="text-primary hover:underline">
            View apps
          </Link>
        </p>
      )}

      <CloudEnvironments filter={isStandalone} />
    </main>
  )
}
