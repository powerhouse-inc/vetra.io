import { z } from 'zod'
import { slugify } from '@/modules/shared/lib/slug'
import type { AddTermInput, IssuerKind, PublisherTerm, SetTermDetailsInput } from '../types'

export const ISSUER_OPTIONS: {
  value: IssuerKind
  label: string
  hint: string
  disabled?: boolean
}[] = [
  { value: 'INVITE_CODE', label: 'Invite codes', hint: 'People redeem a code or link you share.' },
  { value: 'PUBLISHER_GRANT', label: 'Granted by you', hint: 'You add people by wallet address.' },
  {
    value: 'ACHRA_SUBSCRIPTION',
    label: 'Paid subscription',
    hint: 'Coming with Achra.',
    disabled: true,
  },
]

export const issuerLabel = (issuer: string): string =>
  ISSUER_OPTIONS.find((o) => o.value === issuer)?.label ?? issuer

export const KIND_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}$/

export const planSchema = z.object({
  label: z.string().trim().max(80, 'Keep it under 80 characters'),
  kind: z
    .string()
    .trim()
    .regex(KIND_PATTERN, 'Use lowercase letters, numbers and dashes, e.g. 2026-free-tier'),
  templateId: z.string(),
  validityDays: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0 && Number(v) <= 3650),
      'A whole number of days (up to 3650), or empty for no end date',
    ),
  issuers: z.array(z.enum(['INVITE_CODE', 'PUBLISHER_GRANT', 'ACHRA_SUBSCRIPTION'])),
})
export type PlanForm = z.infer<typeof planSchema>

export const EMPTY_PLAN: PlanForm = {
  label: '',
  kind: '',
  templateId: '',
  validityDays: '',
  issuers: ['INVITE_CODE'],
}

export function termToForm(t: PublisherTerm): PlanForm {
  return {
    label: t.label ?? '',
    kind: t.kind,
    templateId: t.templateId ?? '',
    validityDays: t.validityDays == null ? '' : String(t.validityDays),
    issuers: [...t.issuers],
  }
}

export function planInput(f: PlanForm): Omit<AddTermInput, 'appId'> {
  const days = f.validityDays.trim()
  return {
    kind: f.kind.trim(),
    label: f.label.trim() || null,
    templateId: f.templateId || null,
    validityDays: days ? Number(days) : null,
    issuers: f.issuers,
  }
}

/**
 * Every editable field (decision D4), except `kind` once the plan has left DRAFT:
 * licences carry the kind, and the reducer refuses to change it (KindImmutableError).
 */
export function planDetailsInput(
  t: PublisherTerm,
  f: PlanForm,
): Omit<SetTermDetailsInput, 'appId'> {
  const { kind, ...rest } = planInput(f)
  return t.status === 'DRAFT' ? { termId: t.id, kind, ...rest } : { termId: t.id, ...rest }
}

export function kindFromLabel(label: string): string {
  return slugify(label)
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 63)
}

/** Mirrors the reducer's TermIncompleteError so the button can say why before the server does. */
export function publishBlocker(t: Pick<PublisherTerm, 'templateId' | 'issuers'>): string | null {
  if (!t.templateId) return 'Pick a template first.'
  if (t.issuers.length === 0) return 'Choose at least one way to hand it out.'
  return null
}
