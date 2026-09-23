'use client'

import { useCallback } from 'react'

import type { TenantEnvVar } from '../graphql'
import type { AddonControl } from '../lib/addons'
import {
  PH_WORKFLOWS_ENABLED,
  connectWorkflowsEnabled,
  reactorWorkflowsEnabled,
  withWorkflowsEnabled,
} from '../lib/workflows'

type RuntimeConfig = Parameters<typeof withWorkflowsEnabled>[0]

type Params = {
  tenantId: string | null
  envVars: TenantEnvVar[]
  setVar: (key: string, value: string) => Promise<void>
  tenantConfigLoaded: boolean
  tenantConfigError: Error | null
  runtimeConfig: RuntimeConfig
  setRuntimeConfig: (config: Record<string, unknown> | null) => Promise<void>
  runtimeConfigSupported: boolean
}

// Workflows is a flag pair, not a service: PH_WORKFLOWS_ENABLED on the tenant
// and connect.app.workflowsEnabled in the env document's runtime config.
export function useWorkflowsAddon({
  tenantId,
  envVars,
  setVar,
  tenantConfigLoaded,
  tenantConfigError,
  runtimeConfig,
  setRuntimeConfig,
  runtimeConfigSupported,
}: Params): AddonControl {
  // A half-configured env reads OFF, so switching it on writes the missing half.
  const enabled = reactorWorkflowsEnabled(envVars) && connectWorkflowsEnabled(runtimeConfig)

  const toggle = useCallback(
    async (next: boolean) => {
      const verb = next ? 'enable' : 'disable'
      try {
        await setVar(PH_WORKFLOWS_ENABLED, next ? 'true' : 'false')
      } catch (err) {
        throw new Error(`Couldn't ${verb} Workflows.`, { cause: err })
      }
      // Both writes are idempotent, so a retry finishes a half-applied toggle.
      try {
        await setRuntimeConfig(withWorkflowsEnabled(runtimeConfig, next))
      } catch (err) {
        throw new Error(`Workflows were only partly ${verb}d. Retry to finish.`, { cause: err })
      }
    },
    [setVar, setRuntimeConfig, runtimeConfig],
  )

  const unavailable = !runtimeConfigSupported
    ? 'Not supported by this environment yet.'
    : !tenantId
      ? 'Available once the environment has been deployed.'
      : tenantConfigError
        ? "Couldn't load the current setting."
        : !tenantConfigLoaded
          ? 'Loading current setting…'
          : undefined

  return { enabled, unavailable, toggle }
}
