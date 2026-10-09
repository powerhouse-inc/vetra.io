import { describe, expect, it } from 'vitest'
import type { RenownAppProfile } from '../lib/app-profile/api'
import {
  changedFields,
  fieldForServer,
  formFromProfile,
  formProblems,
} from '../lib/app-profile/form'
import {
  isMetricAggregation,
  metricChanges,
  metricDraftsFrom,
  metricsProblem,
  newMetricDraft,
  type AppMetricDraft,
} from '../lib/app-profile/metrics'

const PROFILE: RenownAppProfile = {
  appDid: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
  documentId: 'doc-9',
  name: 'Vault',
  tagline: null,
  logo: null,
  website: null,
  publisherDid: null,
  description: null,
  category: null,
  logoRef: null,
  coverRef: null,
  links: [],
  metrics: [
    {
      id: 'm1',
      key: 'notes',
      label: 'Notes',
      unit: 'notes',
      description: null,
      aggregation: 'SUM',
      public: true,
    },
  ],
}
const draft = (extra: Partial<AppMetricDraft> = {}): AppMetricDraft => ({
  id: 'm2',
  key: 'streak',
  label: 'Best streak',
  unit: '',
  description: '',
  aggregation: 'MAX',
  public: false,
  ...extra,
})

describe('metric drafts', () => {
  it('load from the profile, or none for an older profile', () => {
    expect(formFromProfile(PROFILE).metrics).toEqual([
      {
        id: 'm1',
        key: 'notes',
        label: 'Notes',
        unit: 'notes',
        description: '',
        aggregation: 'SUM',
        public: true,
      },
    ])
    expect(metricDraftsFrom(undefined)).toEqual([])
  })

  it('send the whole list, trimmed, only when something changed', () => {
    const base = formFromProfile(PROFILE)
    expect(changedFields(base, base)).toEqual({})
    expect(
      changedFields(base, { ...base, metrics: [{ ...base.metrics[0]!, label: ' Notes ' }] }),
    ).toEqual({})
    expect(
      changedFields(base, {
        ...base,
        metrics: [
          ...base.metrics,
          draft({ label: ' Best streak ', unit: ' days ', description: ' ' }),
        ],
      }),
    ).toEqual({
      metrics: [
        {
          id: 'm1',
          key: 'notes',
          label: 'Notes',
          unit: 'notes',
          description: null,
          aggregation: 'SUM',
          public: true,
        },
        {
          id: 'm2',
          key: 'streak',
          label: 'Best streak',
          unit: 'days',
          description: null,
          aggregation: 'MAX',
          public: false,
        },
      ],
    })
    expect(changedFields(base, { ...base, metrics: [] })).toEqual({ metrics: [] })
    expect(metricChanges([draft({ public: false, unit: '0' })])[0]).toMatchObject({
      public: false,
      unit: '0',
    })
  })

  it('names the first problem Renown would refuse', () => {
    expect(metricsProblem([draft()])).toBeNull()
    expect(
      metricsProblem(Array.from({ length: 17 }, (_, i) => draft({ id: `m${i}`, key: `k${i}` }))),
    ).toMatch(/At most 16/)
    expect(metricsProblem([draft({ key: '9lives' })])).toMatch(/Metric 1: the key/)
    expect(metricsProblem([draft(), draft({ id: 'm3' })])).toMatch(
      /Metric 2: the key “streak” is used twice/,
    )
    expect(metricsProblem([draft({ label: '  ' })])).toMatch(/label/)
    expect(metricsProblem([draft({ label: 'l'.repeat(41) })])).toMatch(/label/)
    expect(metricsProblem([draft({ unit: 'u'.repeat(17) })])).toMatch(/unit/)
    expect(metricsProblem([draft({ description: 'd'.repeat(201) })])).toMatch(/description/)
    const base = formFromProfile(PROFILE)
    expect(formProblems({ ...base, metrics: [draft({ key: '' })] }).metrics).toMatch(/key/)
    expect(fieldForServer('metrics')).toBe('metrics')
  })

  it('new drafts are unique public totals', () => {
    const a = newMetricDraft()
    const b = newMetricDraft()
    expect(a.id).not.toBe(b.id)
    expect(a).toMatchObject({ key: '', label: '', aggregation: 'SUM', public: true })
    expect(isMetricAggregation('COUNT_USERS')).toBe(true)
    expect(isMetricAggregation('MEDIAN')).toBe(false)
  })
})
