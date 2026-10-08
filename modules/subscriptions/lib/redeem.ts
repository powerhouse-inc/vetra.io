import type { RedeemInviteCodeInput } from '../types'

/** Decode a URL path segment once; a malformed escape is returned as typed. */
export function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export type RedeemChoice = 'new' | { upgrades: string }

export function redeemInput({
  code,
  choice,
  label,
  mode,
}: {
  code: string
  choice: RedeemChoice
  label: string
  mode: string | null
}): RedeemInviteCodeInput {
  if (choice !== 'new') return { code, upgrades: choice.upgrades }
  if (mode === 'DEDICATED') return { code, label: label.trim() || null }
  return { code }
}
