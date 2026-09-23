'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { useMemo } from 'react'

import { AddPackageModal } from '@/modules/cloud/components/add-package-modal'
import { ConfigRow } from '@/modules/cloud/components/config-row'
import { PackageRow } from '@/modules/cloud/components/package-row'
import type { PackageManifest } from '@/modules/cloud/config/types'
import { useRegistryManifests } from '@/modules/cloud/hooks/use-registry-search'
import { useTenantConfig } from '@/modules/cloud/hooks/use-tenant-config'
import { ADDON_CONFIG_KEYS } from '@/modules/cloud/lib/addons'
import type { CloudPackage } from '@/modules/cloud/types'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'

export type PackagesSectionProps = {
  tenantId: string | null
  registryUrl: string
  /**
   * The full list of installed packages on this env. Used for the
   * AddPackageModal (so it knows what's already installed) and as the
   * source of truth for fetching manifests + finding orphan tenant keys.
   */
  installedPackages: CloudPackage[]
  /**
   * The "module" subset — packages that load into Switchboard's reactor
   * or Connect, i.e. everything except clint agents. Already partitioned
   * upstream so this component doesn't need to know about agents.
   */
  modulePackages: CloudPackage[]
  onAddPackage: (name: string, version?: string) => Promise<void>
  onRemovePackage: (name: string) => Promise<void>
  onSetPackageVersion?: (packageName: string, version: string) => Promise<void>
  initialAddPackage?: string | null
  initialAddVersion?: string | null
}

/**
 * Packages section — title, AddPackageModal, the table of
 * expandable package rows (each row reveals its own env vars + secrets),
 * and a footer "Unused Config" card for tenant keys not declared by any
 * installed package.
 *
 * Owns the single `useTenantConfig` + `useRegistryManifests` call so each
 * row gets its slice of state via props (no N+1 fetches).
 */
export function PackagesSection({
  tenantId,
  registryUrl,
  installedPackages,
  modulePackages,
  onAddPackage,
  onRemovePackage,
  onSetPackageVersion,
  initialAddPackage,
  initialAddVersion,
}: PackagesSectionProps) {
  const {
    envVars,
    secrets,
    isLoading: tenantLoading,
    setVar,
    setSecret,
    deleteVar,
    deleteSecret,
  } = useTenantConfig(tenantId)

  const packageSpecs = useMemo(
    () => installedPackages.map((p) => ({ name: p.name, version: p.version })),
    [installedPackages],
  )
  const { manifests, isLoading: manifestsLoading } = useRegistryManifests(registryUrl, packageSpecs)

  const manifestByName = useMemo(() => {
    const out: Record<string, PackageManifest | null> = {}
    for (const m of manifests) out[m.packageName] = m.manifest
    return out
  }, [manifests])

  const existingVarValues = useMemo(() => {
    const out: Record<string, string> = {}
    for (const v of envVars) out[v.key] = v.value
    return out
  }, [envVars])
  const existingSecretKeys = useMemo(() => new Set(secrets.map((s) => s.key)), [secrets])

  const declaredKeyNames = useMemo(() => {
    const set = new Set<string>()
    for (const m of manifests) {
      for (const e of m.manifest?.config ?? []) set.add(e.name)
    }
    return set
  }, [manifests])

  const orphanVars = envVars.filter(
    (v) => !declaredKeyNames.has(v.key) && !ADDON_CONFIG_KEYS.has(v.key),
  )
  const orphanSecrets = secrets.filter(
    (s) => !declaredKeyNames.has(s.key) && !ADDON_CONFIG_KEYS.has(s.key),
  )

  // While manifests are still in-flight we can't yet tell "manifest missing"
  // from "manifest still loading", so the per-row "Could not load" copy is
  // gated on the load being complete.
  const manifestsResolved = !manifestsLoading

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Packages</h2>
          <span className="text-muted-foreground text-xs">Reactor modules &amp; Connect apps</span>
          {(tenantLoading || manifestsLoading) && (
            <Loader2 className="text-muted-foreground h-3 w-3 animate-spin" />
          )}
        </div>
        <AddPackageModal
          registryUrl={registryUrl}
          tenantId={tenantId}
          installedPackages={installedPackages}
          onAdd={onAddPackage}
          initialPackage={initialAddPackage}
          initialVersion={initialAddVersion}
          initialOpen={!!initialAddPackage}
        />
      </div>

      {modulePackages.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Package</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="w-12 text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {modulePackages.map((pkg) => {
              const manifest = manifestByName[pkg.name] ?? null
              // "manifest missing" is only meaningful once the load resolved;
              // before that we render the same expanded body as "loading".
              const manifestMissing = manifestsResolved && !manifest
              return (
                <PackageRow
                  key={pkg.name}
                  pkg={pkg}
                  tenantId={tenantId}
                  registryUrl={registryUrl}
                  installedPackages={installedPackages}
                  manifest={manifest}
                  manifestMissing={manifestMissing}
                  manifestLoading={manifestsLoading}
                  existingVarValues={existingVarValues}
                  existingSecretKeys={existingSecretKeys}
                  onRemove={onRemovePackage}
                  onSetVersion={onSetPackageVersion}
                  onSetVar={setVar}
                  onSetSecret={setSecret}
                  onDeleteVar={deleteVar}
                  onDeleteSecret={deleteSecret}
                />
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="text-muted-foreground rounded-md border border-dashed p-4 text-center text-xs">
          No packages installed yet — add one to extend Switchboard or Connect.
        </div>
      )}

      {(orphanVars.length > 0 || orphanSecrets.length > 0) && (
        <div className="mt-6 rounded-md border p-4">
          <div className="mb-3 flex items-center gap-2">
            <AlertCircle className="text-muted-foreground h-4 w-4" />
            <h4 className="text-sm font-semibold">Unused Config</h4>
            <span className="text-muted-foreground text-xs">
              Keys set on this tenant that aren&rsquo;t declared by any installed package.
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-16 text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {orphanVars.map((v) => (
                <ConfigRow
                  key={`var-${v.key}`}
                  entry={{ name: v.key, type: 'var' }}
                  currentValue={v.value}
                  isSet={true}
                  onSave={(value) => setVar(v.key, value)}
                  onDelete={() => deleteVar(v.key)}
                />
              ))}
              {orphanSecrets.map((s) => (
                <ConfigRow
                  key={`secret-${s.key}`}
                  entry={{ name: s.key, type: 'secret' }}
                  currentValue={null}
                  isSet={true}
                  onSave={(value) => setSecret(s.key, value)}
                  onDelete={() => deleteSecret(s.key)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
