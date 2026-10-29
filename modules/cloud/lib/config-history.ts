/**
 * Config history for an environment document: the configuration at each past
 * approval, and the plan of controller calls that brings the current config
 * back to one of them.
 *
 * Snapshots come from folding the config-changing operations into a small
 * record (not from replaying the package reducer): the reducer enforces
 * ownership and status transitions that a client-side replay of a partial or
 * org-rotated history can trip over, while the config fields it touches are
 * few and simple. The fold mirrors the reducer for exactly those fields.
 * Operations the reducer rejected (`error` set) left state untouched, so they
 * are skipped here too.
 */
import { SIZE_LABELS } from './resource-maps'
import { serviceInstanceLabel } from './service-label'
import type {
  CloudEnvironmentServiceType,
  CloudEnvironmentState,
  CloudResourceSize,
  CloudServiceClintConfig,
  CloudServiceEnv,
  TenantService,
} from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The slice of a document operation this module reads. */
export type HistoryOperation = {
  index?: number
  timestampUtcMs?: string | number | null
  error?: string | null
  action: {
    type: string
    input?: unknown
    context?: { signer?: { user?: { address?: string | null } | null } | null } | null
  }
}

export type ServiceSnapshot = {
  type: CloudEnvironmentServiceType
  prefix: string
  enabled: boolean
  size: CloudResourceSize | null
  /** CLINT only. */
  config: CloudServiceClintConfig | null
}

export type PackageSnapshot = { version: string | null; registry: string | null }

export type ConfigSnapshot = {
  label: string | null
  genericSubdomain: string | null
  customDomain: { enabled: boolean; domain: string | null } | null
  apexService: CloudEnvironmentServiceType | null
  services: ServiceSnapshot[]
  packages: Record<string, PackageSnapshot>
}

export type DeployedVersion = {
  /** Operation index of the approval. */
  index: number
  /** ISO time of the approval, or null when the operation carries none. */
  time: string | null
  /** Lowercased address of whoever approved, when signed. */
  signer: string | null
  config: ConfigSnapshot
  /** What changed against the previous approval (all of it, for the first). */
  changes: string[]
}

export type RestoreStep =
  | { kind: 'setLabel'; label: string; summary: string }
  | { kind: 'setGenericSubdomain'; subdomain: string; summary: string }
  | {
      kind: 'disableService'
      type: CloudEnvironmentServiceType
      prefix: string
      summary: string
    }
  | {
      kind: 'enableService'
      type: CloudEnvironmentServiceType
      prefix: string
      clintConfig?: CloudServiceClintConfig
      summary: string
    }
  | { kind: 'setServiceSize'; prefix: string; size: CloudResourceSize; summary: string }
  | { kind: 'setServiceConfig'; prefix: string; config: CloudServiceClintConfig; summary: string }
  | { kind: 'removePackage'; name: string; summary: string }
  | {
      kind: 'addPackage'
      name: string
      version?: string
      registry?: string
      summary: string
    }
  | { kind: 'setPackageVersion'; name: string; version: string; summary: string }
  | {
      kind: 'setCustomDomain'
      enabled: boolean
      domain: string | null
      apexService: TenantService | null
      summary: string
    }

export type RestorePlan = { steps: RestoreStep[]; lines: string[] }

/** The detail-hook methods a restore plan calls. */
export type RestoreActions = {
  setLabel: (label: string) => Promise<void>
  setGenericSubdomain: (subdomain: string) => Promise<void>
  enableService: (
    type: CloudEnvironmentServiceType,
    prefix: string,
    clintConfig?: CloudServiceClintConfig,
  ) => Promise<void>
  disableService: (type: CloudEnvironmentServiceType, prefix?: string) => Promise<void>
  setServiceSize: (prefix: string, size: CloudResourceSize) => Promise<void>
  setServiceConfig: (prefix: string, config: CloudServiceClintConfig) => Promise<void>
  addPackage: (name: string, version?: string, registry?: string) => Promise<void>
  removePackage: (name: string) => Promise<void>
  setPackageVersion: (name: string, version: string) => Promise<void>
  setCustomDomain: (
    enabled: boolean,
    domain?: string | null,
    apexService?: TenantService | null,
  ) => Promise<void>
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

const DEFAULT_SIZE: CloudResourceSize = 'VETRA_AGENT_S'

/** Actions after which the env is approved for deployment. */
const APPROVAL_ACTIONS = new Set(['APPROVE_CHANGES', 'INITIALIZE', 'WAKE_ENVIRONMENT'])

export function emptyConfig(): ConfigSnapshot {
  return {
    label: null,
    genericSubdomain: null,
    customDomain: null,
    apexService: null,
    services: [],
    packages: {},
  }
}

function normalizeEnv(env: ReadonlyArray<Partial<CloudServiceEnv>> | null | undefined) {
  return (env ?? []).map((e) => ({
    name: e.name ?? '',
    value: e.isSecret === true ? null : (e.value ?? null),
    isSecret: e.isSecret ?? null,
  }))
}

type ClintConfigInput = {
  package: { registry: string; name: string; version?: string | null }
  env?: ReadonlyArray<Partial<CloudServiceEnv>> | null
  serviceCommand?: string | null
  selectedRessource?: CloudResourceSize | null
}

function normalizeClintConfig(
  c: ClintConfigInput | null | undefined,
): CloudServiceClintConfig | null {
  if (!c?.package) return null
  return {
    package: {
      registry: c.package.registry,
      name: c.package.name,
      version: c.package.version ?? null,
    },
    env: normalizeEnv(c.env),
    serviceCommand: c.serviceCommand ?? null,
    selectedRessource: c.selectedRessource ?? null,
  }
}

/** The config record of a live document state. */
export function snapshotFromState(state: CloudEnvironmentState): ConfigSnapshot {
  const packages: Record<string, PackageSnapshot> = {}
  for (const p of state.packages ?? []) {
    packages[p.name] = { version: p.version ?? null, registry: p.registry || null }
  }
  return {
    label: state.label ?? null,
    genericSubdomain: state.genericSubdomain ?? null,
    customDomain: state.customDomain
      ? { enabled: state.customDomain.enabled, domain: state.customDomain.domain ?? null }
      : null,
    apexService: state.apexService ?? null,
    services: (state.services ?? []).map((s) => ({
      type: s.type,
      prefix: s.prefix,
      enabled: s.enabled,
      size: s.selectedRessource ?? null,
      config: s.type === 'CLINT' ? normalizeClintConfig(s.config) : null,
    })),
    packages,
  }
}

function clone(c: ConfigSnapshot): ConfigSnapshot {
  return {
    ...c,
    customDomain: c.customDomain ? { ...c.customDomain } : null,
    services: c.services.map((s) => ({ ...s })),
    packages: Object.fromEntries(Object.entries(c.packages).map(([k, v]) => [k, { ...v }])),
  }
}

type AnyInput = Record<string, unknown>

/** Find a service the way the reducer does: CLINT by type+prefix, others by type. */
function findService(
  c: ConfigSnapshot,
  type: CloudEnvironmentServiceType,
  prefix?: string | null,
): ServiceSnapshot | undefined {
  return type === 'CLINT' && prefix
    ? c.services.find((s) => s.type === type && s.prefix === prefix)
    : c.services.find((s) => s.type === type)
}

/**
 * Apply one operation's config effect (mutates `c`). Mirrors the package
 * reducer for the config fields only; anything else is ignored.
 */
export function applyConfigAction(c: ConfigSnapshot, type: string, rawInput: unknown): void {
  const input = (rawInput ?? {}) as AnyInput
  switch (type) {
    case 'SET_LABEL':
      if (input.label) c.label = input.label as string
      return
    case 'SET_GENERIC_SUBDOMAIN':
      if (input.genericSubdomain) c.genericSubdomain = input.genericSubdomain as string
      return
    case 'INITIALIZE':
      c.genericSubdomain = (input.genericSubdomain as string) ?? c.genericSubdomain
      return
    case 'SET_CUSTOM_DOMAIN':
      c.customDomain = {
        enabled: !!input.enabled,
        domain: (input.domain as string | null) || null,
      }
      return
    case 'SET_APEX_SERVICE':
      c.apexService = (input.type as CloudEnvironmentServiceType | null) ?? null
      return
    case 'ENABLE_SERVICE': {
      const svcType = input.type as CloudEnvironmentServiceType
      const prefix = input.prefix as string
      const config =
        svcType === 'CLINT' ? normalizeClintConfig(input.clintConfig as ClintConfigInput) : null
      const size = (input.selectedRessource as CloudResourceSize | null) ?? null
      const existing = findService(c, svcType, svcType === 'CLINT' ? prefix : null)
      if (existing && (svcType !== 'CLINT' || existing.prefix === prefix)) {
        existing.enabled = true
        existing.prefix = prefix
        if (config) existing.config = config
        if (size) existing.size = size
      } else {
        c.services.push({
          type: svcType,
          prefix,
          enabled: true,
          size: size ?? DEFAULT_SIZE,
          config,
        })
      }
      return
    }
    case 'DISABLE_SERVICE': {
      const svc = findService(c, input.type as CloudEnvironmentServiceType, input.prefix as string)
      if (svc) svc.enabled = false
      return
    }
    case 'TOGGLE_SERVICE': {
      const svc = c.services.find((s) => s.type === input.type)
      if (svc) svc.enabled = !svc.enabled
      return
    }
    case 'UPDATE_SERVICE_PREFIX': {
      const svc = c.services.find((s) => s.type === input.type)
      if (svc) svc.prefix = input.prefix as string
      return
    }
    case 'SET_SERVICE_CONFIG': {
      const svc = c.services.find((s) => s.prefix === input.prefix)
      const config = normalizeClintConfig(input.config as ClintConfigInput)
      if (svc && svc.type === 'CLINT' && config) {
        svc.config = config
        if (config.selectedRessource) svc.size = config.selectedRessource
      }
      return
    }
    case 'SET_SERVICE_SIZE': {
      const svc = c.services.find((s) => s.prefix === input.prefix)
      if (svc) {
        svc.size = input.size as CloudResourceSize
        if (svc.config) svc.config = { ...svc.config, selectedRessource: svc.size }
      }
      return
    }
    case 'ADD_PACKAGE': {
      const name = input.packageName as string
      const version = (input.version as string | null) ?? 'latest'
      const registry = (input.registry as string | null) || null
      const existing = c.packages[name]
      c.packages[name] = existing
        ? { version, registry: registry ?? existing.registry }
        : { version, registry }
      return
    }
    case 'REMOVE_PACKAGE':
      if (input.packageName) delete c.packages[input.packageName as string]
      return
    case 'SET_PACKAGE_VERSION': {
      const pkg = c.packages[input.packageName as string]
      if (pkg) pkg.version = input.version as string
      return
    }
    default:
      return
  }
}

function toIso(ts: string | number | null | undefined): string | null {
  if (ts === null || ts === undefined || ts === '') return null
  const n = typeof ts === 'number' ? ts : /^\d+$/.test(ts) ? Number(ts) : Date.parse(ts)
  return Number.isFinite(n) ? new Date(n).toISOString() : null
}

function signerOf(op: HistoryOperation): string | null {
  return op.action.context?.signer?.user?.address?.toLowerCase() ?? null
}

/** Canonical form for equality: services and packages in a stable order. */
function canonical(c: ConfigSnapshot): string {
  return JSON.stringify({
    ...c,
    services: [...c.services].sort((a, b) =>
      `${a.type}:${a.prefix}`.localeCompare(`${b.type}:${b.prefix}`),
    ),
    packages: Object.keys(c.packages)
      .sort()
      .map((k) => [k, c.packages[k]]),
  })
}

export function sameConfig(a: ConfigSnapshot, b: ConfigSnapshot): boolean {
  return canonical(a) === canonical(b)
}

/**
 * The approval points of an environment, newest first, each with the config
 * it approved. An approval whose config equals the one before it (a wake, or
 * an approval of non-config changes) is left out, so every entry is a
 * distinct configuration.
 */
export function deployedVersions(operations: readonly HistoryOperation[]): DeployedVersion[] {
  const config = emptyConfig()
  const versions: DeployedVersion[] = []
  let previous = emptyConfig()
  operations.forEach((op, i) => {
    if (op.error) return
    applyConfigAction(config, op.action.type, op.action.input)
    if (!APPROVAL_ACTIONS.has(op.action.type)) return
    if (versions.length > 0 && sameConfig(previous, config)) return
    const snapshot = clone(config)
    versions.push({
      index: op.index ?? i,
      time: toIso(op.timestampUtcMs),
      signer: signerOf(op),
      config: snapshot,
      changes: restorePlan(previous, snapshot).lines,
    })
    previous = snapshot
  })
  return versions.reverse()
}

// ---------------------------------------------------------------------------
// Restore plan
// ---------------------------------------------------------------------------

function sizeLabel(size: CloudResourceSize | null): string {
  return size ? (SIZE_LABELS[size] ?? size) : 'default'
}

function serviceKey(s: { type: string; prefix: string }) {
  return s.type === 'CLINT' ? `CLINT:${s.prefix}` : s.type
}

function sameClintConfig(a: CloudServiceClintConfig | null, b: CloudServiceClintConfig | null) {
  const strip = (c: CloudServiceClintConfig | null) =>
    c ? JSON.stringify({ ...c, selectedRessource: null }) : null
  return strip(a) === strip(b)
}

function domainText(d: ConfigSnapshot['customDomain']): string {
  return d?.enabled && d.domain ? d.domain : 'off'
}

/**
 * The controller calls that turn `current` into `target`, in a safe order:
 * renames, services off, packages out, services on (with size and agent
 * settings), packages in, and the custom domain last (its apex service must
 * be on first). `lines` is the same plan in plain words.
 */
export function restorePlan(current: ConfigSnapshot, target: ConfigSnapshot): RestorePlan {
  const steps: RestoreStep[] = []

  if (target.label && target.label !== current.label) {
    steps.push({
      kind: 'setLabel',
      label: target.label,
      summary: `Name: ${current.label ?? '—'} → ${target.label}`,
    })
  }
  if (target.genericSubdomain && target.genericSubdomain !== current.genericSubdomain) {
    steps.push({
      kind: 'setGenericSubdomain',
      subdomain: target.genericSubdomain,
      summary: `Subdomain: ${current.genericSubdomain ?? '—'} → ${target.genericSubdomain}`,
    })
  }

  // Services off
  const targetByKey = new Map(target.services.map((s) => [serviceKey(s), s]))
  const currentByKey = new Map(current.services.map((s) => [serviceKey(s), s]))
  for (const cur of current.services) {
    if (!cur.enabled) continue
    const tgt = targetByKey.get(serviceKey(cur))
    if (tgt?.enabled) continue
    steps.push({
      kind: 'disableService',
      type: cur.type,
      prefix: cur.prefix,
      summary: `Turn off ${serviceInstanceLabel(cur)}`,
    })
  }

  // Packages out
  for (const name of Object.keys(current.packages)) {
    if (!(name in target.packages)) {
      steps.push({ kind: 'removePackage', name, summary: `Remove ${name}` })
    }
  }

  // Services on, prefix, size, agent settings
  for (const tgt of target.services) {
    if (!tgt.enabled) continue
    const cur = currentByKey.get(serviceKey(tgt))
    const label = serviceInstanceLabel(tgt)
    let size = cur?.size ?? null
    let config = cur?.config ?? null
    if (!cur || !cur.enabled || cur.prefix !== tgt.prefix) {
      const clintConfig =
        tgt.type === 'CLINT' && tgt.config
          ? { ...tgt.config, selectedRessource: tgt.size ?? tgt.config.selectedRessource }
          : undefined
      steps.push({
        kind: 'enableService',
        type: tgt.type,
        prefix: tgt.prefix,
        clintConfig,
        summary:
          cur?.enabled && cur.prefix !== tgt.prefix
            ? `Prefix of ${label}: ${cur.prefix} → ${tgt.prefix}`
            : `Turn on ${label}`,
      })
      if (clintConfig) {
        config = clintConfig
        size = clintConfig.selectedRessource ?? size
      }
      if (!cur) size = size ?? DEFAULT_SIZE
    }
    if (tgt.size && tgt.size !== size) {
      steps.push({
        kind: 'setServiceSize',
        prefix: tgt.prefix,
        size: tgt.size,
        summary: `Size of ${label}: ${sizeLabel(size)} → ${sizeLabel(tgt.size)}`,
      })
    }
    if (tgt.type === 'CLINT' && tgt.config && !sameClintConfig(config, tgt.config)) {
      steps.push({
        kind: 'setServiceConfig',
        prefix: tgt.prefix,
        config: { ...tgt.config, selectedRessource: tgt.size ?? tgt.config.selectedRessource },
        summary: `Settings of ${label}`,
      })
    }
  }

  // Packages in
  for (const [name, tgt] of Object.entries(target.packages)) {
    const cur = current.packages[name]
    if (!cur) {
      steps.push({
        kind: 'addPackage',
        name,
        version: tgt.version ?? undefined,
        registry: tgt.registry ?? undefined,
        summary: `Add ${name}${tgt.version ? ` ${tgt.version}` : ''}`,
      })
    } else if (tgt.version && tgt.version !== cur.version) {
      steps.push({
        kind: 'setPackageVersion',
        name,
        version: tgt.version,
        summary: `${name}: ${cur.version ?? 'latest'} → ${tgt.version}`,
      })
    }
  }

  // Custom domain (with its apex service) last
  const tgtOn = !!target.customDomain?.enabled
  const curOn = !!current.customDomain?.enabled
  const domainChanged =
    tgtOn !== curOn || (tgtOn && target.customDomain?.domain !== current.customDomain?.domain)
  const apexChanged = tgtOn && (target.apexService ?? null) !== (current.apexService ?? null)
  if (domainChanged || apexChanged) {
    const parts: string[] = []
    if (domainChanged) {
      parts.push(
        `Custom domain: ${domainText(current.customDomain)} → ${domainText(target.customDomain)}`,
      )
    }
    if (apexChanged) {
      const name = (t: CloudEnvironmentServiceType | null) =>
        t ? serviceInstanceLabel({ type: t }) : 'none'
      parts.push(
        `Service on the bare domain: ${name(current.apexService)} → ${name(target.apexService)}`,
      )
    }
    steps.push({
      kind: 'setCustomDomain',
      enabled: tgtOn,
      domain: tgtOn ? (target.customDomain?.domain ?? null) : null,
      apexService: tgtOn ? ((target.apexService as TenantService | null) ?? null) : null,
      summary: parts.join('; '),
    })
  }

  return { steps, lines: steps.map((s) => s.summary) }
}

/**
 * Dispatch a restore plan step by step. Stops at the first failure; the
 * error carries how many steps went through (`done`).
 */
export async function applyRestorePlan(
  steps: readonly RestoreStep[],
  actions: RestoreActions,
  onStep?: (done: number) => void,
): Promise<void> {
  let done = 0
  try {
    for (const step of steps) {
      await runStep(step, actions)
      done += 1
      onStep?.(done)
    }
  } catch (err) {
    throw Object.assign(err instanceof Error ? err : new Error(String(err)), { done })
  }
}

function runStep(step: RestoreStep, a: RestoreActions): Promise<void> {
  switch (step.kind) {
    case 'setLabel':
      return a.setLabel(step.label)
    case 'setGenericSubdomain':
      return a.setGenericSubdomain(step.subdomain)
    case 'disableService':
      return a.disableService(step.type, step.prefix)
    case 'enableService':
      return a.enableService(step.type, step.prefix, step.clintConfig)
    case 'setServiceSize':
      return a.setServiceSize(step.prefix, step.size)
    case 'setServiceConfig':
      return a.setServiceConfig(step.prefix, step.config)
    case 'removePackage':
      return a.removePackage(step.name)
    case 'addPackage':
      return a.addPackage(step.name, step.version, step.registry)
    case 'setPackageVersion':
      return a.setPackageVersion(step.name, step.version)
    case 'setCustomDomain':
      return a.setCustomDomain(step.enabled, step.domain, step.apexService)
  }
}
