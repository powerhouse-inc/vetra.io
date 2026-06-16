'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { Check, ChevronsUpDown, Loader2, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { applyConfigChanges, computeConfigChanges } from '@/modules/cloud/config/apply'
import { buildCollisionMap } from '@/modules/cloud/config/collisions'
import type { PackageManifest } from '@/modules/cloud/config/types'
import {
  initialConfigFormState,
  PackageConfigForm,
  validateConfigForm,
  type ConfigFormState,
} from '@/modules/cloud/components/package-config-form'
import {
  useRegistryManifest,
  useRegistryManifests,
  useRegistryPackages,
  useRegistryVersions,
} from '@/modules/cloud/hooks/use-registry-search'
import { useTenantConfig } from '@/modules/cloud/hooks/use-tenant-config'
import type { CloudPackage } from '@/modules/cloud/types'
import { AsyncButton } from '@/modules/cloud/components/async-button'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/modules/shared/components/ui/command'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/modules/shared/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/modules/shared/components/ui/popover'

export type AddPackageModalProps = {
  registryUrl: string | null
  /**
   * Tenant scope for config mutations. When null, the modal still works but
   * skips the config form and the `applyConfigChanges` step (no secrets/env
   * vars to write against).
   */
  tenantId: string | null
  /** Packages currently installed on this environment (for collision detection). */
  installedPackages: CloudPackage[]
  onAdd: (packageName: string, version?: string) => Promise<void>
  initialPackage?: string | null
  initialVersion?: string | null
  initialOpen?: boolean
}

export function AddPackageModal({
  registryUrl,
  tenantId,
  installedPackages,
  onAdd,
  initialPackage,
  initialVersion,
  initialOpen,
}: AddPackageModalProps) {
  const renown = useRenown()
  const [open, setOpen] = useState(initialOpen ?? false)

  const [packageSearch, setPackageSearch] = useState(initialPackage ?? '')
  const [selectedPackage, setSelectedPackage] = useState<string | null>(initialPackage ?? null)
  const [selectedVersion, setSelectedVersion] = useState<string>(initialVersion ?? '')
  const [packagePopoverOpen, setPackagePopoverOpen] = useState(false)
  const [versionPopoverOpen, setVersionPopoverOpen] = useState(false)
  const [configState, setConfigState] = useState<ConfigFormState>({})

  const { packages, isLoading: packagesLoading } = useRegistryPackages(registryUrl, packageSearch)
  const { info: versionInfo, isLoading: versionsLoading } = useRegistryVersions(
    registryUrl,
    selectedPackage,
  )

  // Manifest for the candidate package+version.
  const { manifest: candidateManifest, isLoading: candidateManifestLoading } = useRegistryManifest(
    registryUrl,
    selectedPackage,
    selectedVersion || null,
  )

  // Installed packages' manifests for collision detection. Only fetched while
  // the modal is open — no point querying the registry when the dialog is closed.
  const installedForFetch = useMemo(
    () => (open ? installedPackages.map((p) => ({ name: p.name, version: p.version })) : []),
    [open, installedPackages],
  )
  const { manifests: installedManifests } = useRegistryManifests(registryUrl, installedForFetch)

  // Tenant config (to prefill + satisfy required-field checks). Gated on
  // `open` so we don't hit the secrets subgraph on every env page load.
  const { envVars, secrets } = useTenantConfig(open ? tenantId : null)
  const existingVarValues = useMemo(() => {
    const out: Record<string, string> = {}
    for (const v of envVars) out[v.key] = v.value
    return out
  }, [envVars])
  const existingSecretKeys = useMemo(() => new Set(secrets.map((s) => s.key)), [secrets])

  const collisions = useMemo(() => {
    const fromInstalled = installedManifests.map((m) => ({
      packageName: m.packageName,
      manifest: m.manifest,
    }))
    const candidate = selectedPackage
      ? [{ packageName: selectedPackage, manifest: candidateManifest }]
      : []
    return buildCollisionMap([...fromInstalled, ...candidate])
  }, [installedManifests, candidateManifest, selectedPackage])

  // Reset form state when the candidate manifest changes (new package/version).
  useEffect(() => {
    if (!selectedPackage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfigState({})
      return
    }
    const entries = candidateManifest?.config ?? []
    if (entries.length === 0) {
      setConfigState({})
      return
    }

    setConfigState(
      initialConfigFormState(entries, {
        existingVarValues,
        existingSecretKeys,
        collisions,
        ownerPackageName: selectedPackage,
      }),
    )
    // Only re-init when the manifest identity changes — not on every tenant-config tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidateManifest, selectedPackage])

  const missingRequired = useMemo(() => {
    if (!candidateManifest?.config?.length) return []
    return validateConfigForm(candidateManifest.config, configState, {
      existingVarValues,
      existingSecretKeys,
      collisions,
      ownerPackageName: selectedPackage ?? '',
    })
  }, [
    candidateManifest,
    configState,
    existingVarValues,
    existingSecretKeys,
    collisions,
    selectedPackage,
  ])

  const resetForm = () => {
    setPackageSearch('')
    setSelectedPackage(null)
    setSelectedVersion('')
    setConfigState({})
  }

  const handleSubmit = async () => {
    if (!selectedPackage) throw new Error('Pick a package first.')
    if (missingRequired.length > 0) {
      const msg = `Missing required config: ${missingRequired.join(', ')}`
      toast.error(msg)
      throw new Error(msg)
    }
    try {
      const entries = candidateManifest?.config ?? []
      if (tenantId && entries.length > 0) {
        const changes = computeConfigChanges(entries, configState, existingVarValues)
        if (changes.length > 0) {
          await applyConfigChanges(tenantId, changes, renown)
        }
      }
      await onAdd(selectedPackage, selectedVersion || undefined)
      toast.success('Package added successfully')
      // Close only after the mutation has resolved successfully so the user
      // sees server-side errors (e.g. registry resolution failure) inline.
      resetForm()
      setOpen(false)
    } catch (error) {
      console.error('Failed to add package:', error)
      const msg = error instanceof Error ? error.message : 'Failed to add package'
      toast.error(msg)
      throw error instanceof Error ? error : new Error(msg)
    }
  }

  const configEntries = candidateManifest?.config ?? []
  const showConfigForm = !!selectedPackage && configEntries.length > 0 && tenantId !== null
  const isAddDisabled = !selectedPackage || candidateManifestLoading || missingRequired.length > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) resetForm()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-1">
          <Plus className="h-3 w-3" />
          Add package
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Package</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Package name combobox */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Package Name</label>
            <Popover open={packagePopoverOpen} onOpenChange={setPackagePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={packagePopoverOpen}
                  className="w-full justify-between font-normal"
                >
                  {selectedPackage ?? 'Search Package'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput
                    placeholder="Search packages..."
                    value={packageSearch}
                    onValueChange={setPackageSearch}
                  />
                  <CommandList>
                    {packagesLoading && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                      </div>
                    )}
                    {!packagesLoading && packages.length === 0 && (
                      <CommandEmpty>
                        {registryUrl ? 'No packages found.' : 'No registry configured.'}
                      </CommandEmpty>
                    )}
                    <CommandGroup>
                      {packages.map((pkg) => (
                        <CommandItem
                          key={pkg.name}
                          value={pkg.name}
                          onSelect={() => {
                            setSelectedPackage(pkg.name)
                            setSelectedVersion('')
                            setPackagePopoverOpen(false)
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{pkg.name}</span>
                            <span className="text-muted-foreground text-xs">
                              latest: {pkg.version}
                            </span>
                          </div>
                          {selectedPackage === pkg.name && (
                            <Check className="ml-auto h-4 w-4 shrink-0" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Version combobox */}
          {selectedPackage && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Version</label>
              <Popover open={versionPopoverOpen} onOpenChange={setVersionPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={versionPopoverOpen}
                    className="w-full justify-between font-mono text-sm font-normal"
                    disabled={versionsLoading}
                  >
                    {versionsLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      selectedVersion || 'latest'
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search versions..." />
                    <CommandList>
                      <CommandEmpty>No versions found.</CommandEmpty>
                      <CommandGroup heading="Tags">
                        {Object.entries(versionInfo?.distTags ?? {}).map(([tag, ver]) => (
                          <CommandItem
                            key={tag}
                            value={`tag:${tag}`}
                            onSelect={() => {
                              setSelectedVersion(ver)
                              setVersionPopoverOpen(false)
                            }}
                          >
                            <span className="font-medium">{tag}</span>
                            <span className="text-muted-foreground ml-2 font-mono text-xs">
                              {ver}
                            </span>
                            {selectedVersion === ver && (
                              <Check className="ml-auto h-4 w-4 shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                      <CommandGroup heading="Versions">
                        {(versionInfo?.versions ?? []).map((ver) => (
                          <CommandItem
                            key={ver}
                            value={ver}
                            onSelect={() => {
                              setSelectedVersion(ver)
                              setVersionPopoverOpen(false)
                            }}
                          >
                            <span className="font-mono text-sm">{ver}</span>
                            {selectedVersion === ver && (
                              <Check className="ml-auto h-4 w-4 shrink-0" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Configuration section */}
          {selectedPackage && candidateManifestLoading && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading package manifest...
            </div>
          )}

          {showConfigForm && candidateManifest && (
            <div className="border-t pt-4">
              <h3 className="mb-3 text-sm font-semibold">Configuration</h3>
              <PackageConfigForm
                manifest={candidateManifest}
                state={configState}
                onChange={setConfigState}
                ctx={{
                  existingVarValues,
                  existingSecretKeys,
                  collisions,
                  ownerPackageName: selectedPackage,
                }}
              />
            </div>
          )}

          {selectedPackage && !candidateManifestLoading && !candidateManifest && (
            <p className="text-muted-foreground text-xs italic">
              Could not load manifest — installing without config checks.
            </p>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <AsyncButton onClickAsync={handleSubmit} disabled={isAddDisabled} pendingLabel="Adding…">
            Add Package
          </AsyncButton>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Shared empty-type guard: treats `PackageManifest | null` from the hook
 * as always defined when used inside the form. Kept here for readers.
 */
export type { PackageManifest }
