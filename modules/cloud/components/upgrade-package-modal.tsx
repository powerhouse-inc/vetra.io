'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { ArrowUpCircle, Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { applyConfigChanges, computeConfigChanges } from '@/modules/cloud/config/apply'
import { buildCollisionMap } from '@/modules/cloud/config/collisions'
import type { ConfigEntry } from '@/modules/cloud/config/types'
import {
  initialConfigFormState,
  PackageConfigForm,
  validateConfigForm,
  type ConfigFormState,
} from '@/modules/cloud/components/package-config-form'
import {
  useRegistryManifest,
  useRegistryManifests,
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

export type UpgradePackageModalProps = {
  registryUrl: string | null
  tenantId: string | null
  installedPackages: CloudPackage[]
  packageName: string
  currentVersion: string | null
  onUpgrade: (packageName: string, version: string) => Promise<void>
  trigger?: React.ReactNode
  /** Optional controlled-open state. When provided, no internal DialogTrigger is rendered. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function UpgradePackageModal({
  registryUrl,
  tenantId,
  installedPackages,
  packageName,
  currentVersion,
  onUpgrade,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: UpgradePackageModalProps) {
  const renown = useRenown()
  const [internalOpen, setInternalOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = (next: boolean) => {
    if (isControlled) onOpenChange?.(next)
    else setInternalOpen(next)
  }
  const [selectedVersion, setSelectedVersion] = useState<string>('')
  const [versionPopoverOpen, setVersionPopoverOpen] = useState(false)
  const [configState, setConfigState] = useState<ConfigFormState>({})

  const { info: versionInfo, isLoading: versionsLoading } = useRegistryVersions(
    registryUrl,
    open ? packageName : null,
  )
  const { manifest: targetManifest, isLoading: targetLoading } = useRegistryManifest(
    registryUrl,
    open ? packageName : null,
    selectedVersion || null,
  )

  // Fetch manifests for installed packages so we can:
  //   (1) detect which config entries are genuinely NEW in the target version
  //       (vs. already declared by the currently-installed version).
  //   (2) show collision labels.
  const otherInstalled = useMemo(
    () =>
      open
        ? installedPackages
            .filter((p) => p.name !== packageName)
            .map((p) => ({ name: p.name, version: p.version }))
        : [],
    [open, installedPackages, packageName],
  )
  const { manifests: otherManifests } = useRegistryManifests(registryUrl, otherInstalled)

  const { manifest: currentManifest } = useRegistryManifest(
    registryUrl,
    open ? packageName : null,
    currentVersion,
  )

  const { envVars, secrets } = useTenantConfig(open ? tenantId : null)
  const existingVarValues = useMemo(() => {
    const out: Record<string, string> = {}
    for (const v of envVars) out[v.key] = v.value
    return out
  }, [envVars])
  const existingSecretKeys = useMemo(() => new Set(secrets.map((s) => s.key)), [secrets])

  /**
   * Entries that are:
   *  - required in the target version
   *  - not already set in the tenant
   * These are the only entries the upgrade modal asks about. Optional entries
   * and already-declared required entries flow through silently.
   */
  const gatedEntries: ConfigEntry[] = useMemo(() => {
    const entries = targetManifest?.config ?? []
    const currentRequiredNames = new Set(
      (currentManifest?.config ?? []).filter((e) => e.required).map((e) => e.name),
    )
    return entries.filter((e) => {
      if (!e.required) return false
      if (e.type === 'var' && e.name in existingVarValues) return false
      if (e.type === 'secret' && existingSecretKeys.has(e.name)) return false
      // If the current version already required this and it's not set, we still ask.
      // Otherwise we ask because it's genuinely new.
      return currentRequiredNames.has(e.name) ? true : true
    })
  }, [targetManifest, currentManifest, existingVarValues, existingSecretKeys])

  const collisions = useMemo(() => {
    const base = otherManifests.map((m) => ({
      packageName: m.packageName,
      manifest: m.manifest,
    }))
    return buildCollisionMap([...base, { packageName, manifest: targetManifest }])
  }, [otherManifests, packageName, targetManifest])

  useEffect(() => {
    if (!selectedVersion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConfigState({})
      return
    }
    if (gatedEntries.length === 0) {
      setConfigState({})
      return
    }

    setConfigState(
      initialConfigFormState(gatedEntries, {
        existingVarValues,
        existingSecretKeys,
        collisions,
        ownerPackageName: packageName,
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion, targetManifest])

  const missingRequired = useMemo(() => {
    if (gatedEntries.length === 0) return []
    return validateConfigForm(gatedEntries, configState, {
      existingVarValues,
      existingSecretKeys,
      collisions,
      ownerPackageName: packageName,
    })
  }, [gatedEntries, configState, existingVarValues, existingSecretKeys, collisions, packageName])

  const handleUpgrade = async () => {
    if (!selectedVersion) throw new Error('Pick a version first.')
    if (missingRequired.length > 0) {
      const msg = `Missing required config: ${missingRequired.join(', ')}`
      toast.error(msg)
      throw new Error(msg)
    }
    try {
      if (tenantId && gatedEntries.length > 0) {
        const changes = computeConfigChanges(gatedEntries, configState, existingVarValues)
        if (changes.length > 0) {
          await applyConfigChanges(tenantId, changes, renown)
        }
      }
      await onUpgrade(packageName, selectedVersion)
      toast.success(`Upgraded ${packageName} to ${selectedVersion}`)
      // Close only after the mutation has actually resolved successfully.
      setOpen(false)
      setSelectedVersion('')
    } catch (error) {
      console.error('Failed to upgrade package:', error)
      const msg = error instanceof Error ? error.message : 'Failed to upgrade package'
      toast.error(msg)
      throw error instanceof Error ? error : new Error(msg)
    }
  }

  const isDisabled =
    !selectedVersion ||
    targetLoading ||
    missingRequired.length > 0 ||
    selectedVersion === currentVersion

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setSelectedVersion('')
          setConfigState({})
        }
      }}
    >
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <ArrowUpCircle className="h-3 w-3" />
              Upgrade
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Upgrade <span className="font-mono text-sm">{packageName}</span>
          </DialogTitle>
          {currentVersion && (
            <p className="text-muted-foreground text-xs">
              Current version: <span className="font-mono">{currentVersion}</span>
            </p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New version</label>
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
                    selectedVersion || 'Select version...'
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
                          {ver === currentVersion && (
                            <span className="text-muted-foreground ml-2 text-[9px]">current</span>
                          )}
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

          {selectedVersion && targetLoading && (
            <div className="text-muted-foreground flex items-center gap-2 text-xs">
              <Loader2 className="h-3 w-3 animate-spin" />
              Checking manifest for new required config...
            </div>
          )}

          {selectedVersion && !targetLoading && gatedEntries.length > 0 && tenantId && (
            <div className="border-t pt-4">
              <h3 className="mb-1 text-sm font-semibold">New required configuration</h3>
              <p className="text-muted-foreground mb-3 text-xs">
                This version requires values that aren&rsquo;t yet set.
              </p>
              <PackageConfigForm
                manifest={{
                  name: packageName,
                  config: gatedEntries,
                }}
                state={configState}
                onChange={setConfigState}
                ctx={{
                  existingVarValues,
                  existingSecretKeys,
                  collisions,
                  ownerPackageName: packageName,
                }}
              />
            </div>
          )}

          {selectedVersion && !targetLoading && gatedEntries.length === 0 && (
            <p className="text-muted-foreground text-xs italic">No new required configuration.</p>
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <AsyncButton onClickAsync={handleUpgrade} disabled={isDisabled} pendingLabel="Upgrading…">
            Upgrade
          </AsyncButton>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
