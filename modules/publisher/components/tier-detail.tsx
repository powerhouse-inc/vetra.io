'use client'

import { useState } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { describePublisherError } from '../graphql'
import {
  useAddLicenseTypePackage,
  useAddLicenseTypeService,
  useRemoveLicenseTypePackage,
  useRemoveLicenseTypeService,
  useSetLicenseTypeDetails,
  useSetLicenseTypeTemplate,
} from '../hooks/use-publisher-mutations'
import { usePublisherAppArtifacts } from '../hooks/use-publisher'
import type { PublisherAppArtifact, PublisherLicenseType, PublisherTemplateService } from '../types'

// Mirrors TemplateServiceType in the app-license-type document model. Anything not in
// that enum is rejected by the reducer's input validation, which surfaces as a raw
// schema error rather than a sentence a publisher can act on — so it is never offered.
export const SERVICE_TYPES = [
  { value: 'CONNECT', label: 'CONNECT' },
  { value: 'SWITCHBOARD', label: 'SWITCHBOARD' },
  // The Knowledge Vault shape is FUSION + SWITCHBOARD; DOCLING and friends are
  // the extra services an app can ask for.
  { value: 'FUSION', label: 'FUSION — your app image' },
  { value: 'DOCLING', label: 'DOCLING' },
  { value: 'PAPERLESS', label: 'PAPERLESS' },
  { value: 'SPECKLE', label: 'SPECKLE' },
  // In the enum, so the licensing API accepts it, but the provisioner cannot build it yet.
  // Listed rather than hidden so a refusal that comes from elsewhere is explicable.
  { value: 'CLINT', label: 'CLINT — not provisionable yet' },
] as const

export const NOT_PROVISIONABLE = new Set(['CLINT'])

export const CHANNELS = [
  { value: 'LATEST', label: 'Latest release' },
  { value: 'STAGING', label: 'Staging builds' },
  { value: 'DEV', label: 'Dev builds' },
] as const

export type ChannelValue = (typeof CHANNELS)[number]['value']

export const NO_IMAGES_YET =
  'This app has not published a FUSION image yet. Run the Vetra deploy workflow once, then pick the image here.'

export const NO_PACKAGES_YET =
  'This app has not published a package yet. Run the Vetra deploy workflow once, then pick the package here.'

const CHANNEL_LABEL: Record<string, string> = Object.fromEntries(
  CHANNELS.map((c) => [c.value, c.label.toLowerCase()]),
)

/** One service as a phrase: "dtbau-psb at psb, following latest release". */
export function describeService(s: PublisherTemplateService): string {
  const where = s.prefix ? ` at ${s.prefix}` : ''
  if (!s.artifactName) return `${s.type}${where}`
  const follows = s.artifactChannel
    ? `, following ${CHANNEL_LABEL[s.artifactChannel] ?? s.artifactChannel}`
    : ''
  return `${s.artifactName}${where}${follows}`
}

/**
 * The whole tier as one sentence, so a publisher can check it without reading
 * the form back to themselves.
 */
export function describeTier(tier: PublisherLicenseType): string {
  if (tier.services.length === 0)
    return 'No services yet — a tier needs at least one to be published.'
  const services = tier.services.map(describeService).join(', ')
  const packages = tier.packages
    .map((p) =>
      p.packageName ? (p.version ? `${p.packageName}@${p.version}` : p.packageName) : null,
    )
    .filter((x): x is string => x !== null)
  const withPackages = packages.length > 0 ? `, with ${packages.join(' and ')} installed` : ''
  return `${services}${withPackages}.`
}

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
  const input: {
    licenseTypeId: string
    kind?: string
    label?: string | null
    validityDays?: number | null
  } = {
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
          <Input
            id="tier-days"
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>
      </div>
      <Button
        size="sm"
        disabled={!kind.trim() || !daysValid || labelCleared || unchanged || setDetails.isPending}
        onClick={save}
      >
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
          <Input
            id="tpl-domain"
            value={baseDomain}
            onChange={(e) => setBaseDomain(e.target.value)}
          />
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

function ServicesSection({
  appId,
  tier,
  artifacts,
  artifactsLoading,
}: {
  appId: string
  tier: PublisherLicenseType
  artifacts: PublisherAppArtifact[]
  artifactsLoading: boolean
}) {
  const addService = useAddLicenseTypeService(appId)
  const removeService = useRemoveLicenseTypeService(appId)
  const [type, setType] = useState('CONNECT')
  const [prefix, setPrefix] = useState('')
  const [artifactName, setArtifactName] = useState('')
  const [channel, setChannel] = useState<ChannelValue>('LATEST')

  const images = artifacts.filter((a) => a.kind === 'FUSION_IMAGE')
  // Only a FUSION service runs the app's own image; the server refuses the rest,
  // so the image row is only shown where it can be accepted.
  const wantsArtifact = type === 'FUSION'
  const noImages = wantsArtifact && !artifactsLoading && images.length === 0

  const submit = async () => {
    const ok = await run(
      () =>
        addService.mutateAsync({
          licenseTypeId: tier.id,
          type,
          prefix: prefix.trim() || null,
          artifactName: wantsArtifact && artifactName ? artifactName : null,
          artifactChannel: wantsArtifact && artifactName ? channel : null,
        }),
      'Service added',
    )
    if (ok) {
      setPrefix('')
      setArtifactName('')
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold">Services</h3>
      {tier.services.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No services yet. A tier needs at least one to be published.
        </p>
      ) : (
        <ul className="space-y-1 text-sm">
          {tier.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">
                {describeService(s)}
                {NOT_PROVISIONABLE.has(s.type) ? ' — not provisionable yet' : ''}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${s.type} service`}
                disabled={removeService.isPending}
                onClick={() =>
                  void run(
                    () => removeService.mutateAsync({ licenseTypeId: tier.id, id: s.id }),
                    'Service removed',
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
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

        {wantsArtifact && (
          <>
            <div className="space-y-1">
              <Label>Image</Label>
              <Select
                value={artifactName}
                onValueChange={(v) => {
                  setArtifactName(v)
                  // The image names the service, so it is the obvious prefix.
                  if (!prefix.trim()) setPrefix(v)
                }}
                disabled={images.length === 0}
              >
                <SelectTrigger className="w-56" aria-label="Image">
                  <SelectValue placeholder={artifactsLoading ? 'Loading…' : 'Pick an image'} />
                </SelectTrigger>
                <SelectContent>
                  {images.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name}
                      {a.versions.length > 0 ? ` (${a.versions.length} published)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Follows</Label>
              <Select
                value={channel}
                onValueChange={(v) => setChannel(v as ChannelValue)}
                disabled={!artifactName}
              >
                <SelectTrigger className="w-40" aria-label="Follows">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNELS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <div className="space-y-1">
          <Label htmlFor="svc-prefix">Prefix (optional)</Label>
          <Input id="svc-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        <Button
          size="sm"
          disabled={NOT_PROVISIONABLE.has(type) || noImages || addService.isPending}
          onClick={submit}
        >
          {addService.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add service
        </Button>
      </div>
      {noImages && <p className="text-muted-foreground text-xs">{NO_IMAGES_YET}</p>}
    </section>
  )
}

function PackagesSection({
  appId,
  tier,
  artifacts,
  artifactsLoading,
}: {
  appId: string
  tier: PublisherLicenseType
  artifacts: PublisherAppArtifact[]
  artifactsLoading: boolean
}) {
  const addPackage = useAddLicenseTypePackage(appId)
  const removePackage = useRemoveLicenseTypePackage(appId)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')

  const published = artifacts.filter((a) => a.kind === 'PACKAGE')
  const noPackages = !artifactsLoading && published.length === 0
  const versionsFor = published.find((a) => a.name === name)?.versions ?? []

  const submit = async () => {
    const ok = await run(
      () =>
        addPackage.mutateAsync({
          licenseTypeId: tier.id,
          packageName: name.trim(),
          version: version.trim() || null,
        }),
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
            <li key={p.id} className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs">
                {p.packageName ?? '—'}
                {p.version ? `@${p.version}` : ''}
              </span>
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove ${p.packageName ?? 'package'}`}
                disabled={removePackage.isPending}
                onClick={() =>
                  void run(
                    () => removePackage.mutateAsync({ licenseTypeId: tier.id, id: p.id }),
                    'Package removed',
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label>Package</Label>
          <Select
            value={name}
            onValueChange={(v) => {
              setName(v)
              setVersion('')
            }}
            disabled={published.length === 0}
          >
            <SelectTrigger className="w-64" aria-label="Package">
              <SelectValue placeholder={artifactsLoading ? 'Loading…' : 'Pick a package'} />
            </SelectTrigger>
            <SelectContent>
              {published.map((a) => (
                <SelectItem key={a.name} value={a.name}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Version</Label>
          <Select value={version} onValueChange={setVersion} disabled={!name}>
            <SelectTrigger className="w-48" aria-label="Version">
              <SelectValue placeholder="Latest" />
            </SelectTrigger>
            <SelectContent>
              {/* Newest first: the version a publisher wants is almost always the newest. */}
              {[...versionsFor].reverse().map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" disabled={!name.trim() || addPackage.isPending} onClick={submit}>
          {addPackage.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add package
        </Button>
      </div>
      {noPackages && <p className="text-muted-foreground text-xs">{NO_PACKAGES_YET}</p>}
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
  const artifacts = usePublisherAppArtifacts(tier ? appId : null)
  return (
    <Dialog open={!!tier} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {tier?.label ?? tier?.kind ?? 'tier'}</DialogTitle>
          <DialogDescription>
            Changes apply to the tier definition, not to existing licences.
          </DialogDescription>
        </DialogHeader>
        {tier && (
          <div className="space-y-6">
            <p className="bg-muted rounded-md px-3 py-2 text-sm" data-testid="tier-summary">
              {describeTier(tier)}
            </p>
            <DetailsSection appId={appId} tier={tier} />
            <TemplateSection key={tier.id} appId={appId} tier={tier} />
            <ServicesSection
              appId={appId}
              tier={tier}
              artifacts={artifacts.data ?? []}
              artifactsLoading={artifacts.isLoading}
            />
            <PackagesSection
              appId={appId}
              tier={tier}
              artifacts={artifacts.data ?? []}
              artifactsLoading={artifacts.isLoading}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
