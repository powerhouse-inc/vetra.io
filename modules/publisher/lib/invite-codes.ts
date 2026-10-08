import { z } from 'zod'
import type { CreateInviteCodeInput, PublisherInviteCode, PublisherTerm } from '../types'

/** URL-safe without encoding, so a shared link reads exactly like the code. */
export const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{3,63}$/

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
      '4–64 letters, numbers, dashes or underscores',
    ),
  maxUses: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || (/^\d+$/.test(v) && Number(v) > 0),
      'A whole number above zero, or empty for no limit',
    ),
  expiresOn: z.string().refine((v) => v === '' || v >= today(), 'Pick today or a later date'),
  anthropicKey: z.string().trim(),
})
export type InviteCodeForm = z.infer<typeof inviteCodeSchema>

export function inviteCodeInput(f: InviteCodeForm): Omit<CreateInviteCodeInput, 'appId'> {
  const code = f.code.trim()
  const key = f.anthropicKey.trim()
  return {
    kind: f.kind,
    label: f.label.trim() || null,
    maxUses: f.maxUses.trim() ? Number(f.maxUses) : null,
    expiresAt: f.expiresOn ? endOfDayIso(f.expiresOn) : null,
    // Omitted, not null: "omit to generate a random code"; the key is write-only.
    ...(code ? { code } : {}),
    ...(key ? { anthropicKey: key } : {}),
  }
}
