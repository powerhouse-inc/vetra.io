// The Profile tab's metric definitions: what the app reports (key) and how
// Renown shows it. Mirrors renown-app-profile's rules, so problems show
// before saving.
import type { RenownAppMetric } from './api'

export const METRIC_LIMITS = { metrics: 16, label: 40, unit: 16, description: 200 } as const
export const METRIC_KEY_RE = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/
export const METRIC_AGGREGATIONS = ['SUM', 'MAX', 'AVG', 'COUNT_USERS'] as const
export type MetricAggregation = (typeof METRIC_AGGREGATIONS)[number]

export function isMetricAggregation(value: string): value is MetricAggregation {
  return (METRIC_AGGREGATIONS as readonly string[]).includes(value)
}

export const AGGREGATION_COPY: Record<MetricAggregation, { label: string; hint: string }> = {
  SUM: { label: 'Total', hint: 'Adds every user’s current value.' },
  MAX: { label: 'Highest', hint: 'The highest current value of any user.' },
  AVG: { label: 'Average', hint: 'The average of users’ current values.' },
  COUNT_USERS: { label: 'Users', hint: 'How many users have a value above zero.' },
}

export type AppMetricDraft = {
  id: string
  key: string
  label: string
  unit: string
  description: string
  aggregation: MetricAggregation
  public: boolean
}

/** One metric as updateAppProfile sends it; empty unit/description become null. */
export type AppMetricChange = {
  id: string
  key: string
  label: string
  unit: string | null
  description: string | null
  aggregation: MetricAggregation
  public: boolean
}

export function metricDraftsFrom(metrics: RenownAppMetric[] | undefined): AppMetricDraft[] {
  return (metrics ?? []).map((m) => ({
    id: m.id,
    key: m.key,
    label: m.label,
    unit: m.unit ?? '',
    description: m.description ?? '',
    aggregation: m.aggregation,
    public: m.public,
  }))
}

export function newMetricDraft(): AppMetricDraft {
  return {
    id: crypto.randomUUID(),
    key: '',
    label: '',
    unit: '',
    description: '',
    aggregation: 'SUM',
    public: true,
  }
}

export function metricChanges(drafts: AppMetricDraft[]): AppMetricChange[] {
  return drafts.map((d) => ({
    id: d.id,
    key: d.key.trim(),
    label: d.label.trim(),
    unit: d.unit.trim() || null,
    description: d.description.trim() || null,
    aggregation: d.aggregation,
    public: d.public,
  }))
}

/** The first problem Renown would refuse, or null. */
export function metricsProblem(drafts: AppMetricDraft[]): string | null {
  if (drafts.length > METRIC_LIMITS.metrics) return `At most ${METRIC_LIMITS.metrics} metrics.`
  const keys = new Set<string>()
  for (const [index, metric] of metricChanges(drafts).entries()) {
    const n = index + 1
    if (!METRIC_KEY_RE.test(metric.key)) {
      return `Metric ${n}: the key starts with a letter and uses letters, digits and _ . : - (at most 64).`
    }
    if (keys.has(metric.key)) return `Metric ${n}: the key “${metric.key}” is used twice.`
    keys.add(metric.key)
    if (!metric.label || metric.label.length > METRIC_LIMITS.label) {
      return `Metric ${n}: the label needs 1–${METRIC_LIMITS.label} characters.`
    }
    if (metric.unit && metric.unit.length > METRIC_LIMITS.unit) {
      return `Metric ${n}: the unit is at most ${METRIC_LIMITS.unit} characters.`
    }
    if (metric.description && metric.description.length > METRIC_LIMITS.description) {
      return `Metric ${n}: the description is at most ${METRIC_LIMITS.description} characters.`
    }
  }
  return null
}

export function metricsChanged(initial: AppMetricDraft[], current: AppMetricDraft[]): boolean {
  return JSON.stringify(metricChanges(initial)) !== JSON.stringify(metricChanges(current))
}
