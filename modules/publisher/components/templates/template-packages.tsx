'use client'

import { Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { Label } from '@/modules/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import {
  useAddTemplatePackage,
  useRemoveTemplatePackage,
} from '../../hooks/use-publisher-mutations'
import { NO_PACKAGES_YET } from '../../lib/artifacts'
import { runWithToast } from '../../lib/run'
import type { PublisherAppArtifact, PublisherTemplate } from '../../types'
import { SectionCard } from '../primitives'
import { ArtifactsFailed } from './artifacts-failed'

// Radix Select items cannot have value ''. This stands for "no pinned version".
const LATEST = '__latest__'

type Guard = (title: string, run: () => Promise<unknown>) => void

export function TemplatePackages({
  appId,
  template,
  guard,
  artifacts,
  artifactsLoading,
  artifactsFailed = false,
  artifactsRetrying = false,
  onRetryArtifacts,
}: {
  appId: string
  template: PublisherTemplate
  guard: Guard
  artifacts: PublisherAppArtifact[]
  artifactsLoading: boolean
  artifactsFailed?: boolean
  artifactsRetrying?: boolean
  onRetryArtifacts?: () => void
}) {
  const add = useAddTemplatePackage(appId)
  const remove = useRemoveTemplatePackage(appId)
  const [name, setName] = useState('')
  const [version, setVersion] = useState('')

  const published = artifacts.filter((a) => a.kind === 'PACKAGE')
  const noPackages = !artifactsLoading && !artifactsFailed && published.length === 0
  // Newest first: the version a publisher wants is almost always the newest.
  const versions = [...(published.find((a) => a.name === name)?.versions ?? [])].reverse()

  const submit = () =>
    guard('Add this package?', async () => {
      const ok = await runWithToast(
        () =>
          add.mutateAsync({
            templateId: template.id,
            packageName: name,
            version: version && version !== LATEST ? version : null,
          }),
        'Package added',
      )
      if (ok) {
        setName('')
        setVersion('')
      }
    })

  return (
    <SectionCard title="Packages" description="Installed in every owner’s environment.">
      {template.packages.length === 0 ? (
        <p className="text-muted-foreground text-sm">No packages yet.</p>
      ) : (
        <ul className="divide-border divide-y">
          {template.packages.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-2">
              <span className="min-w-0 truncate font-mono text-xs">
                {p.packageName ?? '—'}
                {p.version ? `@${p.version}` : ' (latest)'}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Remove ${p.packageName ?? 'package'}`}
                disabled={remove.isPending}
                onClick={() =>
                  guard('Remove this package?', () =>
                    runWithToast(
                      () => remove.mutateAsync({ templateId: template.id, id: p.id }),
                      'Package removed',
                    ),
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
          <Label htmlFor="pkg-name">Package</Label>
          <Select
            value={name}
            onValueChange={(v) => {
              setName(v)
              setVersion('')
            }}
            disabled={published.length === 0}
          >
            <SelectTrigger id="pkg-name" aria-label="Package" className="w-full">
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
        <div className="space-y-1.5">
          <Label htmlFor="pkg-version">Version</Label>
          <Select value={version || LATEST} onValueChange={setVersion} disabled={!name}>
            <SelectTrigger id="pkg-version" aria-label="Version" className="w-full">
              <SelectValue placeholder="Always the latest" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={LATEST}>Always the latest</SelectItem>
              {versions.map((v) => (
                <SelectItem key={v.version} value={v.version}>
                  {v.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {artifactsFailed && <ArtifactsFailed what="packages" onRetry={onRetryArtifacts} retrying={artifactsRetrying} />}
      {noPackages && <p className="text-muted-foreground text-xs">{NO_PACKAGES_YET}</p>}
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!name || add.isPending}>
          {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Add package
        </Button>
      </div>
    </SectionCard>
  )
}
