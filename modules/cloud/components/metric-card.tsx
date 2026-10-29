import type { MetricSeries } from '@/modules/cloud/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/modules/shared/components/ui/card'
import { formatBytes, formatCpu } from '@/modules/cloud/lib/format-resources'

import { LimitedAreaChart, type LimitedSeries } from './limited-area-chart'
import { Sparkline } from './sparkline'
import {
  CHART_ERROR_COLOR,
  CHART_SERIES_COLORS,
  CHART_WARN_COLOR,
} from '@/modules/cloud/lib/chart-colors'

const SERIES_COLORS = CHART_SERIES_COLORS

const PRIMARY_COLOR: Record<'cpu' | 'memory', string> = {
  cpu: CHART_SERIES_COLORS[0],
  memory: CHART_SERIES_COLORS[1],
}

const WARN_COLOR = CHART_WARN_COLOR
const ERROR_COLOR = CHART_ERROR_COLOR

const WARN_THRESHOLD = 0.75
const ERROR_THRESHOLD = 0.9

type MetricKind = 'cpu' | 'memory' | 'generic'

type MetricCardProps = {
  title: string
  description?: string
  series: MetricSeries[]
  /** Used when `kind === 'generic'`. */
  formatValue?: (value: number) => string
  /** Used when `kind === 'generic'` to suffix the headline. */
  unit?: string
  isLoading?: boolean
  /** Defaults to `'generic'`, which renders the legacy unbounded sparkline. */
  kind?: MetricKind
  /** Per-pod limit. Required when `kind` is `'cpu'` or `'memory'`. */
  quota?: number | null
  /** Restart / OOM marker timestamps (Unix seconds). */
  restarts?: number[]
}

export function MetricCard({
  title,
  description,
  series,
  formatValue,
  unit,
  isLoading,
  kind = 'generic',
  quota,
  restarts,
}: MetricCardProps) {
  const hasData = series.some((s) => s.datapoints.length > 0)
  const limitMode = (kind === 'cpu' || kind === 'memory') && quota != null && quota > 0

  return (
    <Card className="transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        {description && <p className="text-muted-foreground/70 text-xs">{description}</p>}
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {isLoading ? (
          <>
            <div className="bg-muted h-8 w-24 animate-pulse rounded" />
            <div className="bg-muted h-[110px] w-full animate-pulse rounded" />
          </>
        ) : limitMode ? (
          <LimitedView
            series={series}
            quota={quota}
            kind={kind}
            restarts={restarts}
            hasData={hasData}
          />
        ) : (
          <GenericView
            series={series}
            formatValue={formatValue ?? defaultFormat}
            unit={unit}
            hasData={hasData}
          />
        )}
      </CardContent>
    </Card>
  )
}

function defaultFormat(v: number): string {
  return v.toFixed(2)
}

type LimitedViewProps = {
  series: MetricSeries[]
  quota: number
  kind: 'cpu' | 'memory'
  restarts?: number[]
  hasData: boolean
}

function LimitedView({ series, quota, kind, restarts, hasData }: LimitedViewProps) {
  const formatVal = kind === 'cpu' ? formatCpu : formatBytes
  const peakNow = series.reduce((peak, s) => {
    const last = s.datapoints[s.datapoints.length - 1]
    return last && last.value > peak ? last.value : peak
  }, 0)
  const peakUtil = quota > 0 ? peakNow / quota : 0
  const stateColor =
    peakUtil >= ERROR_THRESHOLD
      ? ERROR_COLOR
      : peakUtil >= WARN_THRESHOLD
        ? WARN_COLOR
        : PRIMARY_COLOR[kind]

  // Highlight the pod with the highest current value as the filled/colored
  // primary series. Other pods get muted strokes from the palette.
  const peakIdx = series.reduce((bestIdx, s, i) => {
    const last = s.datapoints[s.datapoints.length - 1]
    const bestLast = series[bestIdx].datapoints[series[bestIdx].datapoints.length - 1]
    return last && (!bestLast || last.value > bestLast.value) ? i : bestIdx
  }, 0)

  const limitedSeries: LimitedSeries[] = series.map((s, i) => ({
    series: s,
    color: i === peakIdx ? stateColor : SERIES_COLORS[(i + 4) % SERIES_COLORS.length],
    filled: i === peakIdx,
  }))

  return (
    <>
      <div>
        <p className="text-2xl leading-none font-bold tracking-tight" style={{ color: stateColor }}>
          {formatVal(peakNow)}
        </p>
        <p
          className="mt-0.5 text-xs font-medium"
          style={{ color: stateColor, opacity: peakUtil >= WARN_THRESHOLD ? 1 : 0.55 }}
        >
          {(peakUtil * 100).toFixed(peakUtil < 0.1 ? 1 : 0)}% of {formatVal(quota)} quota
        </p>
        {/* Owners choose the size; near the limit we only recommend the next one. */}
        {peakUtil >= WARN_THRESHOLD && (
          <p className="text-muted-foreground mt-1 text-xs">
            Close to its limit. We recommend the next size up, set from the service’s size control.
          </p>
        )}
      </div>

      {hasData ? (
        <LimitedAreaChart
          series={limitedSeries}
          quota={quota}
          formatAxis={formatVal}
          quotaLabel={formatVal(quota)}
          restarts={restarts}
        />
      ) : (
        <div className="bg-muted/30 flex h-[110px] items-center justify-center rounded">
          <p className="text-muted-foreground text-sm">No data</p>
        </div>
      )}

      {series.length > 0 && (
        <div className="space-y-0">
          {series.map((s, i) => {
            const last = s.datapoints[s.datapoints.length - 1]
            const value = last?.value ?? 0
            const util = quota > 0 ? value / quota : 0
            const rowColor =
              util >= ERROR_THRESHOLD
                ? ERROR_COLOR
                : util >= WARN_THRESHOLD
                  ? WARN_COLOR
                  : undefined
            const swatch = limitedSeries[i].color
            return (
              <div
                key={i}
                className="border-border/50 flex items-center justify-between border-t py-1.5 text-xs first:border-t-0 first:pt-2"
              >
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{ backgroundColor: swatch }}
                  />
                  <span className="text-muted-foreground max-w-[160px] truncate" title={s.label}>
                    {shortenPodLabel(s.label)}
                  </span>
                </span>
                <span className="font-medium tabular-nums" style={{ color: rowColor }}>
                  {formatVal(value)} · {(util * 100).toFixed(util < 0.1 ? 1 : 0)}%
                </span>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

type GenericViewProps = {
  series: MetricSeries[]
  formatValue: (v: number) => string
  unit?: string
  hasData: boolean
}

function GenericView({ series, formatValue, unit, hasData }: GenericViewProps) {
  const firstSeries = series[0]
  const datapoints = firstSeries?.datapoints ?? []
  const latestDatapoint = datapoints.length > 0 ? datapoints[datapoints.length - 1] : null

  if (!hasData) {
    return (
      <>
        <p className="text-muted-foreground text-2xl font-bold">—</p>
        <div className="bg-muted/30 flex h-[100px] items-center justify-center rounded">
          <p className="text-muted-foreground text-sm">No data</p>
        </div>
      </>
    )
  }

  return (
    <>
      <p className="text-2xl font-bold">
        {latestDatapoint !== null ? formatValue(latestDatapoint.value) : '—'}
        {unit && <span className="text-muted-foreground ml-1 text-sm font-normal">{unit}</span>}
      </p>
      <div className="w-full">
        <Sparkline series={series} width={300} height={100} formatValue={formatValue} />
      </div>
      {series.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
          {series.map((s, i) => {
            const latest = s.datapoints[s.datapoints.length - 1]
            return (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
                />
                <span className="text-muted-foreground max-w-[120px] truncate" title={s.label}>
                  {shortenPodLabel(s.label)}
                </span>
                {latest && (
                  <span className="text-foreground font-medium">{formatValue(latest.value)}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

function shortenPodLabel(label: string): string {
  return label.replace(/^.*-(?=(connect|switchboard|pg|pooler|fusion|clint))/, '')
}
