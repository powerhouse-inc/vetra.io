import { renownMediaUrl, renownWebUrl } from '@/modules/apps/lib/app-profile/renown'
import type { OrgSummary } from '../types'

/** Every renown.id URL Vetra links to for organisations lives here (routes are handle-based). */
export type OrgManageSection =
  'members' | 'teams' | 'apps' | 'security' | 'domains' | 'webhooks' | 'oidc' | 'audit' | 'settings'

export const renownOrgPageUrl = (handle: string) =>
  `${renownWebUrl()}/@${encodeURIComponent(handle)}`
export const renownOrgManageUrl = (handle: string, section: OrgManageSection = 'members') =>
  `${renownWebUrl()}/org/${encodeURIComponent(handle)}/manage/${section}`
export const renownCreateOrgUrl = () => `${renownWebUrl()}/org/new`
/** Where a publisher starts a person → organisation transfer (renown.id owns the flow). */
export const renownOrgBringAppUrl = (handle: string, appDid: string) =>
  `${renownWebUrl()}/org/${encodeURIComponent(handle)}/manage/apps?bring=${encodeURIComponent(appDid)}`
export const renownMeUrl = (hash: 'organisations' | 'app-transfers') =>
  `${renownWebUrl()}/me#${hash}`
export const orgAvatarUrl = (org: Pick<OrgSummary, 'id' | 'avatar'>) =>
  org.avatar ? renownMediaUrl(org.id, 'avatar', org.avatar) : null
