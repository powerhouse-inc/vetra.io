import { z } from 'zod'
import type { CreateInviteCodeInput, PublisherInviteCode, PublisherTerm } from '../types'

/**
 * URL-safe without encoding, so a shared link reads exactly like the code. Mirrors the server:
 * 8 to 64 of [A-Za-z0-9_-], starting with a letter or number.
 */
export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{7,63}$/

/** A sane ceiling for one code; the server stores a 32-bit integer. */
export const MAX_USES_LIMIT = 1_000_000

/** Mirrors the server (shared/llm-budget.ts MAX_LLM_BUDGET_USD). */
export const MAX_LLM_BUDGET_USD = 10_000

/** A dollar amount with at most cents, 0 to MAX_LLM_BUDGET_USD. */
export function isBudgetText(v: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= MAX_LLM_BUDGET_USD
}

export function budgetText(c: Pick<PublisherInviteCode, 'llmBudgetUsd'>): string {
  if (c.llmBudgetUsd == null) return 'Plan default'
  if (c.llmBudgetUsd === 0) return 'No LLM budget'
  return `$${c.llmBudgetUsd.toFixed(2)} / month`
}

export const redeemPath = (code: string): string => `/redeem/${encodeURIComponent(code)}`
export const redeemUrl = (origin: string, code: string): string =>
  `${origin.replace(/\/+$/, '')}${redeemPath(code)}`

/** `yyyy-mm-dd` from a date input → the last second of that day in the publisher's time zone. */
export function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59`).toISOString()
}

export function usesText(c: Pick<PublisherInviteCode, 'redemptions' | 'maxUses'>): string {
  return c.maxUses != null ? `${c.redemptions} of ${c.maxUses}` : `${c.redemptions} redeemed`
}

export function codePlans(terms: PublisherTerm[]): PublisherTerm[] {
  return terms.filter((t) => t.status === 'ACTIVE' && t.issuers.includes('INVITE_CODE'))
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const inviteCodeSchema = z.object({
  kind: z.string().min(1, 'Choose a plan'),
  label: z.string().trim().max(80, 'Keep it under 80 characters'),
  code: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || CODE_PATTERN.test(v),
      '8–64 letters, numbers, dashes or underscores',
    ),
  maxUses: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0 && Number(v) <= MAX_USES_LIMIT),
      'A whole number from 1 to 1,000,000, or empty for no limit',
    ),
  expiresOn: z.string().refine((v) => v === '' || v >= today(), 'Pick today or a later date'),
  llmBudgetUsd: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || isBudgetText(v),
      'A dollar amount from 0 to 10,000 (cents at most), or empty for the plan default',
    ),
})
export type InviteCodeForm = z.infer<typeof inviteCodeSchema>

export function inviteCodeInput(f: InviteCodeForm): Omit<CreateInviteCodeInput, 'appId'> {
  const code = f.code.trim()
  const budget = f.llmBudgetUsd.trim()
  return {
    kind: f.kind,
    label: f.label.trim() || null,
    maxUses: f.maxUses.trim() ? Number(f.maxUses) : null,
    expiresAt: f.expiresOn ? endOfDayIso(f.expiresOn) : null,
    // Omitted, not null: "omit to generate a random code" / "omit for the plan default".
    ...(code ? { code } : {}),
    ...(budget ? { llmBudgetUsd: Number(budget) } : {}),
  }
}
