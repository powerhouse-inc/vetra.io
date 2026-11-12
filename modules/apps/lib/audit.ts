import { sizeLabel } from './plans'
import { SCOPE_LABEL } from './settings'
import type { AppAuditEntry, AppSettingScope } from '../types'

/** The actor of rows Vetra writes itself (reconciler, policy). */
export const AUDIT_SYSTEM_ACTOR = 'vetra'

export const AUDIT_SOURCE_LABEL: Record<string, string> = {
  console: 'Console',
  api: 'API',
  ci: 'CI',
  system: 'Vetra',
  policy: 'Policy',
}

export const auditSourceLabel = (source: string): string => AUDIT_SOURCE_LABEL[source] ?? source

/** The filter kinds, each a prefix of `subject`. */
export const AUDIT_KINDS = [
  { value: 'plan:', label: 'Plans' },
  { value: 'setting:', label: 'Settings' },
  { value: 'role:', label: 'Release managers' },
  { value: 'instance:', label: 'Instances' },
  { value: 'release:', label: 'Releases' },
] as const
export type AuditKind = (typeof AUDIT_KINDS)[number]['value']

export function filterAudit(entries: AppAuditEntry[], kind: AuditKind | null): AppAuditEntry[] {
  return kind ? entries.filter((e) => e.subject.startsWith(kind)) : entries
}

/** The detail object; `{}` when it is not a JSON object. */
export function auditDetail(entry: Pick<AppAuditEntry, 'detail'>): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(entry.detail)
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** The detail pretty-printed for the expandable view; the raw text when it is not JSON. */
export function auditDetailText(entry: Pick<AppAuditEntry, 'detail'>): string {
  try {
    return JSON.stringify(JSON.parse(entry.detail), null, 2)
  } catch {
    return entry.detail
  }
}

/** The GitHub login CI acted as (release and build rows), if recorded. */
export function auditGithubActor(entry: AppAuditEntry): string | null {
  const v = auditDetail(entry).githubActor
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** A sentence part: text, or a person (an address) to show by their Renown name. */
export type AuditPart = string | { person: string }

const str = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : null

const scopeText = (v: unknown): string => {
  const s = str(v)
  return s && s in SCOPE_LABEL ? SCOPE_LABEL[s as AppSettingScope].toLowerCase() : (s ?? 'all')
}

/** "the plan pro" from a detail with a slug or name; the subject id otherwise. */
function planRef(d: Record<string, unknown>, subject: string): string {
  return str(d.name) ?? str(d.slug) ?? subject.replace(/^plan:/, '')
}

function changeText(field: string, change: unknown): string | null {
  if (!change || typeof change !== 'object') return null
  const { from, to } = change as { from?: unknown; to?: unknown }
  const f = str(from)
  const t = str(to)
  if (!t) return null
  const fmt = (v: string) => (field === 'size' ? sizeLabel(v) : v)
  return f ? `${field} from ${fmt(f)} to ${fmt(t)}` : `${field} to ${fmt(t)}`
}

/**
 * One readable sentence for an audit row, without its actor ("retargeted Pro from 1.4.0 to
 * 1.5.0"). People appear as parts so the UI can show their Renown name.
 */
export function describeAuditEntry(entry: AppAuditEntry): AuditPart[] {
  const d = auditDetail(entry)
  const plan = () => planRef(d, entry.subject)
  switch (entry.action) {
    case 'plan.created': {
      const extras = [str(d.access), str(d.size) ? sizeLabel(str(d.size)!) : null].filter(Boolean)
      const target = str(d.targetVersion)
      return [
        `created plan ${plan()}${extras.length ? ` (${extras.join(', ')})` : ''}${
          target ? `, targeting ${target}` : ''
        }`,
      ]
    }
    case 'plan.updated': {
      const changes =
        d.changes && typeof d.changes === 'object' ? (d.changes as Record<string, unknown>) : {}
      const parts = Object.entries(changes)
        .map(([field, c]) => changeText(field, c))
        .filter((x): x is string => !!x)
      return [`changed plan ${plan()}${parts.length ? `: ${parts.join(', ')}` : ''}`]
    }
    case 'plan.target_set': {
      const from = str(d.from)
      const to = str(d.to) ?? '?'
      return [from ? `retargeted ${plan()} from ${from} to ${to}` : `targeted ${plan()} at ${to}`]
    }
    case 'plan.retired':
      return [`retired plan ${plan()}`]
    case 'setting.set': {
      const name = str(d.name) ?? entry.subject.split('/').at(-1) ?? '?'
      const verb = d.replaced === true ? 'replaced' : 'set'
      return [`${verb} ${d.secret === true ? 'secret' : 'setting'} ${name} (${scopeText(d.scope)})`]
    }
    case 'setting.deleted': {
      const name = str(d.name) ?? entry.subject.split('/').at(-1) ?? '?'
      return [`deleted setting ${name} (${scopeText(d.scope)})`]
    }
    case 'role.granted':
    case 'role.removed': {
      const who = str(d.address) ?? entry.subject.replace(/^role:/, '')
      return entry.action === 'role.granted'
        ? ['named ', { person: who }, ' release manager']
        : ['removed ', { person: who }, ' as release manager']
    }
    case 'instance.status': {
      const name = str(d.name) ?? entry.subject.replace(/^instance:/, '')
      const from = str(d.from)
      const to = str(d.to) ?? '?'
      const reason = str(d.reason)
      return [`instance ${name}: ${from ? `${from} → ${to}` : to}${reason ? ` (${reason})` : ''}`]
    }
    case 'release.recorded':
    case 'build.recorded': {
      const kind = entry.action === 'release.recorded' ? 'release' : 'build'
      const version = str(d.version) ?? entry.subject.replace(/^release:/, '')
      const branch = str(d.branch)
      const pr = str(d.pr)
      const where = pr ? ` from PR #${pr}` : branch ? ` from ${branch}` : ''
      return [`recorded ${kind} ${version}${where}`]
    }
    default:
      return [`${entry.action} ${entry.subject}`]
  }
}
