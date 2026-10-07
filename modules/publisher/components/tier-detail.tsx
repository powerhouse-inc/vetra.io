'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { describePublisherError } from '../graphql'
import {
  useAddLicenseTypePackage,
  useAddLicenseTypeService,
  useSetLicenseTypeDetails,
  useSetLicenseTypeTemplate,
} from '../hooks/use-publisher-mutations'
import type { PublisherLicenseType } from '../types'

export const SERVICE_TYPES = [
  { value: 'CONNECT', label: 'CONNECT' },
  { value: 'SWITCHBOARD', label: 'SWITCHBOARD' },
  { value: 'FUSION', label: 'FUSION' },
  // Selectable in the document model but refused by the subgraph. Listed, not hidden,
  // so a refusal that comes from elsewhere is explicable.
  { value: 'CLINT', label: 'CLINT — not provisionable yet' },
] as const

export const NOT_PROVISIONABLE = new Set(['CLINT'])

export const APPEND_ONLY_WARNING =
  'Services and packages cannot be removed once added. To undo a mistake, retire this tier and create a replacement.'

/** Runs a mutation; failures show the server's sentence verbatim. */
async function run(fn: () => Promise<unknown>, ok: string): Promise<boolean> {
  try {
    await fn()
    toast.success(ok)
    return true
  } catch (err) {
    toast.error(describePublisherError(err))
    return false
  }
}

function DetailsSection({ appId, tier }: { appId: string; tier: PublisherLicenseType }) {
  const setDetails = useSetLicenseTypeDetails(appId)
  const [kind, setKind] = useState(tier.kind ?? '')
  const [label, setLabel] = useState(tier.label ?? '')
  const [days, setDays] = useState(tier.validityDays == null ? '' : String(tier.validityDays))
  const daysValid = days.trim() === '' || (/^\d+$/.test(days.trim()) && Number(days) > 0)

  // The server ignores an empty label (the reducer only assigns a truthy one), so
  // clearing it would report success while changing nothing. Block the attempt.
  const labelCleared = label.trim() === '' && (tier.label ?? '') !== ''

  // Omit unchanged keys: the server tells "leave alone" from "clear" by key presence.
  // This is safe ONLY because the backend's `setLicenseTypeDetails` resolver
  // (subgraphs/vetra-licensing/publisher-resolvers.ts in vetra-cloud-package) carries the
  // tier's current validityDays when that key is absent. The reducer always assigns it,
  // so if that resolver ever passes its input straight through, omitting validityDays
  // here would silently wipe the validity period. No test in this repo would notice.
  const input: { licenseTypeId: string; kind?: string; label?: string | null; validityDays?: number | null } = {
    licenseTypeId: tier.id,
  }
  if (kind.trim() !== (tier.kind ?? '')) input.kind = kind.trim()
  if (label.trim() !== (tier.label ?? '')) input.label = label.trim() || null
  if (days.trim() !== (tier.validityDays == null ? '' : String(tier.validityDays)))
    input.validityDays = days.trim() ? Number(days) : null
  const unchanged = Object.keys(input).length === 1

  const save = () => run(() => setDetails.mutateAsync(input), 'Tier details saved')

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Details</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="tier-kind">Kind</Label>
          <Input id="tier-kind" value={kind} onChange={(e) => setKind(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tier-label">Label</Label>
          <Input id="tier-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          <p className="text-muted-foreground text-xs">A label can be replaced but not cleared.</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="tier-days">Validity (days)</Label>
          <Input id="tier-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} />
        </div>
      </div>
      <Button size="sm" disabled={!kind.trim() || !daysValid || labelCleared || unchanged || setDetails.isPending}
        onClick={save}>
        {setDetails.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save details
      </Button>
    </section>
  )
}

function TemplateSection({ appId, tier }: { appId: string; tier: PublisherLicenseType }) {
  const setTemplate = useSetLicenseTypeTemplate(appId)
  const [size, setSize] = useState(tier.size ?? '')
  const [baseDomain, setBaseDomain] = useState(tier.baseDomain ?? '')
  const [registry, setRegistry] = useState(tier.packageRegistry ?? '')

  // SET_TEMPLATE is a full replace on the server: any field left out is cleared.
  // So all three are always sent, an empty input becoming an explicit null.
  const save = async () => {
    await run(
      () =>
        setTemplate.mutateAsync({
          licenseTypeId: tier.id,
          size: size.trim() || null,
          baseDomain: baseDomain.trim() || null,
          packageRegistry: registry.trim() || null,
        }),
      'Template saved',
    )
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Environment template</h3>
      <p className="text-muted-foreground text-xs">
        Saving replaces all three fields with what is shown here; an empty field is cleared.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="tpl-size">Size</Label>
          <Input id="tpl-size" value={size} onChange={(e) => setSize(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tpl-domain">Base domain</Label>
          <Input id="tpl-domain" value={baseDomain} onChange={(e) => setBaseDomain(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="tpl-registry">Package registry</Label>
          <Input id="tpl-registry" value={registry} onChange={(e) => setRegistry(e.target.value)} />
        </div>
      </div>
      <Button size="sm" variant="outline" disabled={setTemplate.isPending} onClick={save}>
        {setTemplate.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save template
      </Button>
    </section>
  )
}

function ServicesSection({ appId, tier }: { appId: string; tier: PublisherLicenseType }) {
  const addService = useAddLicenseTypeService(appId)
  const [type, setType] = useState('CONNECT')
  const [prefix, setPrefix] = useState('')

  const submit = async () => {
    const ok = await run(
      () => addService.mutateAsync({ licenseTypeId: tier.id, type, prefix: prefix.trim() || null }),
      'Service added',
    )
    if (ok) setPrefix('')
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Services</h3>
      {tier.services.length === 0 ? (
        <p className="text-muted-foreground text-sm">No services yet. A tier needs at least one to be published.</p>
      ) : (
        <ul className="space-y-1 text-sm">
          {tier.services.map((s) => (
            <li key={s.id} className="font-mono text-xs">
              {s.type}
              {s.prefix ? ` (${s.prefix})` : ''}
              {NOT_PROVISIONABLE.has(s.type) ? ' — not provisionable yet' : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">{APPEND_ONLY_WARNING}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Service type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-64" aria-label="Service type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="svc-prefix">Prefix (optional)</Label>
          <Input id="svc-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <Button size="sm" disabled={NOT_PROVISIONABLE.has(type) || addService.isPending} onClick={submit}>
          {addService.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add service
        </Button>
      </div>
    </section>
  )
}

function PackagesSection({ appId, tier }: { appId: string; tier: PublisherLicenseType }) {
  const addPackage = useAddLicenseTypePackage(appId)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')

  const submit = async () => {
    const ok = await run(
      () => addPackage.mutateAsync({ licenseTypeId: tier.id, packageName: name.trim(), version: version.trim() || null }),
      'Package added',
    )
    if (ok) {
      setName('')
      setVersion('')
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Packages</h3>
      {tier.packages.length === 0 ? (
        <p className="text-muted-foreground text-sm">No packages yet.</p>
      ) : (
        <ul className="space-y-1">
          {tier.packages.map((p) => (
            <li key={p.id} className="font-mono text-xs">
              {p.packageName ?? '—'}
              {p.version ? `@${p.version}` : ''}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground text-xs">{APPEND_ONLY_WARNING}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label htmlFor="pkg-name">Package name</Label>
          <Input id="pkg-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="pkg-version">Version (optional)</Label>
          <Input id="pkg-version" value={version} onChange={(e) => setVersion(e.target.value)} />
        </div>
        <Button size="sm" disabled={!name.trim() || addPackage.isPending} onClick={submit}>
          {addPackage.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add package
        </Button>
      </div>
    </section>
  )
}

export function TierDetail({
  appId,
  tier,
  onClose,
}: {
  appId: string
  tier: PublisherLicenseType | null
  onClose: () => void
}) {
  return (
    <Dialog open={!!tier} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {tier?.label ?? tier?.kind ?? 'tier'}</DialogTitle>
          <DialogDescription>Changes apply to the tier definition, not to existing licences.</DialogDescription>
        </DialogHeader>
        {tier && (
          <div className="space-y-6">
            <DetailsSection appId={appId} tier={tier} />
            <TemplateSection key={tier.id} appId={appId} tier={tier} />
            <ServicesSection appId={appId} tier={tier} />
            <PackagesSection appId={appId} tier={tier} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
