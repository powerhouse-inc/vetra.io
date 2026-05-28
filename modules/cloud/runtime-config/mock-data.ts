import type { PHConnectRuntimeConfig, RuntimeConfigPayload } from './types'
import { mergeWithDefaults, DEFAULT_CONNECT_CONFIG } from './defaults'

/**
 * Mock fixtures — Storybook only.
 *
 * Production code paths talk to the real `vetra-cloud-runtime-config`
 * subgraph via `useRuntimeConfig` / `modules/cloud/graphql.ts`. These
 * fixtures are intercepted by the story's fetch decorator so the drawer
 * renders without a live backend.
 */

/** Empty overrides — every field uses defaults. */
export const MOCK_PAYLOAD_PRISTINE: RuntimeConfigPayload = {
  effective: DEFAULT_CONNECT_CONFIG as PHConnectRuntimeConfig,
  overrides: {},
  schemaVersion: '2',
  updatedAt: null,
}

/** A few overrides set — the realistic editing state. */
const overridesWithEdits: PHConnectRuntimeConfig = {
  branding: {
    appName: 'My Custom Connect',
  },
  app: {
    logLevel: 'debug',
  },
  drives: {
    sections: {
      local: { enabled: false },
    },
  },
  renown: {
    url: 'https://staging.renown.id',
  },
}

export const MOCK_PAYLOAD_WITH_OVERRIDES: RuntimeConfigPayload = {
  effective: mergeWithDefaults(overridesWithEdits),
  overrides: overridesWithEdits,
  schemaVersion: '2',
  updatedAt: '2026-05-24T15:22:00.000Z',
}

/** Used in stories that simulate the JSON-view starting in an invalid state. */
export const MOCK_INVALID_JSON =
  '{ "branding": { "appName": "Trailing comma broken", }, "app": { "logLevel": "WRONG" } }'
