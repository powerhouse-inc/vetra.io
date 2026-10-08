'use client'

import { ChevronDown, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
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
import { useSetTemplateDetails } from '../../hooks/use-publisher-mutations'
import { runWithToast } from '../../lib/run'
import {
  isTemplateFormDirty,
  SIZES,
  sharedModeBlocker,
  templateDetailsInput,
  templateToForm,
  type TemplateForm,
} from '../../lib/template'
import type { PublisherTemplate } from '../../types'
import { ModeChoice } from './mode-choice'

// Radix Select items cannot have value ''. These sentinels stand for "none".
const APP_ENVIRONMENT = '__app_environment__'
const DEFAULT_SIZE = '__default_size__'

type Guard = (title: string, run: () => Promise<unknown>) => void

export function TemplateDetailsForm({
  appId,
  template,
  guard,
}: {
  appId: string
  template: PublisherTemplate
  guard: Guard
}) {
  const setDetails = useSetTemplateDetails(appId)
  const { viewer } = useViewer()
  const { environments } = useEnvironments('MINE', viewer?.address ?? null)
  // The editor remounts this form (key) whenever the server's values change, so
  // initial state is enough — no syncing effect.
  const [form, setForm] = useState<TemplateForm>(() => templateToForm(template))
  const [advanced, setAdvanced] = useState(!!(template.baseDomain || template.packageRegistry))

  const set = <K extends keyof TemplateForm>(key: K, value: TemplateForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const dirty = isTemplateFormDirty(template, form)

  const save = () =>
    guard('Save template changes?', () =>
      runWithToast(() => setDetails.mutateAsync(templateDetailsInput(template.id, form)), 'Template saved'),
    )

  return (
    <section className="space-y-5" aria-label="Template details">
      <div className="space-y-1.5">
        <Label htmlFor="template-name">Name</Label>
        <Input id="template-name" maxLength={60} value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>

      <ModeChoice
        value={form.mode}
        onChange={(mode) => set('mode', mode)}
        sharedDisabledReason={sharedModeBlocker(template)}
      />

      {form.mode === 'SHARED' ? (
        <div className="space-y-1.5">
          <Label htmlFor="template-shared-env">Shared environment</Label>
          <Select
            value={form.sharedEnvironment || APP_ENVIRONMENT}
            onValueChange={(v) => set('sharedEnvironment', v === APP_ENVIRONMENT ? '' : v)}
          >
            <SelectTrigger id="template-shared-env" aria-label="Shared environment" className="w-full sm:w-80">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={APP_ENVIRONMENT}>App Environment (production)</SelectItem>
              {form.sharedEnvironment && !environments.some((e) => e.id === form.sharedEnvironment) && (
                <SelectItem value={form.sharedEnvironment}>Saved environment</SelectItem>
              )}
              {environments.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.state.label || e.name || e.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Owners get an account here. Ending a licence never touches this environment.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="template-size">Size</Label>
            <Select
              value={form.size || DEFAULT_SIZE}
              onValueChange={(v) => set('size', v === DEFAULT_SIZE ? '' : v)}
            >
              <SelectTrigger id="template-size" aria-label="Size" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_SIZE}>Default</SelectItem>
                {SIZES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
            onClick={() => setAdvanced((x) => !x)}
            aria-expanded={advanced}
          >
            <ChevronDown className={advanced ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} />
            Advanced
          </button>
          {advanced && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="template-domain">Base domain</Label>
                <Input
                  id="template-domain"
                  placeholder="vetra.io"
                  value={form.baseDomain}
                  onChange={(e) => set('baseDomain', e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="template-registry">Package registry</Label>
                <Input
                  id="template-registry"
                  placeholder="https://registry.vetra.io"
                  value={form.packageRegistry}
                  onChange={(e) => set('packageRegistry', e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={!dirty || setDetails.isPending}>
          {setDetails.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </section>
  )
}
