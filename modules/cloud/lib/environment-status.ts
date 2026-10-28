import type {
  ArgoHealthStatus,
  ArgoSyncStatus,
  CloudEnvironmentStatus,
} from '@/modules/cloud/types'
import { unknownStatusMeta, type StatusMeta } from '@/modules/shared/lib/status'

const DOCUMENT_STATUS_META: Record<CloudEnvironmentStatus, StatusMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral', active: false },
  CHANGES_PENDING: { label: 'Pending', tone: 'progress', active: false },
  CHANGES_APPROVED: { label: 'Approved', tone: 'progress', active: false },
  CHANGES_PUSHED: { label: 'Deploying', tone: 'progress', active: true },
  DEPLOYING: { label: 'Deploying', tone: 'progress', active: true },
  DEPLOYMENt_FAILED: { label: 'Failed', tone: 'danger', active: false },
  READY: { label: 'Ready', tone: 'success', active: false },
  TERMINATING: { label: 'Terminating', tone: 'danger', active: true },
  DESTROYED: { label: 'Destroyed', tone: 'neutral', active: false },
  ARCHIVED: { label: 'Archived', tone: 'neutral', active: false },
  STOPPED: { label: 'Stopped', tone: 'neutral', active: false },
}

export type EnvironmentStatusInput = {
  /** Document-model status of the environment. */
  status: string
  /** Live ArgoCD health, when known (env detail polls it; the env list does not have it). */
  argoHealthStatus?: ArgoHealthStatus | null
  argoSyncStatus?: ArgoSyncStatus | null
}

/**
 * The status an environment shows, everywhere it is shown. A READY document is
 * refined by the live ArgoCD health when that is known (Degraded / Down /
 * Syncing / Healthy); otherwise the document status speaks for itself.
 */
export function environmentStatusMeta({
  status,
  argoHealthStatus,
  argoSyncStatus,
}: EnvironmentStatusInput): StatusMeta {
  if (status === 'READY' && argoHealthStatus) {
    if (argoHealthStatus === 'DEGRADED')
      return { label: 'Degraded', tone: 'warning', active: false }
    if (argoHealthStatus === 'MISSING') return { label: 'Down', tone: 'danger', active: false }
    if (argoHealthStatus === 'PROGRESSING' || argoSyncStatus === 'OUT_OF_SYNC') {
      return { label: 'Syncing', tone: 'progress', active: true }
    }
    if (argoHealthStatus === 'HEALTHY' && argoSyncStatus === 'SYNCED') {
      return { label: 'Healthy', tone: 'success', active: false }
    }
  }
  return DOCUMENT_STATUS_META[status as CloudEnvironmentStatus] ?? unknownStatusMeta(status)
}
