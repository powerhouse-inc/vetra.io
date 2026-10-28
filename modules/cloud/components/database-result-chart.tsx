'use client'

import { useMemo } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { DatabaseQueryResult } from '@/modules/cloud/types'
import { CHART_SERIES_COLORS } from '@/modules/cloud/lib/chart-colors'

/** Mirror of the sparkline COLORS palette to keep result charts on-brand. */
const COLORS = CHART_SERIES_COLORS

type Props = {
  result: DatabaseQueryResult
}

type ChartShape = {
  numericColumns: string[]
  xColumn: string | null
  data: Array<Record<string, number | string | null>>
}

export function isChartable(result: DatabaseQueryResult): boolean {
  return detectNumericColumns(result).length > 0
}

/**
 * True when `cell` is a string that converts cleanly to a finite number.
 * `Number(...)` is stricter than `parseFloat(...)`: it rejects partial-string
 * values like `"10px"` (→ NaN) and date-ish strings like `"2024-01-01"` (→ NaN).
 * The empty-string guard avoids `Number("") === 0` false positives.
 */
function isNumericCell(cell: string | null): boolean {
  if (cell === null || cell === '') return false
  return Number.isFinite(Number(cell))
}

function detectNumericColumns(result: DatabaseQueryResult): string[] {
  const numeric: string[] = []
  for (let col = 0; col < result.columns.length; col++) {
    const hasAny = result.rows.some((row) => isNumericCell(row[col]))
    if (hasAny) numeric.push(result.columns[col])
  }
  return numeric
}

function buildChartShape(result: DatabaseQueryResult): ChartShape {
  const numericColumns = detectNumericColumns(result)
  const xColumn = result.columns.find((c) => !numericColumns.includes(c)) ?? null
  const data: ChartShape['data'] = result.rows.map((row, i) => {
    const record: Record<string, number | string | null> = {}
    result.columns.forEach((col, idx) => {
      const cell = row[idx]
      if (numericColumns.includes(col)) {
        record[col] = isNumericCell(cell) ? Number(cell) : null
      } else if (col === xColumn) {
        record[col] = cell ?? `(null #${i + 1})`
      } else {
        record[col] = cell
      }
    })
    // Fall back to a synthetic index when there's no non-numeric column to
    // use as the X axis — keeps recharts from collapsing the chart.
    if (!xColumn) record['__index'] = i + 1
    return record
  })
  return { numericColumns, xColumn, data }
}

/**
 * Line chart over a query result. Detects numeric columns; the first
 * non-numeric column is the X axis (synthetic index if all columns are
 * numeric). Each numeric column is rendered as a series.
 */
export function DatabaseResultChart({ result }: Props) {
  const { numericColumns, xColumn, data } = useMemo(() => buildChartShape(result), [result])

  if (numericColumns.length === 0) {
    return (
      <div className="text-muted-foreground p-4 text-center text-xs">
        No numeric columns to chart.
      </div>
    )
  }

  const xDataKey = xColumn ?? '__index'

  return (
    <div className="h-[280px] w-full p-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 8, left: 4 }}>
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
          <XAxis dataKey={xDataKey} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {numericColumns.map((col, i) => (
            <Line
              key={col}
              type="monotone"
              dataKey={col}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
