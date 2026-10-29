'use client'

import {
  usePublisherEnvironments,
  usePublisherInviteCodes,
  usePublisherLicenses,
  usePublisherTerms,
} from '@/modules/publisher/hooks/use-publisher'
import { publisherSummary } from '@/modules/publisher/lib/summary'

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-card border-border rounded-lg border px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-2xl font-bold tabular-nums">{value ?? '–'}</p>
    </div>
  )
}

/** How a published app is doing: holders, live plans, invite code use, environments. */
export function PublisherSummaryRow({ appId }: { appId: string }) {
  const licenses = usePublisherLicenses(appId)
  const terms = usePublisherTerms(appId)
  const inviteCodes = usePublisherInviteCodes(appId)
  const environments = usePublisherEnvironments(appId)

  const loaded = licenses.data && terms.data && inviteCodes.data && environments.data
  const summary = loaded
    ? publisherSummary({
        licenses: licenses.data ?? [],
        terms: terms.data ?? [],
        inviteCodes: inviteCodes.data ?? [],
        environments: environments.data ?? [],
      })
    : null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="Publisher summary">
      <Stat label="Holders" value={summary ? String(summary.holders) : null} />
      <Stat label="Live plans" value={summary ? String(summary.livePlans) : null} />
      <Stat
        label="Invite codes used"
        value={
          summary
            ? summary.codesCapacity === null
              ? String(summary.codesRedeemed)
              : `${summary.codesRedeemed} / ${summary.codesCapacity}`
            : null
        }
      />
      <Stat
        label="Environments running"
        value={summary ? String(summary.runningEnvironments) : null}
      />
    </div>
  )
}
