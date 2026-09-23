// Workflows take two independent flags: PH_WORKFLOWS_ENABLED (tenant env var,
// switchboard runs the engine) and connect.app.workflowsEnabled (Connect UI).

import type { TenantEnvVar } from '../graphql'

/** The tenant env var switchboard reads. */
export const PH_WORKFLOWS_ENABLED = 'PH_WORKFLOWS_ENABLED'

// Switchboard casts only "true"/"false", with "1"/"0" answered before it;
// anything else falls through to the config file rather than to on.
export function readsAsEnabled(raw: string | undefined | null): boolean {
  const v = raw?.trim()
  return v === 'true' || v === '1'
}

/** Whether the reactor half is on, given the tenant's env vars. */
export function reactorWorkflowsEnabled(envVars: TenantEnvVar[]): boolean {
  return readsAsEnabled(envVars.find((v) => v.key === PH_WORKFLOWS_ENABLED)?.value)
}

type RuntimeConfigPartial = {
  connect?: Record<string, unknown>
  packageRegistryUrl?: string
} | null

/** Whether the Connect half is on, given the env document's runtime config. */
export function connectWorkflowsEnabled(config: RuntimeConfigPartial): boolean {
  const app = config?.connect?.app
  if (!app || typeof app !== 'object' || Array.isArray(app)) return false
  return (app as Record<string, unknown>).workflowsEnabled === true
}

// Disabling deletes the key rather than writing false: the default is already
// false, and the runtime-config form's pruneToOverrides strips such a field.
export function withWorkflowsEnabled(
  config: RuntimeConfigPartial,
  enabled: boolean,
): Record<string, unknown> {
  const { connect, ...rest } = config ?? {}
  const app: Record<string, unknown> = {
    ...((connect?.app as Record<string, unknown> | undefined) ?? {}),
  }

  if (enabled) app.workflowsEnabled = true
  else delete app.workflowsEnabled

  const nextConnect: Record<string, unknown> = { ...connect }
  if (Object.keys(app).length > 0) nextConnect.app = app
  else delete nextConnect.app

  const out: Record<string, unknown> = { ...rest }
  if (Object.keys(nextConnect).length > 0) out.connect = nextConnect

  return out
}
