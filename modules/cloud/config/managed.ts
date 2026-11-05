/**
 * Secrets Vetra Cloud generates per tenant and refuses to let users set or
 * delete; replacing one makes the data encrypted under it unreadable.
 */
export const MANAGED_SECRET_KEYS: ReadonlySet<string> = new Set(['PH_WORKFLOWS_SECRETS_MASTER_KEY'])

/** Drops managed keys from a manifest's `config`, so no form, required check or uninstall touches them. */
export function withoutManagedConfig(manifest: unknown): unknown {
  if (typeof manifest !== 'object' || manifest === null) return manifest
  const m = manifest as Record<string, unknown>
  if (!Array.isArray(m.config)) return manifest
  return {
    ...m,
    config: m.config.filter((entry: unknown) => {
      const name = (entry as { name?: unknown } | null)?.name
      return typeof name !== 'string' || !MANAGED_SECRET_KEYS.has(name)
    }),
  }
}

/**
 * Keys Vetra writes onto a tenant itself: licensing reporting, the Studio LLM
 * broker and Studio provisioning. No package declares them, but they are not
 * "unused": editing or deleting one breaks licensing or the Studio, so the
 * console shows them read-only. Keep in sync with the cloud-package writers
 * (vetra-licensing/reporting, vetra-llm/broker, vetra-studio-pool/create-env).
 */
export const PLATFORM_CONFIG_KEYS: ReadonlySet<string> = new Set([
  // vetra-licensing: per-environment usage reporting
  'VETRA_LICENSING_URL',
  'VETRA_REPORTING_TOKEN',
  // vetra-llm: the Studio's model budget
  'VETRA_MODEL',
  'VETRA_MODEL_FALLBACKS',
  'OPENROUTER_API_KEY',
  // vetra-studio-pool: Studio provisioning
  'ADMINS',
  'CI',
  'npm_config_node_linker',
  'PH_ATTACHMENT_URL_SIGNING_SECRET',
  'PH_REGISTRY_URL',
  'VETRA_CLOUD_RENOWN_URL',
  'VETRA_CLOUD_SWITCHBOARD_URL',
  'VETRA_ENVIRONMENT_ID',
  'VETRA_OBSERVABILITY_CONSENT',
  'VETRA_SESSION_EXPORT_SECRET',
  'VETRA_STUDIO_LAUNCH_SECRET',
  ...MANAGED_SECRET_KEYS,
])

export const isPlatformConfigKey = (key: string): boolean => PLATFORM_CONFIG_KEYS.has(key)
