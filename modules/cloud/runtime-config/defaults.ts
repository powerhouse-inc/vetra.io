import type { DefaultDrive, LogLevel, PHConnectRuntimeConfig } from './types'

/**
 * Fully-populated default-config shape — every nested field is non-optional
 * so the form / UI can rely on `DEFAULT_CONNECT_CONFIG.drives.sections.remote.enabled`
 * without optional-chaining.
 */
export type DefaultConnectConfig = {
  branding: {
    appName: string
    homeBackground: { avif?: string; png?: string } | null
  }
  app: {
    logLevel: LogLevel
    basePath: string
  }
  packages: {
    externalEnabled: boolean
  }
  drives: {
    allowAddDrive: boolean
    defaultDrives: DefaultDrive[]
    sections: {
      remote: { enabled: boolean; allowAdd: boolean; allowDelete: boolean }
      local: { enabled: boolean; allowAdd: boolean; allowDelete: boolean }
    }
  }
  renown: {
    url: string
    networkId: string
    chainId: number
  }
}

/**
 * Default values for every Connect runtime-config field.
 *
 * MUST stay in sync with `DEFAULT_CONNECT_CONFIG` in the ph-monorepo at
 * `packages/shared/connect/runtime-config.ts`. The subgraph (eventually)
 * imports DEFAULT_CONNECT_CONFIG from `@powerhousedao/shared` and returns
 * `effective = deepMerge(DEFAULT_CONNECT_CONFIG, overrides)` from the
 * `runtimeConfig` query. Here we duplicate the values for the UI's
 * "default vs override" cue while the integration is still mock.
 *
 * TODO(integration): once the subgraph is live, the UI should not need this
 * file — the `effective` field of the query response carries the merged
 * config. We keep `overrides` for the override cue. Delete this file when
 * the subgraph hook lands.
 */
export const DEFAULT_CONNECT_CONFIG: DefaultConnectConfig = {
  branding: {
    appName: 'Powerhouse Connect',
    homeBackground: null,
  },
  app: {
    logLevel: 'info',
    basePath: '/',
  },
  packages: {
    externalEnabled: true,
  },
  drives: {
    allowAddDrive: true,
    defaultDrives: [],
    sections: {
      remote: { enabled: true, allowAdd: true, allowDelete: true },
      local: { enabled: true, allowAdd: true, allowDelete: true },
    },
  },
  renown: {
    url: 'https://www.renown.id',
    networkId: 'eip155',
    chainId: 1,
  },
}

/**
 * Deep-merge user overrides on top of DEFAULT_CONNECT_CONFIG.
 *
 * Merge semantics (must match the subgraph's behaviour):
 *  - Plain objects merge per-key (override wins)
 *  - Arrays are replaced wholesale (no element merge)
 *  - Primitives replace
 *  - undefined is "no opinion" — leave the default in place
 */
export function mergeWithDefaults(
  overrides: PHConnectRuntimeConfig,
): PHConnectRuntimeConfig {
  return deepMerge(DEFAULT_CONNECT_CONFIG, overrides) as PHConnectRuntimeConfig
}

function deepMerge<A, B>(a: A, b: B): A & B {
  if (Array.isArray(b)) return b as unknown as A & B
  if (b === undefined) return a as A & B
  if (typeof a !== 'object' || a === null) return b as A & B
  if (typeof b !== 'object' || b === null) return b as A & B
  const out: Record<string, unknown> = { ...(a as Record<string, unknown>) }
  for (const key of Object.keys(b as Record<string, unknown>)) {
    const bv = (b as Record<string, unknown>)[key]
    const av = (a as Record<string, unknown>)[key]
    if (bv === undefined) continue
    out[key] = deepMerge(av, bv)
  }
  return out as A & B
}

/**
 * True iff the form field at `jsonPath` is set by the user (present in
 * `overrides`). Used to render the "Reset to default" affordance.
 */
export function isOverridden(
  overrides: PHConnectRuntimeConfig,
  jsonPath: readonly (string | number)[],
): boolean {
  let cur: unknown = overrides
  for (const seg of jsonPath) {
    if (cur === null || cur === undefined) return false
    if (typeof cur !== 'object') return false
    cur = (cur as Record<string | number, unknown>)[seg]
    if (cur === undefined) return false
  }
  return true
}
