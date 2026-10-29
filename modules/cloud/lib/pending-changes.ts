import { serviceInstanceLabel } from './service-label'

/** One change that Approve would deploy, worded like the environment page. */
export type PendingChange = {
  /** What the change is about; a later change with the same key replaces it. */
  key: string
  kind: 'add' | 'remove' | 'change'
  label: string
}

type OperationLike = { action: { type: string; input: unknown } }
type ServiceLike = { type: string; prefix?: string | null; enabled?: boolean }
type Input = Record<string, unknown>

/** Actions that approve the config, after which nothing is pending. */
const APPROVALS = new Set(['APPROVE_CHANGES', 'INITIALIZE', 'WAKE_ENVIRONMENT'])

const str = (value: unknown) => (typeof value === 'string' ? value : '')

/**
 * The changes Approve would deploy: config operations since the last approval.
 * Only actions whose reducer sets CHANGES_PENDING are listed. A later change to
 * the same thing replaces the earlier one, and adding then removing something
 * cancels out. `services` is the current state, used to name services that an
 * action only identifies by prefix.
 */
export function pendingChanges(
  operations: readonly OperationLike[],
  services: readonly ServiceLike[] = [],
): PendingChange[] {
  let start = 0
  operations.forEach((op, i) => {
    if (APPROVALS.has(op.action.type)) start = i + 1
  })

  const changes = new Map<string, PendingChange>()
  for (const op of operations.slice(start)) {
    const change = describe(op.action.type, (op.action.input ?? {}) as Input, services)
    if (!change) continue
    const previous = changes.get(change.key)
    // Delete first so the list follows the order of the latest edits.
    changes.delete(change.key)
    let kind = change.kind
    if (previous?.kind === 'add') {
      if (kind === 'remove') continue
      kind = 'add'
    } else if (previous?.kind === 'remove' && kind === 'add') {
      kind = 'change'
    }
    changes.set(change.key, { ...change, kind })
  }
  return [...changes.values()]
}

function describe(
  type: string,
  input: Input,
  services: readonly ServiceLike[],
): PendingChange | null {
  const byPrefix = (prefix: string) => services.find((s) => s.prefix === prefix)
  const nameOf = (svc: ServiceLike | undefined, fallback: string) =>
    svc ? serviceInstanceLabel(svc) : fallback

  switch (type) {
    case 'SET_LABEL':
      return { key: 'label', kind: 'change', label: `Rename to “${str(input.label)}”` }
    case 'SET_GENERIC_SUBDOMAIN':
      return {
        key: 'subdomain',
        kind: 'change',
        label: `Subdomain: ${str(input.genericSubdomain)}`,
      }
    case 'SET_CUSTOM_DOMAIN':
      return {
        key: 'custom-domain',
        kind: 'change',
        label: input.enabled ? `Custom domain: ${str(input.domain)}` : 'Turn off the custom domain',
      }
    case 'SET_APEX_SERVICE':
      return {
        key: 'apex',
        kind: 'change',
        label: input.type
          ? `Serve ${serviceInstanceLabel({ type: str(input.type) })} at the domain root`
          : 'Serve nothing at the domain root',
      }
    case 'ENABLE_SERVICE': {
      const svc = { type: str(input.type), prefix: str(input.prefix) }
      return {
        key: `service:${svc.type}:${svc.prefix}`,
        kind: 'add',
        label: `Enable ${serviceInstanceLabel(svc)}`,
      }
    }
    case 'DISABLE_SERVICE': {
      const svc = { type: str(input.type), prefix: str(input.prefix) }
      return {
        key: `service:${svc.type}:${svc.prefix}`,
        kind: 'remove',
        label: `Disable ${serviceInstanceLabel(svc)}`,
      }
    }
    case 'TOGGLE_SERVICE': {
      const svc = services.find((s) => s.type === str(input.type))
      const name = nameOf(svc, serviceInstanceLabel({ type: str(input.type) }))
      return {
        key: `toggle:${str(input.type)}`,
        kind: 'change',
        label: svc?.enabled === false ? `Turn off ${name}` : `Turn on ${name}`,
      }
    }
    case 'UPDATE_SERVICE_PREFIX':
      return {
        key: `prefix:${str(input.type)}`,
        kind: 'change',
        label: `${serviceInstanceLabel({ type: str(input.type) })} prefix: ${str(input.prefix)}`,
      }
    case 'SET_SERVICE_SIZE': {
      const prefix = str(input.prefix)
      return {
        key: `size:${prefix}`,
        kind: 'change',
        label: `${nameOf(byPrefix(prefix), prefix)} size: ${str(input.size)}`,
      }
    }
    case 'SET_SERVICE_CONFIG': {
      const prefix = str(input.prefix)
      return {
        key: `config:${prefix}`,
        kind: 'change',
        label: `Update ${nameOf(byPrefix(prefix), prefix)} settings`,
      }
    }
    case 'ADD_PACKAGE': {
      const name = str(input.packageName)
      const version = str(input.version)
      return {
        key: `package:${name}`,
        kind: 'add',
        label: version ? `Install ${name} ${version}` : `Install ${name}`,
      }
    }
    case 'REMOVE_PACKAGE': {
      const name = str(input.packageName)
      return { key: `package:${name}`, kind: 'remove', label: `Remove ${name}` }
    }
    default:
      return null
  }
}
