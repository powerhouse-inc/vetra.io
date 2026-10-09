'use client'

import { useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Switch } from '@/modules/shared/components/ui/switch'
import {
  AGGREGATION_COPY,
  isMetricAggregation,
  METRIC_AGGREGATIONS,
  METRIC_LIMITS,
  newMetricDraft,
  type AppMetricDraft,
} from '../../lib/app-profile/metrics'

/** Up to 16 metric definitions: label, key, unit, aggregation, public, description; add, reorder, remove. */
export function MetricsEditor({
  metrics,
  onChange,
  error,
}: {
  metrics: AppMetricDraft[]
  onChange: (metrics: AppMetricDraft[]) => void
  error?: string
}) {
  function update(index: number, patch: Partial<AppMetricDraft>) {
    onChange(metrics.map((metric, i) => (i === index ? { ...metric, ...patch } : metric)))
  }

  // After a move, keyboard focus follows the row: the pressed button, or its opposite when the
  // row landed on an edge and the pressed one is now disabled (never drops to <body>).
  const focusAfterMove = useRef<{ id: string; by: -1 | 1 } | null>(null)
  useEffect(() => {
    const request = focusAfterMove.current
    if (!request) return
    focusAfterMove.current = null
    const index = metrics.findIndex((m) => m.id === request.id)
    if (index === -1) return
    const atEdge = request.by === -1 ? index === 0 : index === metrics.length - 1
    const direction = atEdge ? -request.by : request.by
    document
      .querySelector<HTMLButtonElement>(
        `[data-metric-id="${CSS.escape(request.id)}"] [data-move="${direction === -1 ? 'up' : 'down'}"]`,
      )
      ?.focus()
  }, [metrics])

  function move(index: number, by: -1 | 1) {
    const next = [...metrics]
    const [item] = next.splice(index, 1)
    if (!item) return
    next.splice(index + by, 0, item)
    focusAfterMove.current = { id: item.id, by }
    onChange(next)
  }

  return (
    <div className="space-y-3">
      <p className="text-muted-foreground text-xs">
        A key is what your app reports, so changing it detaches the stats already reported under the
        old one. To rename a key, remove the metric and add it again; the label, unit and
        description can be edited freely.
      </p>
      {metrics.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No metrics yet. Declare what your app reports per user, for example notes written or a
          best streak.
        </p>
      )}
      {metrics.map((metric, index) => {
        const n = index + 1
        return (
          <fieldset key={metric.id} data-metric-id={metric.id} className="border-border space-y-3 rounded-xl border p-4">
            <legend className="sr-only">Metric {n}</legend>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_7rem]">
              <Input
                aria-label={`Metric ${n} label`}
                aria-describedby={error ? 'profile-metrics-error' : undefined}
                placeholder="Label, e.g. Notes written"
                value={metric.label}
                onChange={(e) => update(index, { label: e.target.value })}
              />
              <Input
                aria-label={`Metric ${n} key`}
                aria-describedby={error ? 'profile-metrics-error' : undefined}
                placeholder="Key, e.g. notes"
                className="font-mono"
                spellCheck={false}
                autoCapitalize="none"
                autoCorrect="off"
                value={metric.key}
                onChange={(e) => update(index, { key: e.target.value })}
              />
              <Input
                aria-label={`Metric ${n} unit`}
                aria-describedby={error ? 'profile-metrics-error' : undefined}
                placeholder="Unit"
                value={metric.unit}
                onChange={(e) => update(index, { unit: e.target.value })}
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label={`Metric ${n} aggregation`}
                aria-describedby={error ? 'profile-metrics-error' : undefined}
                value={metric.aggregation}
                onChange={(e) => {
                  const value = e.target.value
                  if (isMetricAggregation(value)) update(index, { aggregation: value })
                }}
                className="border-input bg-background focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
              >
                {METRIC_AGGREGATIONS.map((aggregation) => (
                  <option key={aggregation} value={aggregation}>
                    {AGGREGATION_COPY[aggregation].label}
                  </option>
                ))}
              </select>
              <span className="flex items-center gap-2 text-sm">
                <Switch
                  aria-label={`Metric ${n} public`}
                  checked={metric.public}
                  onCheckedChange={(checked) => update(index, { public: checked })}
                />
                Public
              </span>
              <p className="text-muted-foreground min-w-0 flex-1 text-xs">
                {AGGREGATION_COPY[metric.aggregation].hint}{' '}
                {metric.public ? 'Shown on Renown.' : 'Hidden on Renown.'}
              </p>
              <div className="flex shrink-0 gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  data-move="up"
                  aria-label={`Move metric ${n} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  data-move="down"
                  aria-label={`Move metric ${n} down`}
                  disabled={index === metrics.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove metric ${n}`}
                  onClick={() => onChange(metrics.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <Input
              aria-label={`Metric ${n} description`}
              aria-describedby={error ? 'profile-metrics-error' : undefined}
              placeholder="Description (optional)"
              value={metric.description}
              onChange={(e) => update(index, { description: e.target.value })}
            />
          </fieldset>
        )
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={metrics.length >= METRIC_LIMITS.metrics}
        onClick={() => onChange([...metrics, newMetricDraft()])}
      >
        <Plus className="h-3.5 w-3.5" />
        Add metric
      </Button>
      {error && (
        <p id="profile-metrics-error" className="text-destructive text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
