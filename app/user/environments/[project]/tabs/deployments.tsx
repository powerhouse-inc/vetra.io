'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EventTimeline } from '@/modules/cloud/components/event-timeline'
import { useEnvironmentEvents } from '@/modules/cloud/hooks/use-environment-events'
import { useEnvironmentStatus } from '@/modules/cloud/hooks/use-environment-status'
import type { KubeEvent } from '@/modules/cloud/types'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'

type DeploymentsTabProps = {
  subdomain: string | null
  tenantId: string | null
  documentId: string
}

const BACKUP_REASONS = new Set(['BackupSchedule', 'Completed', 'Starting'])

function isBackupEvent(event: KubeEvent): boolean {
  return (
    BACKUP_REASONS.has(event.reason) &&
    (event.involvedObject.includes('Backup/') || event.involvedObject.includes('ScheduledBackup/'))
  )
}

type FilterMode = 'deployments' | 'all' | 'warnings'

export function DeploymentsTab({ subdomain, tenantId, documentId }: DeploymentsTabProps) {
  const { status } = useEnvironmentStatus(subdomain, tenantId, documentId)
  const {
    events,
    isLoading,
    refresh: eventsRefresh,
  } = useEnvironmentEvents(subdomain, tenantId, 50, documentId)
  const [filter, setFilter] = useState<FilterMode>('deployments')

  const showDriftBanner =
    status?.argoSyncStatus === 'OUT_OF_SYNC' || status?.configDriftDetected === true

  const filteredEvents = useMemo(() => {
    switch (filter) {
      case 'deployments':
        return events.filter((e) => !isBackupEvent(e))
      case 'warnings':
        return events.filter((e) => e.type === 'WARNING')
      case 'all':
      default:
        return events
    }
  }, [events, filter])

  return (
    <div className="space-y-4">
      {/* Sync Banner */}
      {showDriftBanner && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 pt-4">
            <AlertTriangle className="text-warning h-4 w-4 shrink-0" />
            <p className="text-warning dark:text-warning text-sm">
              {status?.configDriftDetected
                ? 'Configuration drift detected — the live state does not match the desired state.'
                : 'ArgoCD is out of sync — a deployment may be in progress or pending.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-md border p-1">
          {(['deployments', 'warnings', 'all'] as const).map((mode) => (
            <Button
              key={mode}
              variant={filter === mode ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 px-3 text-xs capitalize"
              onClick={() => setFilter(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-1.5"
          onClick={() => void eventsRefresh()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Event Timeline */}
      <EventTimeline events={filteredEvents} isLoading={isLoading} />
    </div>
  )
}
