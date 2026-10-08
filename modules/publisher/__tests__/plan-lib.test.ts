import { describe, it, expect } from 'vitest'
import {
  kindFromLabel,
  planDetailsInput,
  planInput,
  planSchema,
  publishBlocker,
  termToForm,
} from '../lib/plan'
import type { PublisherTerm } from '../types'

const term = (over: Partial<PublisherTerm> = {}): PublisherTerm => ({
  id: 'term-1',
  kind: '2026-pro',
  label: 'Pro',
  templateId: 'tpl-1',
  validityDays: 30,
  issuers: ['PUBLISHER_GRANT'],
  status: 'DRAFT',
  activeLicenses: 0,
  ...over,
})

describe('plan lib', () => {
  it('suggests a kind from the label', () => {
    expect(kindFromLabel('Local-First Conf 2026')).toBe('local-first-conf-2026')
    expect(kindFromLabel('  Pro (monthly)! ')).toBe('pro-monthly')
  })

  it('validates kind and validity', () => {
    const ok = { label: '', kind: '2026-free', templateId: '', validityDays: '', issuers: [] }
    expect(planSchema.safeParse(ok).success).toBe(true)
    expect(planSchema.safeParse({ ...ok, kind: 'Free Tier' }).success).toBe(false)
    expect(planSchema.safeParse({ ...ok, validityDays: '0' }).success).toBe(false)
    expect(planSchema.safeParse({ ...ok, validityDays: '1.5' }).success).toBe(false)
    expect(planSchema.safeParse({ ...ok, validityDays: '365' }).success).toBe(true)
  })

  it('turns a form into an input with nulls for empty fields', () => {
    expect(
      planInput({
        label: ' ',
        kind: '2026-free',
        templateId: '',
        validityDays: '',
        issuers: ['INVITE_CODE'],
      }),
    ).toEqual({
      kind: '2026-free',
      label: null,
      templateId: null,
      validityDays: null,
      issuers: ['INVITE_CODE'],
    })
  })

  it('never sends the kind of a published plan: licences carry it', () => {
    const published = term({ status: 'ACTIVE' })
    expect(planDetailsInput(published, termToForm(published))).not.toHaveProperty('kind')
    const draft = term()
    expect(planDetailsInput(draft, { ...termToForm(draft), kind: '2026-pro-v2' })).toMatchObject({
      termId: 'term-1',
      kind: '2026-pro-v2',
    })
  })

  it('names what is missing before a plan can be published', () => {
    expect(publishBlocker(term({ templateId: null }))).toBe('Pick a template first.')
    expect(publishBlocker(term({ issuers: [] }))).toBe('Choose at least one way to hand it out.')
    expect(publishBlocker(term())).toBeNull()
  })
})
