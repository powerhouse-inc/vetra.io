import { ExternalLink, Package, Server, Trash2 } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/components/ui/card'
import { StatusPill } from './status-pill'
import type { MockEnv } from './mock-data'

/**
 * IDEATION ONLY — a user-owned environment that nests under the Studio header.
 * Mirrors the existing CloudEnvironmentCard (full Manage / Visit / Delete
 * controls) to emphasise the owned-vs-managed split: owned envs keep full
 * control, the managed Studio above does not.
 */
export function OwnedEnvCard({ env }: { env: MockEnv }) {
  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-4 w-4" />
            {env.name}
          </CardTitle>
          <span className="text-muted-foreground truncate text-sm">{env.subdomain}</span>
        </div>
        <StatusPill status={env.status} />
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="flex items-center gap-4 text-sm">
          <div className="text-muted-foreground flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5" />
            {env.packageCount} package{env.packageCount !== 1 ? 's' : ''}
          </div>
          <div className="text-muted-foreground text-xs">{env.services.join(', ')}</div>
        </div>

        <div className="flex gap-2">
          <Button variant="default" size="sm" className="flex-1">
            Manage
          </Button>
          <Button variant="outline" size="sm" className="shrink-0">
            <ExternalLink className="h-4 w-4" />
            Visit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-destructive hover:border-destructive shrink-0"
            title="Delete environment"
            aria-label="Delete environment"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
