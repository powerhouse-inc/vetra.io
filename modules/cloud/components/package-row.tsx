'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import {
  ArrowUpCircle,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Package as PackageIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { applyConfigChanges, type ConfigChange } from '@/modules/cloud/config/apply'
import { exclusiveKeys } from '@/modules/cloud/config/collisions'
import type { ConfigEntry, PackageManifest } from '@/modules/cloud/config/types'
import { ConfigRow } from '@/modules/cloud/components/config-row'
import { useAsyncAction } from '@/modules/cloud/hooks/use-async-action'
import { UpgradePackageModal } from '@/modules/cloud/components/upgrade-package-modal'
import {
  useRegistryManifest,
  useRegistryManifests,
} from '@/modules/cloud/hooks/use-registry-search'
import type { CloudPackage } from '@/modules/cloud/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/modules/shared/components/ui/alert-dialog'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Checkbox } from '@/modules/shared/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

export type PackageRowProps = {
  pkg: CloudPackage
  tenantId: string | null
  registryUrl: string | null
  installedPackages: CloudPackage[]
  /**
   * Manifest for this package. `null` either means "not loaded yet"
   * (look at `manifestLoading`) or "fetch finished and the registry
   * returned nothing" (look at `manifestMissing`).
   */
  manifest?: PackageManifest | null
  manifestMissing?: boolean
  manifestLoading?: boolean
  /**
   * Snapshot of the tenant's env-var values, keyed by name. Lifted to the
   * parent so all rows share one fetch.
   */
  existingVarValues?: Record<string, string>
  /** Set of secret keys currently stored on the tenant. */
  existingSecretKeys?: Set<string>
  onRemove: (name: string) => Promise<void>
  onSetVersion?: (name: string, version: string) => Promise<void>
  onSetVar?: (key: string, value: string) => Promise<void>
  onSetSecret?: (key: string, value: string) => Promise<void>
  onDeleteVar?: (key: string) => Promise<void>
  onDeleteSecret?: (key: string) => Promise<void>
}

const EMPTY_VAR_VALUES: Record<string, string> = {}
const EMPTY_SECRET_KEYS: Set<string> = new Set()

export function PackageRow({
  pkg,
  tenantId,
  registryUrl,
  installedPackages,
  manifest = null,
  manifestMissing = false,
  manifestLoading = false,
  existingVarValues = EMPTY_VAR_VALUES,
  existingSecretKeys = EMPTY_SECRET_KEYS,
  onRemove,
  onSetVersion,
  onSetVar,
  onSetSecret,
  onDeleteVar,
  onDeleteSecret,
}: PackageRowProps) {
  const [uninstallOpen, setUninstallOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const configEntries = manifest?.config ?? []
  // Only allow editing when the parent wired up the setters — otherwise the
  // expanded body still shows what's declared but the action buttons stay
  // disabled. Today PackagesSection always passes setters; this guard keeps
  // the component reusable.
  const canEditConfig = !!(onSetVar && onSetSecret && onDeleteVar && onDeleteSecret)

  return (
    <>
      <TableRow
        className="cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
      >
        <TableCell className="w-8">
          <ChevronRight
            className={cn(
              'text-muted-foreground h-4 w-4 transition-transform',
              expanded && 'rotate-90',
            )}
          />
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <PackageIcon className="text-muted-foreground h-4 w-4 shrink-0" />
            <span className="font-medium">{pkg.name}</span>
          </div>
        </TableCell>
        <TableCell>
          {pkg.version ? (
            <Badge variant="secondary" className="font-mono text-xs">
              {pkg.version}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm">&mdash;</span>
          )}
        </TableCell>
        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onSetVersion && (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault()
                    setUpgradeOpen(true)
                  }}
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  Change version...
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault()
                  setUninstallOpen(true)
                }}
              >
                Uninstall
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      {expanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={4} className="p-0">
            <div className="px-6 py-4">
              <PackageConfigBody
                entries={configEntries}
                manifestMissing={manifestMissing}
                manifestLoading={manifestLoading}
                canEdit={canEditConfig}
                existingVarValues={existingVarValues}
                existingSecretKeys={existingSecretKeys}
                onSetVar={onSetVar}
                onSetSecret={onSetSecret}
                onDeleteVar={onDeleteVar}
                onDeleteSecret={onDeleteSecret}
              />
            </div>
          </TableCell>
        </TableRow>
      )}

      {onSetVersion && (
        <UpgradePackageModal
          registryUrl={registryUrl}
          tenantId={tenantId}
          installedPackages={installedPackages}
          packageName={pkg.name}
          currentVersion={pkg.version ?? null}
          onUpgrade={onSetVersion}
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
        />
      )}

      <UninstallDialog
        open={uninstallOpen}
        onOpenChange={setUninstallOpen}
        pkg={pkg}
        tenantId={tenantId}
        registryUrl={registryUrl}
        installedPackages={installedPackages}
        onRemove={onRemove}
      />
    </>
  )
}

function PackageConfigBody({
  entries,
  manifestMissing,
  manifestLoading,
  canEdit,
  existingVarValues,
  existingSecretKeys,
  onSetVar,
  onSetSecret,
  onDeleteVar,
  onDeleteSecret,
}: {
  entries: ConfigEntry[]
  manifestMissing: boolean
  manifestLoading: boolean
  canEdit: boolean
  existingVarValues: Record<string, string>
  existingSecretKeys: Set<string>
  onSetVar?: (key: string, value: string) => Promise<void>
  onSetSecret?: (key: string, value: string) => Promise<void>
  onDeleteVar?: (key: string) => Promise<void>
  onDeleteSecret?: (key: string) => Promise<void>
}) {
  if (manifestLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading manifest…
      </div>
    )
  }
  if (manifestMissing) {
    return (
      <p className="text-muted-foreground text-sm italic">
        Could not load this package&rsquo;s manifest.
      </p>
    )
  }
  if (entries.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        This package declares no configuration.
      </p>
    )
  }
  return (
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
        {entries.map((entry) => {
          const isVar = entry.type === 'var'
          const currentValue = isVar ? (existingVarValues[entry.name] ?? null) : null
          const isSet = isVar ? entry.name in existingVarValues : existingSecretKeys.has(entry.name)
          return (
            <ConfigRow
              key={entry.name}
              entry={entry}
              currentValue={currentValue}
              isSet={isSet}
              onSave={async (value) => {
                if (!canEdit) return
                if (isVar) await onSetVar!(entry.name, value)
                else await onSetSecret!(entry.name, value)
              }}
              onDelete={async () => {
                if (!canEdit) return
                if (isVar) await onDeleteVar!(entry.name)
                else await onDeleteSecret!(entry.name)
              }}
            />
          )
        })}
      </TableBody>
    </Table>
  )
}

function UninstallDialog({
  open,
  onOpenChange,
  pkg,
  tenantId,
  registryUrl,
  installedPackages,
  onRemove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  pkg: CloudPackage
  tenantId: string | null
  registryUrl: string | null
  installedPackages: CloudPackage[]
  onRemove: (name: string) => Promise<void>
}) {
  const renown = useRenown()
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({})

  // Manifest for the package being uninstalled.
  const { manifest: pkgManifest } = useRegistryManifest(
    registryUrl,
    open ? pkg.name : null,
    pkg.version ?? null,
  )

  // All installed manifests (including this one) for collision analysis.
  // Gated on `open` — each PackageRow always mounts this dialog, so fetching
  // unconditionally would hit the registry N² times per env page load.
  const packageSpecs = useMemo(
    () => (open ? installedPackages.map((p) => ({ name: p.name, version: p.version })) : []),
    [open, installedPackages],
  )
  const { manifests } = useRegistryManifests(registryUrl, packageSpecs)

  const declaredEntries: ConfigEntry[] = pkgManifest?.config ?? []
  const exclusive = useMemo(
    () => new Set(exclusiveKeys(pkg.name, manifests)),
    [pkg.name, manifests],
  )

  // Pre-check exclusive keys whenever the declared list changes. This is a
  // side effect (setState), so it belongs in useEffect — running it in a
  // useMemo updates state during render and risks a render loop.
  useEffect(() => {
    const initial: Record<string, boolean> = {}
    for (const e of declaredEntries) initial[e.name] = exclusive.has(e.name)
    setSelectedKeys(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [declaredEntries.map((e) => e.name).join(','), exclusive.size])

  const { run: runRemove, isPending: isRemoving } = useAsyncAction(async () => {
    if (tenantId) {
      const changes: ConfigChange[] = []
      for (const entry of declaredEntries) {
        if (!selectedKeys[entry.name]) continue
        changes.push(
          entry.type === 'var'
            ? { kind: 'deleteVar', name: entry.name }
            : { kind: 'deleteSecret', name: entry.name },
        )
      }
      if (changes.length > 0) {
        await applyConfigChanges(tenantId, changes, renown)
      }
    }
    await onRemove(pkg.name)
    toast.success(`Uninstalled ${pkg.name}`)
    onOpenChange(false)
  })

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Uninstall {pkg.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The package will be removed from this environment.
            {declaredEntries.length > 0 && ' You can also delete its configuration keys:'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {declaredEntries.length > 0 && (
          <div className="space-y-2 py-2">
            {declaredEntries.map((entry) => {
              const isExclusive = exclusive.has(entry.name)
              return (
                <label
                  key={entry.name}
                  className="flex items-center gap-2 text-sm"
                  htmlFor={`uninstall-${entry.name}`}
                >
                  <Checkbox
                    id={`uninstall-${entry.name}`}
                    checked={selectedKeys[entry.name] ?? false}
                    onCheckedChange={(checked) =>
                      setSelectedKeys((prev) => ({
                        ...prev,
                        [entry.name]: checked === true,
                      }))
                    }
                  />
                  <span className="font-mono text-xs">{entry.name}</span>
                  <Badge size="xs" variant="outline">
                    {entry.type}
                  </Badge>
                  <span className="text-muted-foreground text-[10px]">
                    {isExclusive ? 'exclusive to this package' : 'also used by other packages'}
                  </span>
                </label>
              )
            })}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isRemoving}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            // Stop Radix from auto-closing on click — close only after the
            // mutation resolves, so a server-side error leaves the user on
            // the confirm screen with the keys still selected.
            onClick={(e) => {
              e.preventDefault()
              void runRemove().catch((err) => {
                console.error('Failed to uninstall:', err)
                toast.error(err instanceof Error ? err.message : 'Failed to uninstall')
              })
            }}
            disabled={isRemoving}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isRemoving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isRemoving ? 'Uninstalling…' : 'Uninstall'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
