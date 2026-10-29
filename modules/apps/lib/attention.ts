import { environmentStatusMeta } from '@/modules/cloud/lib/environment-status'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { subscriptionHref, subscriptionName } from '@/modules/subscriptions/lib/subscriptions'
import type { Subscription, SubscriptionWarningKind } from '@/modules/subscriptions/types'

/** One thing on the console home that needs the owner to act. */
export type AttentionItem = {
  key: string
  tone: 'danger' | 'warning'
  title: string
  detail: string
  href: string
}

/** Warnings after which data is about to go: shown as urgent. */
const URGENT_WARNINGS = new Set<SubscriptionWarningKind>([
  'STOPPED_DELETE_PENDING',
  'DELETE_IMMINENT',
])

/**
 * Environments in a failed or degraded state, and subscriptions with warnings,
 * urgent first. States that are still moving (deploying, terminating) are left
 * out: they resolve on their own.
 */
export function attentionItems(
  environments: readonly CloudEnvironment[],
  subscriptions: readonly Subscription[],
): AttentionItem[] {
  const items: AttentionItem[] = []

  for (const env of environments) {
    const meta = environmentStatusMeta({
      status: env.state.status,
      argoHealthStatus: env.health?.argoHealthStatus,
      argoSyncStatus: env.health?.argoSyncStatus,
    })
    if (meta.active || (meta.tone !== 'danger' && meta.tone !== 'warning')) continue
    items.push({
      key: `env:${env.id}`,
      tone: meta.tone,
      title: env.name,
      detail: meta.label,
      href: `/user/environments/${env.id}`,
    })
  }

  for (const sub of subscriptions) {
    for (const warning of sub.warnings) {
      items.push({
        key: `sub:${sub.licenseId}:${warning.kind}`,
        tone: URGENT_WARNINGS.has(warning.kind) ? 'danger' : 'warning',
        title: `${subscriptionName(sub)} · ${sub.appName}`,
        detail: warning.message,
        href: subscriptionHref(sub.licenseId),
      })
    }
  }

  return items.sort((a, b) => Number(b.tone === 'danger') - Number(a.tone === 'danger'))
}
