'use client'

import { Bot, Plus } from 'lucide-react'
import { useMemo } from 'react'
import type { PackageManifest } from '@/modules/cloud/config/types'
import type {
  ClintRuntimeEndpointsForPrefix,
  CloudEnvironment,
  CloudEnvironmentService,
  CloudServiceClintConfig,
  Pod,
} from '@/modules/cloud/types'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { AgentCard } from './agent-card'

type Props = {
  services: CloudEnvironmentService[]
  env: CloudEnvironment | null
  canEdit: boolean
  /**
   * The cluster tenant id derived from the environment subdomain. Threaded
   * into AgentCard so its save path can route secret env entries through
   * setTenantSecret (encrypted at-rest) instead of through the document.
   * Null before the environment has been initialized.
   */
  tenantId: string | null
  onAddAgent?: () => void
  manifests?: Record<string, PackageManifest>
  /** prefix → runtime-announced endpoints (from observability subgraph). */
  runtimeEndpointsByPrefix?: Record<string, ClintRuntimeEndpointsForPrefix>
  /** All pods in the env namespace; each card filters to its own. */
  pods?: readonly Pod[]
  /**
   * If set, each agent card renders a "Details" button that calls this with
   * the agent's prefix instead of inline-expanding. The drawer is the new
   * edit surface for logs/metrics/activity/config.
   */
  onOpenDetail?: (prefix: string) => void
  onSaveConfig?: (prefix: string, config: CloudServiceClintConfig) => Promise<void>
  onDisable?: (prefix: string) => Promise<void>
}

export function AgentsSection({
  services,
  env,
  canEdit,
  tenantId,
  onAddAgent,
  manifests,
  runtimeEndpointsByPrefix,
  pods,
  onOpenDetail,
  onSaveConfig,
  onDisable,
}: Props) {
  const clintServices = useMemo(
    () =>
      services
        // Disabled clints stay in the doc model (no remove operation exists
        // — disable just flips enabled=false), but for the user "Remove
        // agent" should make them disappear. Filter them out here so the
        // list reflects what's actually deployed.
        .filter((s) => s.type === 'CLINT' && s.enabled)
        .sort((a, b) => a.prefix.localeCompare(b.prefix)),
    [services],
  )

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Agents</h2>
          {clintServices.length > 0 && (
            <Badge variant="secondary" className="rounded-full">
              {clintServices.length}
            </Badge>
          )}
        </div>
        {canEdit && (
          <Button size="sm" onClick={onAddAgent} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Add Agent
          </Button>
        )}
      </div>
      {clintServices.length === 0 ? (
        <div className="text-muted-foreground bg-muted/30 flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <div className="bg-background flex h-12 w-12 items-center justify-center rounded-full border">
            <Bot className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <p className="text-foreground text-sm font-medium">No agents yet</p>
            <p className="text-xs">
              Install your first agent — they&rsquo;re packages whose name ends in -cli.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={onAddAgent} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add Agent
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {clintServices.map((s) => (
            <AgentCard
              key={s.prefix}
              service={s}
              env={env}
              canEdit={canEdit}
              tenantId={tenantId}
              manifest={s.config ? (manifests?.[s.config.package.name] ?? null) : null}
              runtimeEndpoints={runtimeEndpointsByPrefix?.[s.prefix] ?? null}
              pods={pods}
              onOpenDetail={onOpenDetail ? () => onOpenDetail(s.prefix) : undefined}
              onSave={onSaveConfig ? (cfg) => onSaveConfig(s.prefix, cfg) : undefined}
              onDisable={onDisable ? () => onDisable(s.prefix) : undefined}
            />
          ))}
        </div>
      )}
    </section>
  )
}
