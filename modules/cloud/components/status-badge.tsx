import { environmentStatusMeta } from '@/modules/cloud/lib/environment-status'
import type {
  ArgoHealthStatus,
  ArgoSyncStatus,
  CloudEnvironmentStatus,
} from '@/modules/cloud/types'
import { StatusPill, StatusPillSkeleton } from '@/modules/shared/components/status'

type StatusBadgeProps = {
  argoHealthStatus?: ArgoHealthStatus
  argoSyncStatus?: ArgoSyncStatus
  environmentStatus: CloudEnvironmentStatus
  isLoading?: boolean
}

/** Environment status pill: the document status, refined by live ArgoCD health. */
export function StatusBadge({
  argoHealthStatus,
  argoSyncStatus,
  environmentStatus,
  isLoading,
}: StatusBadgeProps) {
  if (isLoading) return <StatusPillSkeleton />
  return (
    <StatusPill
      meta={environmentStatusMeta({ status: environmentStatus, argoHealthStatus, argoSyncStatus })}
    />
  )
}
