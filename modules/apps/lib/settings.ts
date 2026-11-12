import type { AppInstance, AppSetting, AppSettingScope, AppSettings } from '../types'

// Mirror the vetra-apps subgraph's checks (settings/names.ts) so the dialog says what is wrong
// before the server does; the server stays the authority.
export const SETTING_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/
export const SETTING_NAME_MAX = 128
export const PLAIN_VALUE_MAX_BYTES = 4096
export const SECRET_VALUE_MAX_BYTES = 65536
export const MAX_SETTINGS_PER_APP = 100

export const SETTING_SCOPES: readonly AppSettingScope[] = ['ALL', 'BRANCH', 'PREVIEW']

export const SCOPE_LABEL: Record<AppSettingScope, string> = {
  ALL: 'All instances',
  BRANCH: 'Branch instances',
  PREVIEW: 'Preview instances',
}

export const SCOPE_HINT: Record<AppSettingScope, string> = {
  ALL: 'Every branch and preview instance of this app.',
  BRANCH: 'Only release-branch instances. Wins over an "all instances" value of the same name.',
  PREVIEW: 'Only pull request previews. Wins over an "all instances" value of the same name.',
}

const SCOPE_ORDER: Record<AppSettingScope, number> = { ALL: 0, BRANCH: 1, PREVIEW: 2 }

/** Why `name` cannot be a setting name, or null when it can. */
export function settingNameError(
  name: string,
  reserved: Pick<AppSettings, 'reservedNames' | 'reservedPrefixes'>,
): string | null {
  if (!name) return 'Enter a name.'
  if (name.length > SETTING_NAME_MAX) return `At most ${SETTING_NAME_MAX} characters.`
  if (!SETTING_NAME_PATTERN.test(name))
    return 'Use capitals, digits and _, starting with a capital (e.g. API_BASE_URL).'
  if (reserved.reservedNames.includes(name)) return `${name} is set by Vetra; it cannot be set.`
  const prefix = reserved.reservedPrefixes.find((p) => name.startsWith(p))
  if (prefix) return `Names starting with ${prefix} are reserved for Vetra.`
  return null
}

const byteLength = (value: string) => new TextEncoder().encode(value).length

/** Why `value` cannot be stored, or null when it can. Never echoes the value. */
export function settingValueError(name: string, value: string, secret: boolean): string | null {
  const bytes = byteLength(value)
  if (secret) {
    if (name.startsWith('NEXT_PUBLIC_'))
      return 'NEXT_PUBLIC_ values are inlined into browser JavaScript, so they cannot be secret.'
    if (bytes === 0) return 'Enter the secret value.'
    if (bytes > SECRET_VALUE_MAX_BYTES) return 'A secret is at most 64 KiB.'
    return null
  }
  if (bytes > PLAIN_VALUE_MAX_BYTES)
    return 'A plain value is at most 4 KiB; store larger values as a secret.'
  return null
}

/** Puts a setting into the list in place of the one with the same name and scope, sorted. */
export function mergeAppSetting(
  data: AppSettings | undefined,
  setting: AppSetting,
): AppSettings | undefined {
  if (!data) return data
  const rest = data.settings.filter((s) => !(s.name === setting.name && s.scope === setting.scope))
  const settings = [...rest, setting].sort(
    (a, b) => a.name.localeCompare(b.name) || SCOPE_ORDER[a.scope] - SCOPE_ORDER[b.scope],
  )
  return { ...data, settings }
}

/** Removes the setting with this name and scope from the list. */
export function withoutAppSetting(
  data: AppSettings | undefined,
  name: string,
  scope: AppSettingScope,
): AppSettings | undefined {
  if (!data) return data
  return { ...data, settings: data.settings.filter((s) => !(s.name === name && s.scope === scope)) }
}

/** The instance has not yet run its current settings revision healthy. */
export function settingsPending(
  instance: Pick<AppInstance, 'settingsRevision' | 'runningSettingsRevision'>,
): boolean {
  return (
    !!instance.settingsRevision && instance.settingsRevision !== instance.runningSettingsRevision
  )
}

export const AFTER_SETTINGS_CHANGE = 'after a settings change'

/**
 * Splits a reason the reconciler prefixed with "after a settings change:" (the instance failed
 * on a new settings revision) into that fact and the underlying cause.
 */
export function splitSettingsReason(reason: string | null): {
  afterSettingsChange: boolean
  cause: string | null
} {
  if (!reason) return { afterSettingsChange: false, cause: null }
  const prefix = `${AFTER_SETTINGS_CHANGE}:`
  if (!reason.startsWith(prefix)) return { afterSettingsChange: false, cause: reason }
  return { afterSettingsChange: true, cause: reason.slice(prefix.length).trim() || null }
}
