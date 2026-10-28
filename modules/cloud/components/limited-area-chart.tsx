'use client'

import type { MetricSeries } from '@/modules/cloud/types'
import { CHART_ERROR_COLOR } from '@/modules/cloud/lib/chart-colors'

export type LimitedSeries = {
  series: MetricSeries
  /** Stroke color for the line. */
  color: string
  /** When true, the area below the line is also filled with `color`. */
  filled?: boolean
}

type LimitedAreaChartProps = {
  series: LimitedSeries[]
  quota: number
  /** Formats axis tick values (e.g. `512 MB`, `250m`). */
  formatAxis: (value: number) => string
  /** Label shown to the right of the QUOTA reference line. */
  quotaLabel: string
  /** Optional restart/OOM markers — Unix seconds. */
  restarts?: number[]
  /** Defaults to `Math.max(quota * 1.05, observedMax * 1.1)` so overage is visible. */
  yMax?: number
  /** Number of intermediate gridlines (excluding quota and zero). Default 3. */
  ticks?: number
  /** Card background — used to mask the QUOTA tag on top of the line. Default matches MetricCard. */
  cardBg?: string
}

/**
 * Heroku-style limit-aware chart. HTML axis labels (no SVG text stretching),
 * SVG polylines with non-scaling strokes, solid red quota line that the chart
 * can extend above when usage spills over.
 */
export function LimitedAreaChart({
  series,
  quota,
  formatAxis,
  quotaLabel,
  restarts,
  yMax,
  ticks = 3,
  cardBg = 'var(--card, #0f1216)',
}: LimitedAreaChartProps) {
  const allPoints = series.flatMap((s) => s.series.datapoints)
  const observedMax = allPoints.reduce((m, p) => (p.value > m ? p.value : m), 0)
  const maxY = yMax ?? Math.max(quota * 1.05, observedMax * 1.1)

  const minTs = allPoints.length ? Math.min(...allPoints.map((p) => p.timestamp)) : 0
  const maxTs = allPoints.length ? Math.max(...allPoints.map((p) => p.timestamp)) : 1
  const tsRange = maxTs - minTs || 1

  const tickValues = buildTicks(maxY, ticks)
  const quotaTopPct = ((maxY - quota) / maxY) * 100
  const valueToY = (v: number) => ((maxY - v) / maxY) * 100
  const tsToX = (ts: number) => ((ts - minTs) / tsRange) * 200

  return (
    <div className="relative h-[110px] pl-11">
      <div
        className="text-muted-foreground pointer-events-none absolute top-0 bottom-[14px] left-0 flex w-10 flex-col items-end justify-between text-[9px] whitespace-nowrap tabular-nums"
        style={{ lineHeight: 1 }}
      >
        <span>{formatAxis(maxY)}</span>
        {tickValues.map((t) => (
          <span key={t} style={{ transform: 'translateY(-50%)' }}>
            {formatAxis(t)}
          </span>
        ))}
        <span style={{ transform: 'translateY(-100%)' }}>0</span>
      </div>

      <div className="border-border/50 relative h-[calc(100%-14px)] border-b">
        <div className="pointer-events-none absolute inset-0">
          {tickValues.map((t) => (
            <div
              key={t}
              className="absolute inset-x-0 h-px bg-white/[0.04]"
              style={{ top: `${valueToY(t)}%` }}
            />
          ))}
        </div>

        <svg
          width="100%"
          height="100%"
          viewBox="0 0 200 100"
          preserveAspectRatio="none"
          className="block"
        >
          {series.map((s, i) => {
            if (s.series.datapoints.length === 0) return null
            const points = s.series.datapoints
              .map((p) => `${tsToX(p.timestamp).toFixed(2)},${valueToY(p.value).toFixed(2)}`)
              .join(' ')
            const firstX = tsToX(s.series.datapoints[0].timestamp).toFixed(2)
            const lastX = tsToX(
              s.series.datapoints[s.series.datapoints.length - 1].timestamp,
            ).toFixed(2)
            const areaPoints = `${firstX},100 ${points} ${lastX},100`
            return (
              <g key={i}>
                {s.filled && <polygon points={areaPoints} fill={s.color} fillOpacity="0.15" />}
                <polyline
                  points={points}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )
          })}
        </svg>

        <div
          className="pointer-events-none absolute inset-x-0 h-px"
          style={{ top: `${quotaTopPct}%`, background: CHART_ERROR_COLOR }}
        >
          <span
            className="absolute -top-[14px] right-1 px-1 text-[9px] font-semibold tracking-wide"
            style={{ color: CHART_ERROR_COLOR, background: cardBg }}
          >
            QUOTA · {quotaLabel}
          </span>
        </div>

        {restarts?.map((ts, i) => {
          if (ts < minTs || ts > maxTs) return null
          const left = ((ts - minTs) / tsRange) * 100
          return (
            <div
              key={i}
              className="pointer-events-none absolute inset-y-0 w-px"
              style={{
                left: `${left}%`,
                backgroundImage:
                  'linear-gradient(to bottom, rgba(234,67,53,0.55) 50%, transparent 50%)',
                backgroundSize: '1px 4px',
              }}
            />
          )
        })}
      </div>

      <div className="text-muted-foreground absolute right-0 bottom-0 left-11 flex h-3 justify-between text-[9px]">
        <span>{allPoints.length ? formatRelative(minTs, maxTs) : ''}</span>
        <span>{allPoints.length ? 'now' : ''}</span>
      </div>
    </div>
  )
}

/** Compute `count` evenly-spaced tick values strictly between 0 and yMax. */
function buildTicks(yMax: number, count: number): number[] {
  const out: number[] = []
  for (let i = count; i >= 1; i--) {
    out.push((yMax * i) / (count + 1))
  }
  return out
}

function formatRelative(minTs: number, maxTs: number): string {
  const minutes = Math.round((maxTs - minTs) / 60)
  if (minutes < 90) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 36) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}
