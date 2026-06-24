'use client'

import { useAppState, type SyncStatus } from '@/shared/state'

const LABELS: Record<SyncStatus, string> = {
  'up-to-date': 'Up to date',
  refreshing: 'Refreshing…',
  offline: 'Offline',
  error: 'Sync error',
}

const DOT: Record<SyncStatus, string> = {
  'up-to-date': 'bg-emerald-500',
  refreshing: 'bg-primary animate-pulse',
  offline: 'bg-muted-foreground',
  error: 'bg-destructive',
}

function syncedAgo(lastSyncedAt: number | null): string {
  if (lastSyncedAt === null) return 'Not synced yet'
  const secs = Math.round((Date.now() - lastSyncedAt) / 1000)
  if (secs < 5) return 'Synced just now'
  if (secs < 60) return `Synced ${secs}s ago`
  return `Synced ${Math.round(secs / 60)}m ago`
}

/**
 * Small fixed-position chip showing whether app data is fresh. Unobtrusive:
 * pinned bottom-right, summarizes the coordinated sync state. Renders nothing
 * until the coordinator context is available.
 */
export function SyncStatusChip() {
  const state = useAppState()
  if (!state) return null

  return (
    <div
      className="bg-background/80 text-muted-foreground pointer-events-none fixed right-3 bottom-3 z-[90] flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs shadow-sm backdrop-blur"
      title={syncedAgo(state.lastSyncedAt)}
      role="status"
      aria-live="polite"
    >
      <span className={`size-2 rounded-full ${DOT[state.status]}`} />
      {LABELS[state.status]}
    </div>
  )
}
