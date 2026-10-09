'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/modules/shared/components/ui/button'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { useAppStats } from '../../hooks/use-app-stats'
import { AGGREGATION_COPY } from '../../lib/app-profile/metrics'
import { appPageUrl } from '../../lib/app-profile/renown'
import { formatStatValue } from '../../lib/app-stats/format'

/** Tiles shown at most: active users plus seven metrics fill two rows of four. */
const MAX_METRIC_TILES = 7

function Tile({
  caption,
  value,
  unit,
  label,
  metricKey,
}: {
  caption: string
  value: number
  unit: string | null
  label: string
  metricKey?: string
}) {
  return (
    <div className="border-border bg-card min-w-0 rounded-xl border p-4" data-metric={metricKey}>
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{caption}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums">{formatStatValue(value)}</span>
        {unit && <span className="text-muted-foreground truncate text-sm">{unit}</span>}
      </p>
      <p className="text-muted-foreground mt-0.5 truncate text-sm" title={label}>
        {label}
      </p>
    </div>
  )
}

/**
 * The Overview's "Stats" section: the app's public Renown metrics as compact tiles. Without any
 * public metric (none declared, Renown unreachable, unknown app) it is only a subtle pair of
 * links, so a failed read never disturbs the page.
 */
export function AppStatsCard({
  appDid,
  onEdit,
}: {
  appDid: string | null | undefined
  /** Opens the Profile tab to declare metrics; absent on read-only apps. */
  onEdit?: () => void
}) {
  const stats = useAppStats(appDid)
  if (!appDid) return null
  const data = stats.data
  const shown = !stats.error && data && data.metrics.length > 0 ? data : null

  if (!shown && !stats.isPending) {
    return (
      <p className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="hover:text-foreground underline-offset-4 hover:underline"
          >
            Declare metrics
          </button>
        )}
        <Link
          href="/docs/app-stats"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          How to report stats
        </Link>
      </p>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="app-stats-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="app-stats-heading" className="text-lg font-semibold">
          Stats
        </h2>
        {shown && (
          <Button size="sm" variant="ghost" asChild>
            <a href={appPageUrl(appDid)} target="_blank" rel="noopener noreferrer">
              View on Renown
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        )}
      </div>
      {shown ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile
            caption="Active · 30 days"
            value={shown.activeUsers30d}
            unit={null}
            label={`of ${formatStatValue(shown.totalUsers)} users`}
          />
          {shown.metrics.slice(0, MAX_METRIC_TILES).map((m) => (
            <Tile
              key={m.key}
              metricKey={m.key}
              caption={AGGREGATION_COPY[m.aggregation].label}
              value={m.value}
              unit={m.unit}
              label={m.label}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}
    </section>
  )
}
