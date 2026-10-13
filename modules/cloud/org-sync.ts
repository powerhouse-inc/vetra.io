import { resolveAuthToken } from './client'
import { setEnvironmentOrg, syncEnvironmentOrg, type EnvironmentOrgAccess } from './graphql'

/**
 * How long a syncEnvironmentOrg answer is reused client-side. The server
 * rate-limits the sync work per caller and environment (10 s), so asking more
 * often only costs round-trips.
 */
export const ORG_SYNC_CACHE_MS = 10_000

const syncCache = new Map<string, { at: number; access: EnvironmentOrgAccess }>()

/** Test hook: forget every cached sync answer. */
export function resetOrgSyncCache(): void {
  syncCache.clear()
}

/** Drop every cached sync answer for one environment (after a refusal or hand-over). */
export function forgetOrgSync(environmentId: string): void {
  for (const key of [...syncCache.keys()]) {
    if (key.endsWith(`|${environmentId}`)) syncCache.delete(key)
  }
}

/**
 * syncEnvironmentOrg with a short client-side cache keyed by caller and env.
 * Failures are not cached.
 */
export async function cachedSyncEnvironmentOrg(
  environmentId: string,
  token: string | null,
  opts: { caller?: string | null; now?: () => number; fresh?: boolean } = {},
): Promise<EnvironmentOrgAccess> {
  const now = opts.now ?? Date.now
  const key = `${opts.caller?.toLowerCase() ?? ''}|${environmentId}`
  const hit = syncCache.get(key)
  if (!opts.fresh && hit && now() - hit.at < ORG_SYNC_CACHE_MS) return hit.access
  const access = await syncEnvironmentOrg(environmentId, token)
  syncCache.set(key, { at: now(), access })
  return access
}

/** Best-effort operator sync, then the load (Ruling 6). */
export async function withOrgSync<T>(
  documentId: string,
  load: () => Promise<T>,
  deps: {
    sync: (id: string, token: string | null) => Promise<unknown>
    token: () => Promise<string | null>
  } = {
    sync: (id, token) => cachedSyncEnvironmentOrg(id, token, { fresh: true }),
    token: resolveAuthToken,
  },
): Promise<T> {
  try {
    await deps.sync(documentId, await deps.token())
  } catch {
    // Older switchboards, personal envs and Renown outages: load as before.
  }
  return load()
}

/** The caller may not sign actions on this organisation environment. */
export class EnvironmentAccessError extends Error {
  override name = 'EnvironmentAccessError'
  constructor(
    readonly environmentId: string,
    message: string,
  ) {
    super(message)
  }
}

/** The slice of a loaded environment controller the action gate needs. */
export type GateableController = {
  state: { global: unknown }
  pull: () => Promise<unknown>
}

function orgFields(state: unknown): { ownerOrgId: string | null; orgOperators: string[] } {
  const s = (state ?? {}) as { ownerOrgId?: string | null; orgOperators?: readonly string[] | null }
  return { ownerOrgId: s.ownerOrgId ?? null, orgOperators: [...(s.orgOperators ?? [])] }
}

/**
 * Gate for every signed action on an environment (C1 contract). On an
 * organisation environment the caller must be an operator: ask
 * syncEnvironmentOrg (cached briefly) and refuse unless it answers
 * canOperate. When the local copy does not list the caller as an operator yet
 * (the sync just added them), pull first so the local reducer agrees.
 * Personal environments pass without a round-trip.
 */
export async function ensureCanOperateEnvironment(
  environmentId: string,
  controller: GateableController,
  caller: string | null | undefined,
  deps: {
    sync: (id: string, token: string | null, caller: string | null) => Promise<EnvironmentOrgAccess>
    token: () => Promise<string | null>
  } = {
    sync: (id, token, who) => cachedSyncEnvironmentOrg(id, token, { caller: who }),
    token: resolveAuthToken,
  },
): Promise<void> {
  const local = orgFields(controller.state.global)
  if (!local.ownerOrgId) return
  const who = caller?.toLowerCase() ?? null
  let access: EnvironmentOrgAccess
  try {
    access = await deps.sync(environmentId, await deps.token(), who)
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    throw new EnvironmentAccessError(
      environmentId,
      `Could not confirm your access to this organisation environment (${reason}). Try again in a moment.`,
    )
  }
  if (!access.canOperate) {
    throw new EnvironmentAccessError(
      environmentId,
      'Your organisation role does not allow changes to this environment. Ask an organisation admin for publisher access.',
    )
  }
  if (who && !local.orgOperators.includes(who)) await controller.pull()
}

export class EnvironmentHandOverError extends Error {
  override name = 'EnvironmentHandOverError'
  constructor(
    readonly environmentId: string,
    message: string,
  ) {
    super(message)
  }
}

/** setEnvironmentOrg, retried while the read model has not caught up with the new env. */
export async function handOverToOrg(
  environmentId: string,
  orgId: string,
  token: string | null,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const attempts = opts.attempts ?? 6
  const delayMs = opts.delayMs ?? 1000
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  for (let i = 1; ; i++) {
    try {
      await setEnvironmentOrg(environmentId, orgId, token)
      forgetOrgSync(environmentId)
      return
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!/ENV_NOT_FOUND/.test(message) || i >= attempts) {
        throw new EnvironmentHandOverError(environmentId, message)
      }
      await sleep(delayMs)
    }
  }
}

/** Statuses setEnvironmentOrg refuses with ENV_NOT_ACTIVE (released environments). */
export const RELEASED_ENV_STATUSES: ReadonlySet<string> = new Set([
  'TERMINATING',
  'DESTROYED',
  'ARCHIVED',
])

/**
 * Who may be offered "move to an organisation": the env is personal, not an
 * app env and still active, the viewer is its personal owner, and the target
 * organisations are those where the viewer is PUBLISHER or above (the server
 * decides again and refuses otherwise).
 */
export function handOverTargets<O extends { id: string; role: string }>(input: {
  ownerOrgId: string | null | undefined
  owner: string | null | undefined
  viewer: string | null | undefined
  status: string | null | undefined
  appLinked: boolean
  orgs: readonly O[]
}): O[] {
  if (input.ownerOrgId || input.appLinked) return []
  if (input.status && RELEASED_ENV_STATUSES.has(input.status)) return []
  const owner = input.owner?.toLowerCase()
  if (!owner || owner !== input.viewer?.toLowerCase()) return []
  return input.orgs.filter((o) => o.role !== 'MEMBER')
}

/** User-facing text for a syncEnvironmentOrg / setEnvironmentOrg refusal. */
export function describeEnvironmentOrgError(message: string, orgName = 'the organisation'): string {
  if (/ENV_NOT_ACTIVE/.test(message))
    return 'This environment is no longer active (terminating, destroyed or archived) and cannot be moved.'
  if (/ALREADY_ORG_OWNED/.test(message))
    return 'This environment already belongs to an organisation.'
  if (/APP_ENVIRONMENT/.test(message))
    return 'App environments follow their app; transfer the app to the organisation instead.'
  if (/FORBIDDEN/.test(message))
    return `Only the environment's owner can move it, and only into an organisation where they are a publisher or above (${orgName}).`
  if (/ENV_NOT_FOUND/.test(message))
    return 'The environment was not found yet. Try again in a moment.'
  if (/UNAUTHENTICATED/.test(message)) return 'Log in with Renown to continue.'
  return message
}

/**
 * One signed action on a loaded environment: the org gate, then dispatch and
 * push. Any refusal on an organisation environment (from the gate or the
 * server) drops the cached sync answer and calls `onOrgRefusal`, so the
 * viewer's access (and the R6 edit gate) is asked again.
 */
export async function runSignedEnvironmentAction<
  C extends GateableController & { push: () => Promise<unknown> },
>(
  environmentId: string,
  controller: C,
  caller: string | null | undefined,
  dispatch: (controller: C) => void,
  opts: {
    onOrgRefusal?: () => void
    gate?: typeof ensureCanOperateEnvironment
  } = {},
): Promise<void> {
  const gate = opts.gate ?? ensureCanOperateEnvironment
  try {
    await gate(environmentId, controller, caller)
    dispatch(controller)
    await controller.push()
  } catch (err) {
    if (err instanceof EnvironmentAccessError || orgFields(controller.state.global).ownerOrgId) {
      forgetOrgSync(environmentId)
      opts.onOrgRefusal?.()
    }
    throw err
  }
}

/**
 * The `ownerOrgId` the env detail page feeds the R6 edit gate. A personal
 * answer (`null`) counts only once the signed controller has loaded (signed
 * actions need it); an organisation id from the read-only fetch may open the
 * sync-backed gate early. `undefined` keeps the gate closed.
 */
export function editGateOwnerOrgId(input: {
  canSign: boolean
  controllerLoaded: boolean
  ownerOrgId: string | null | undefined
}): string | null | undefined {
  if (input.ownerOrgId === null && input.canSign && !input.controllerLoaded) return undefined
  return input.ownerOrgId
}
