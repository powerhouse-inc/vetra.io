import type { PackageManifest } from '@/modules/cloud/config/types'

/**
 * Agents are published as packages whose name ends in `-cli`. The suffix is
 * a fast registry-search filter; manifest validation (below) is the
 * authoritative check before installation proceeds.
 */
export function isAgentPackageName(name: string): boolean {
  return name.length > 4 && name.endsWith('-cli')
}

export type AgentManifestValidation =
  { ok: true; manifest: PackageManifest } | { ok: false; reason: 'manifest-missing' | 'not-clint' }

/** Validate a registry-fetched manifest as an installable agent. */
export function validateAgentManifest(manifest: PackageManifest | null): AgentManifestValidation {
  if (!manifest) return { ok: false, reason: 'manifest-missing' }
  if (manifest.type !== 'clint-project') return { ok: false, reason: 'not-clint' }
  return { ok: true, manifest }
}
