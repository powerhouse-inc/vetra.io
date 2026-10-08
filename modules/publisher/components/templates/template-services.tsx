'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import { useAddTemplateService, useRemoveTemplateService } from '../../hooks/use-publisher-mutations'
import { CHANNELS, NO_IMAGES_YET, type ChannelValue } from '../../lib/artifacts'
import { runWithToast } from '../../lib/run'
import { describeService, NOT_PROVISIONABLE, SERVICE_TYPES } from '../../lib/template'
import type { PublisherAppArtifact, PublisherTemplate } from '../../types'
import { SectionCard } from '../primitives'

type Guard = (title: string, run: () => Promise<unknown>) => void

export function TemplateServices({
  appId,
  template,
  guard,
  artifacts,
  artifactsLoading,
}: {
  appId: string
  template: PublisherTemplate
  guard: Guard
  artifacts: PublisherAppArtifact[]
  artifactsLoading: boolean
}) {
  const add = useAddTemplateService(appId)
  const remove = useRemoveTemplateService(appId)
  const [type, setType] = useState('CONNECT')
  const [prefix, setPrefix] = useState('')
  const [artifactName, setArtifactName] = useState('')
  const [channel, setChannel] = useState<ChannelValue>('LATEST')

  const images = artifacts.filter((a) => a.kind === 'FUSION_IMAGE')
  // Only an app-image service runs the app's own image; the server refuses an artifact on the rest.
  const wantsImage = type === 'FUSION'
  const noImages = wantsImage && !artifactsLoading && images.length === 0

  const submit = () =>
    guard('Add this service?', async () => {
      const ok = await runWithToast(
        () =>
          add.mutateAsync({
            templateId: template.id,
            type,
            prefix: prefix.trim() || null,
            artifactName: wantsImage && artifactName ? artifactName : null,
            artifactChannel: wantsImage && artifactName ? channel : null,
          }),
        'Service added',
      )
      if (ok) {
        setPrefix('')
        setArtifactName('')
      }
    })

  return (
    <SectionCard title="Services" description="What runs in every owner’s environment.">
      {template.services.length === 0 ? (
        <p className="text-muted-foreground text-sm">No services yet. Add at least one before a plan can use this template.</p>
      ) : (
        <ul className="divide-border divide-y text-sm">
          {template.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate font-mono text-xs">
                {describeService(s)}
                {NOT_PROVISIONABLE.has(s.type) ? ' — not available yet' : ''}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${s.type} service`}
                disabled={remove.isPending}
                onClick={() =>
                  guard('Remove this service?', () =>
                    runWithToast(() => remove.mutateAsync({ templateId: template.id, id: s.id }), 'Service removed'),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="svc-type">Service type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger id="svc-type" aria-label="Service type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value} disabled={NOT_PROVISIONABLE.has(t.value)}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="svc-prefix">Subdomain prefix (optional)</Label>
          <Input id="svc-prefix" value={prefix} onChange={(e) => setPrefix(e.target.value)} />
        </div>
        {wantsImage && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="svc-image">Image</Label>
              <Select
                value={artifactName}
                onValueChange={(v) => {
                  setArtifactName(v)
                  if (!prefix.trim()) setPrefix(v)
                }}
                disabled={images.length === 0}
              >
                <SelectTrigger id="svc-image" aria-label="Image" className="w-full">
                  <SelectValue placeholder={artifactsLoading ? 'Loading…' : 'Pick an image'} />
                </SelectTrigger>
                <SelectContent>
                  {images.map((a) => (
                    <SelectItem key={a.name} value={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="svc-follows">Follows</Label>
              <Select value={channel} onValueChange={(v) => setChannel(v as ChannelValue)} disabled={!artifactName}>
                <SelectTrigger id="svc-follows" aria-label="Follows" className="w-full">
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
      </div>
      {noImages && <p className="text-muted-foreground text-xs">{NO_IMAGES_YET}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={NOT_PROVISIONABLE.has(type) || noImages || add.isPending}>
          {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add service
        </Button>
      </div>
    </SectionCard>
  )
}
