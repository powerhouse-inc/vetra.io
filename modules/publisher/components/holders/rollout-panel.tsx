'use client'

import { ChevronRight, Rocket } from 'lucide-react'
import { PersonName } from '@/modules/shared/components/person-name'
import { StatusPill } from '@/modules/shared/components/status'
import { Button } from '@/modules/shared/components/ui/button'
import { formatDate, formatTimestamp, isFuture, timeFromNow } from '@/modules/shared/lib/time'
import { rolloutProgress, splitRollouts } from '../../lib/rollouts'
import { rolloutStatusMeta } from '../../lib/status'
import type { AppRollout } from '../../types'

/** A relative time with the exact one on hover. */
function When({ iso }: { iso: string }) {
  return (
    <span title={formatTimestamp(iso)} className="text-foreground">
      {timeFromNow(iso)}
    </span>
  )
}

function Progress({ rollout }: { rollout: AppRollout }) {
  const p = rolloutProgress(rollout.counts)
  const pct = p.total === 0 ? 0 : Math.round((p.updated / p.total) * 100)
  return (
    <div className="space-y-1.5">
      <p className="text-sm tabular-nums">
        {`${p.updated} of ${p.total} updated · ${p.pending} pending · ${p.failed} failed`}
      </p>
      <div
        role="progressbar"
        aria-label="Environments updated"
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.updated}
        className="bg-muted h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className={rollout.status === 'PAUSED' ? 'bg-warning h-full' : 'bg-info h-full'}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

/**
 * The app's current release rollout (ACTIVE or PAUSED) and its last few predecessors. Read-only:
 * resuming and promoting happen elsewhere. Renders nothing while there is no current rollout.
 */
export function RolloutPanel({
  rollouts,
  error,
  onRetry,
}: {
  rollouts: AppRollout[] | undefined
  error: Error | null
  onRetry: () => void
}) {
  if (rollouts === undefined) {
    if (!error) return null
    // The holders table works without it, so a failure is a note, not a broken tab.
    return (
      <p role="alert" className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
        The release rollout did not load, so it is not shown.
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </p>
    )
  }
  const { current, previous } = splitRollouts(rollouts)
  if (!current) return null
  const due = isFuture(current.applyAfter)

  return (
    <section
      data-testid="rollout-panel"
      aria-label="Release rollout"
      className="bg-card border-border space-y-4 rounded-xl border p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-medium tracking-wide uppercase">
            <Rocket className="h-3.5 w-3.5" aria-hidden />
            Release rollout
          </p>
          <p className="flex flex-wrap items-baseline gap-x-2 font-medium">
            <span>{current.artifactName}</span>
            <span className="font-mono text-sm break-all">{current.version}</span>
          </p>
          <p className="text-muted-foreground text-xs">
            Promoted by <PersonName value={current.promotedBy} /> <When iso={current.promotedAt} />
          </p>
        </div>
        <StatusPill meta={rolloutStatusMeta(current.status)} />
      </div>

      <p className="text-muted-foreground text-sm">
        {due ? (
          <>
            Applies after the notice period: updates start <When iso={current.applyAfter} />.
          </>
        ) : (
          <>
            The notice period ended <When iso={current.applyAfter} />.
          </>
        )}
      </p>

      <Progress rollout={current} />

      {current.status === 'PAUSED' && (
        <div className="bg-warning/10 text-warning rounded-lg px-3 py-2 text-sm">
          <p className="font-medium">
            {current.pausedAt
              ? `Paused ${timeFromNow(current.pausedAt)} because`
              : 'Paused because'}
          </p>
          {current.pausedReason && <p className="break-words">{current.pausedReason}</p>}
        </div>
      )}

      <p className="text-muted-foreground text-xs">
        Updates apply one at a time, environment by environment. A failure pauses the rollout for
        everyone until it is resumed or a newer release is promoted.
      </p>

      {previous.length > 0 && (
        <details className="group text-sm">
          <summary className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer list-none items-center gap-1 text-xs">
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" />
            Previous rollouts ({previous.length})
          </summary>
          <ul className="divide-border mt-2 divide-y">
            {previous.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                  <span>{r.artifactName}</span>
                  <span className="font-mono text-xs break-all">{r.version}</span>
                  <span
                    className="text-muted-foreground text-xs"
                    title={formatTimestamp(r.promotedAt)}
                  >
                    {formatDate(r.promotedAt)}
                  </span>
                </span>
                <StatusPill meta={rolloutStatusMeta(r.status)} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
