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
