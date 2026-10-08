import type { StatusMeta } from '@/modules/apps/lib/status'
import type { PublisherInviteCode } from '../types'

const TERM: Record<string, StatusMeta> = {
  DRAFT: { label: 'Draft', tone: 'neutral', active: false },
  ACTIVE: { label: 'Published', tone: 'success', active: false },
  RETIRED: { label: 'Retired', tone: 'warning', active: false },
}

const LICENSE: Record<string, StatusMeta> = {
  ISSUED: { label: 'Setting up', tone: 'progress', active: true },
  ACTIVE: { label: 'Active', tone: 'success', active: false },
  EXPIRED: { label: 'Expired', tone: 'warning', active: false },
  REVOKED: { label: 'Revoked', tone: 'danger', active: false },
  REPLACED: { label: 'Replaced', tone: 'neutral', active: false },
}

const unknown = (status: string): StatusMeta => ({ label: status, tone: 'neutral', active: false })

export const termStatusMeta = (status: string): StatusMeta => TERM[status] ?? unknown(status)
export const licenseStatusMeta = (status: string): StatusMeta => LICENSE[status] ?? unknown(status)

export type InviteCodeState = 'active' | 'paused' | 'expired' | 'used-up'

export function inviteCodeState(
  code: Pick<PublisherInviteCode, 'active' | 'expiresAt' | 'maxUses' | 'redemptions'>,
  now: Date = new Date(),
): InviteCodeState {
  if (!code.active) return 'paused'
  if (code.expiresAt && new Date(code.expiresAt).getTime() <= now.getTime()) return 'expired'
  if (code.maxUses != null && code.redemptions >= code.maxUses) return 'used-up'
  return 'active'
}

const CODE: Record<InviteCodeState, StatusMeta> = {
  active: { label: 'Active', tone: 'success', active: false },
  paused: { label: 'Paused', tone: 'neutral', active: false },
  expired: { label: 'Expired', tone: 'warning', active: false },
  'used-up': { label: 'Used up', tone: 'neutral', active: false },
}
export const inviteCodeStatusMeta = (state: InviteCodeState): StatusMeta => CODE[state]
