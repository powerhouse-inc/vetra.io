'use client'

import { useState } from 'react'

import { DatabaseBackupsTab } from '@/modules/cloud/components/database-backups-tab'
import { DatabaseExplorerTab } from '@/modules/cloud/components/database-explorer-tab'
import type { BackupCadence, BackupSchedule } from '@/modules/cloud/types'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/modules/shared/components/ui/tabs'

// The explorer's `describeDatabase` / `executeReadOnlyQuery` resolvers were
// never merged into vetra-cloud-package, so every request fails schema
// validation with a 400. Hidden until the backend ships.
const EXPLORER_SUPPORTED = false

type Props = {
  tenantId: string | null
  canEdit: boolean
  schedule?: BackupSchedule | null
  onSaveSchedule?: (opts: {
    enabled: boolean
    cadence: BackupCadence
    retention: number
  }) => Promise<void>
  scheduleSupported?: boolean
}

/**
 * Inner sub-tabs for the Switchboard drawer's Database section:
 * - "backups" — pg_dump management (default)
 * - "explorer" — schema browser + read-only SQL (owner-only; hidden when
 *   `canEdit` is false)
 *
 * The explorer trigger is not rendered for non-owners; they see Backups only.
 */
export function DatabaseTabBody({
  tenantId,
  canEdit,
  schedule,
  onSaveSchedule,
  scheduleSupported,
}: Props) {
  const [tab, setTab] = useState<'backups' | 'explorer'>('backups')
  const showExplorer = EXPLORER_SUPPORTED && canEdit

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'backups' | 'explorer')}>
      <TabsList className="mb-3">
        <TabsTrigger value="backups">Backups</TabsTrigger>
        {showExplorer && <TabsTrigger value="explorer">Explorer</TabsTrigger>}
      </TabsList>

      <TabsContent value="backups" className="mt-0">
        <DatabaseBackupsTab
          tenantId={tenantId}
          canEdit={canEdit}
          schedule={schedule}
          onSaveSchedule={onSaveSchedule}
          scheduleSupported={scheduleSupported}
        />
      </TabsContent>

      {showExplorer && (
        <TabsContent value="explorer" className="mt-0">
          <DatabaseExplorerTab tenantId={tenantId} canEdit={canEdit} />
        </TabsContent>
      )}
    </Tabs>
  )
}
