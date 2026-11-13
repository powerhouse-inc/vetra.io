import type {
  CustomDomainStatus,
  HolderNotice,
  HolderNoticeKind,
  HolderSettingKind,
  HolderSettings,
} from '../types'

export type NoticeTone = 'info' | 'warning' | 'danger'

export const NOTICE_TONE: Record<HolderNoticeKind, NoticeTone> = {
  EXPIRING: 'warning',
  ENDED_STOP_PENDING: 'warning',
  STOPPED: 'info',
  STOPPED_DELETE_PENDING: 'danger',
  DELETE_IMMINENT: 'danger',
  APP_DISCONTINUED: 'warning',
}

export const NOTICE_CLASS: Record<NoticeTone, string> = {
  info: 'border-info/40 bg-info/10 text-info',
  warning: 'border-warning/40 bg-warning/10 text-warning',
  danger: 'border-destructive/40 bg-destructive/10 text-destructive',
}

/** Most urgent first: data deletion, then stops, then the rest. */
const NOTICE_ORDER: HolderNoticeKind[] = [
  'DELETE_IMMINENT',
  'STOPPED_DELETE_PENDING',
  'STOPPED',
  'ENDED_STOP_PENDING',
  'APP_DISCONTINUED',
  'EXPIRING',
]

export function sortedNotices(notices: HolderNotice[] | undefined): HolderNotice[] {
  return [...(notices ?? [])].sort(
    (a, b) => NOTICE_ORDER.indexOf(a.kind) - NOTICE_ORDER.indexOf(b.kind),
  )
}

export const DOMAIN_STATUS_LABEL: Record<CustomDomainStatus, string> = {
  DNS: 'Waiting for DNS',
  ISSUING: 'Issuing certificate',
  ACTIVE: 'Active',
  FAILED: 'Failed',
}

/** The DNS → issuing → active steps, in order, for the progress line. */
export const DOMAIN_STEPS: CustomDomainStatus[] = ['DNS', 'ISSUING', 'ACTIVE']

export const SETTING_KIND_LABEL: Record<HolderSettingKind, string> = {
  PLAIN: 'Plain',
  SECRET: 'Secret',
  FILE: 'File',
}

/** Capitals, digits and underscores, starting with a letter or underscore. */
export const SETTING_NAME = /^[A-Z_][A-Z0-9_]*$/

/** Why a setting name cannot be used, or null when it can. */
export function settingNameProblem(
  name: string,
  settings: Pick<HolderSettings, 'reservedNames' | 'reservedPrefixes'> | undefined,
): string | null {
  if (!SETTING_NAME.test(name)) return 'Use capitals, digits and underscores (e.g. MY_SETTING).'
  if (settings?.reservedNames.includes(name)) return `${name} is set by Vetra.`
  const prefix = settings?.reservedPrefixes.find((p) => name.startsWith(p))
  if (prefix) return `Names starting with ${prefix} are set by Vetra.`
  return null
}

/** An absolute path that does not climb out with `..`. */
export const isMountPath = (p: string): boolean => p.startsWith('/') && !p.split('/').includes('..')

/** Domain names only: labels of letters, digits and hyphens with a dot-separated TLD. */
export const isDomainName = (d: string): boolean =>
  /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(d)
