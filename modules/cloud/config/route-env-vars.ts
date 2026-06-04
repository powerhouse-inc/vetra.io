import type { CloudServiceEnv } from '@/modules/cloud/types'

/**
 * Split user-entered custom env-var rows into the two paths the system uses:
 *
 *   - `secretsToPersist`: rows the caller must write to the encrypted
 *     tenant_secrets table via `setTenantSecret(tenantId, name, value)`
 *     BEFORE dispatching the document mutation. These are rows with
 *     isSecret=true AND a non-empty value the user typed (either a brand-
 *     new secret, or a replacement for an existing one).
 *
 *   - `envForDocument`: the env array to pass into clintConfig. Plain rows
 *     keep their value; secret rows have value=null + isSecret=true so the
 *     reducer enforces the no-secret-in-document invariant. Empty-named
 *     rows are dropped.
 *
 * The split is deliberate: secret VALUES must never enter the document
 * model. The document only carries a reference (the env name + isSecret=true);
 * the actual value lives in tenant_secrets only.
 *
 * Edge cases handled:
 *   - Secret row loaded from document (value=null/empty, isSecret=true) and
 *     the user did NOT type a new value → no setTenantSecret call needed;
 *     the existing stored value is preserved. The row still goes into
 *     envForDocument so the agent's envFrom keeps referencing it.
 *   - Plain row that the user just marked as secret (isSecret=true, value
 *     still non-empty from the previous edit) → setTenantSecret is queued
 *     with that value; the value is then zeroed out before reaching the
 *     document. This is the only path that can leak if the caller
 *     forgets the split: the helper enforces it.
 *   - Row with empty name → dropped from both outputs (matches the
 *     filter at the previous call site).
 */
export type EnvVarRouting = {
  secretsToPersist: Array<{ name: string; value: string }>
  envForDocument: CloudServiceEnv[]
}

export function routeEnvVars(rows: CloudServiceEnv[]): EnvVarRouting {
  const secretsToPersist: Array<{ name: string; value: string }> = []
  const envForDocument: CloudServiceEnv[] = []
  for (const row of rows) {
    const name = row.name.trim()
    if (!name) continue
    const isSecret = row.isSecret === true
    const value = (row.value ?? '').trim()
    if (isSecret) {
      if (value !== '') {
        secretsToPersist.push({ name, value })
      }
      envForDocument.push({ name, value: null, isSecret: true })
    } else {
      envForDocument.push({ name, value: row.value ?? '', isSecret: false })
    }
  }
  return { secretsToPersist, envForDocument }
}
