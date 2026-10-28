'use client'

import { useCallback, useRef, useState } from 'react'
import type { MetricSeries } from '@/modules/cloud/types'
import { CHART_SERIES_COLORS } from '@/modules/cloud/lib/chart-colors'

const COLORS = CHART_SERIES_COLORS

type SparklineProps = {
  series: MetricSeries[]
  width?: number
  height?: number
  formatValue?: (value: number) => string
}

export function Sparkline({ series, width = 300, height = 100, formatValue }: SparklineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{
    x: number
    y: number
    values: { label: string; value: number; color: string }[]
    timestamp: number
  } | null>(null)

  const allPoints = series.flatMap((s) => s.datapoints)

  const timestamps = allPoints.map((p) => p.timestamp)
  const values = allPoints.map((p) => p.value)

  const minTs = Math.min(...timestamps)
  const maxTs = Math.max(...timestamps)
  const minVal = Math.min(0, ...values)
  const maxVal = Math.max(...values)

  const tsRange = maxTs - minTs || 1
  const valRange = maxVal - minVal || 1

  const pad = 2
  const toX = (ts: number) => pad + ((ts - minTs) / tsRange) * (width - pad * 2)
  const toY = (val: number) =>
    pad + (height - pad * 2) - ((val - minVal) / valRange) * (height - pad * 2)

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || allPoints.length === 0) return
      const rect = svgRef.current.getBoundingClientRect()
      const mouseX = ((e.clientX - rect.left) / rect.width) * width
      const ts = minTs + ((mouseX - pad) / (width - pad * 2)) * tsRange

      const hoverValues = series
        .map((s, si) => {
          if (s.datapoints.length === 0) return null
          const closest = s.datapoints.reduce((prev, curr) =>
            Math.abs(curr.timestamp - ts) < Math.abs(prev.timestamp - ts) ? curr : prev,
          )
          return {
            label: s.label,
            value: closest.value,
            color: COLORS[si % COLORS.length],
          }
        })
        .filter(Boolean) as { label: string; value: number; color: string }[]

      setHover({ x: mouseX, y: 0, values: hoverValues, timestamp: ts })
    },
    [series, allPoints.length, minTs, tsRange, width],
  )

  const handleMouseLeave = useCallback(() => setHover(null), [])

  if (allPoints.length === 0) {
    return (
      <div
        className="bg-muted/20 flex items-center justify-center rounded"
        style={{ width, height }}
      >
        <span className="text-muted-foreground text-xs">No data</span>
      </div>
    )
  }

  const gridLines = [0.25, 0.5, 0.75].map((frac) => pad + frac * (height - pad * 2))

  return (
    <div className="relative" style={{ width: '100%' }}>
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="cursor-crosshair"
      >
        <defs>
          {series.map((_, si) => (
            <linearGradient key={si} id={`grad-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS[si % COLORS.length]} stopOpacity="0.2" />
              <stop offset="100%" stopColor={COLORS[si % COLORS.length]} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {gridLines.map((y, i) => (
          <line
            key={i}
            x1={pad}
            y1={y}
            x2={width - pad}
            y2={y}
            stroke="currentColor"
            strokeOpacity="0.08"
            strokeWidth="0.5"
          />
        ))}

        {series.map((s, si) => {
          if (s.datapoints.length === 0) return null
          const linePoints = s.datapoints
            .map((p) => `${toX(p.timestamp).toFixed(2)},${toY(p.value).toFixed(2)}`)
            .join(' ')

          const firstX = toX(s.datapoints[0].timestamp).toFixed(2)
          const lastX = toX(s.datapoints[s.datapoints.length - 1].timestamp).toFixed(2)
          const areaPoints = `${firstX},${height} ${linePoints} ${lastX},${height}`

          return (
            <g key={si}>
              <polygon points={areaPoints} fill={`url(#grad-${si})`} />
              <polyline
                points={linePoints}
                fill="none"
                stroke={COLORS[si % COLORS.length]}
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            </g>
          )
        })}

        {hover && (
          <line
            x1={hover.x}
            y1={pad}
            x2={hover.x}
            y2={height - pad}
            stroke="currentColor"
            strokeOpacity="0.3"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        )}
      </svg>

      {hover && hover.values.length > 0 && (
        <div
          className="bg-popover text-popover-foreground pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 shadow-md"
          style={{
            left: hover.x > width * 0.7 ? hover.x - 160 : hover.x + 10,
            top: 4,
            minWidth: 130,
          }}
        >
          <div className="text-muted-foreground mb-1 text-[10px]">
            {new Date(hover.timestamp * 1000).toLocaleTimeString()}
          </div>
          {hover.values.map((v, i) => {
            const shortLabel = v.label.replace(/^.*-(?=(connect|switchboard|pg|pooler))/, '')
            return (
              <div key={i} className="flex items-center gap-1.5 text-xs">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: v.color }}
                />
                <span className="text-muted-foreground max-w-[80px] truncate" title={v.label}>
                  {shortLabel}
                </span>
                <span className="ml-auto font-medium">
                  {formatValue ? formatValue(v.value) : v.value.toFixed(2)}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
