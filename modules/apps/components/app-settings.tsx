'use client'

import { Fingerprint, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

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
import { Button } from '@/modules/shared/components/ui/button'
import { Checkbox } from '@/modules/shared/components/ui/checkbox'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { Switch } from '@/modules/shared/components/ui/switch'

import { describeAppsError } from '../graphql'
import { useDeleteApp, useUpdateApp } from '../hooks/use-apps'
import { appStatusMeta } from '../lib/status'
import type { App, UpdateAppInput } from '../types'
import { CopyButton } from './copy-button'
import { SetupDeploys } from './setup-deploys'
import { StatusPill } from './status'

// Mirror the vetra-apps subgraph's updateApp validation.
export const PREVIEW_LIMIT_RANGE = { min: 1, max: 20 } as const
export const PREVIEW_TTL_RANGE = { min: 1, max: 90 } as const
export const APP_NAME_MAX = 100

type FormState = {
  name: string
  productionBranch: string
  previewsEnabled: boolean
  previewLimit: string
  previewTtlDays: string
}

function toForm(app: App): FormState {
  return {
    name: app.name,
    productionBranch: app.productionBranch,
    previewsEnabled: app.previewsEnabled,
    previewLimit: String(app.previewLimit),
    previewTtlDays: String(app.previewTtlDays),
  }
}

function intInRange(value: string, range: { min: number; max: number }): number | null {
  if (!/^\d+$/.test(value.trim())) return null
  const n = Number(value)
  return n >= range.min && n <= range.max ? n : null
}

/**
 * Only the fields that changed, or `null` when the form is invalid.
 * Exported for tests.
 */
export function diffSettings(app: App, form: FormState): UpdateAppInput | null {
  const limit = intInRange(form.previewLimit, PREVIEW_LIMIT_RANGE)
  const ttl = intInRange(form.previewTtlDays, PREVIEW_TTL_RANGE)
  const name = form.name.trim()
  if (
    !name ||
    name.length > APP_NAME_MAX ||
    !form.productionBranch.trim() ||
    limit === null ||
    ttl === null
  ) {
    return null
  }
  const patch: UpdateAppInput = {}
  if (form.name.trim() !== app.name) patch.name = form.name.trim()
  if (form.productionBranch.trim() !== app.productionBranch)
    patch.productionBranch = form.productionBranch.trim()
  if (form.previewsEnabled !== app.previewsEnabled) patch.previewsEnabled = form.previewsEnabled
  if (limit !== app.previewLimit) patch.previewLimit = limit
  if (ttl !== app.previewTtlDays) patch.previewTtlDays = ttl
  return patch
}

function SettingsCard({
  title,
  description,
  children,
  footer,
  danger,
}: {
  title: string
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  danger?: boolean
}) {
  return (
    <section
      className={
        danger
          ? 'border-destructive/40 bg-card overflow-hidden rounded-2xl border shadow-sm'
          : 'bg-card border-border overflow-hidden rounded-2xl border shadow-sm'
      }
    >
      <div className="space-y-5 p-6">
        <div className="space-y-1">
          <h3 className="font-semibold">{title}</h3>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
        {children}
      </div>
      {footer && (
        <div
          className={
            danger
              ? 'bg-destructive/5 border-border flex items-center justify-end gap-3 border-t px-6 py-3'
              : 'bg-muted/40 border-border flex items-center justify-end gap-3 border-t px-6 py-3'
          }
        >
          {footer}
        </div>
      )}
    </section>
  )
}

function GeneralAndPreviews({ app }: { app: App }) {
  // Re-seed the form when the server copy changes (keyed by updatedAt below).
  const [form, setForm] = useState<FormState>(() => toForm(app))
  const update = useUpdateApp(app.id)
  const patch = diffSettings(app, form)
  const dirty = !!patch && Object.keys(patch).length > 0
  const set = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }))

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    if (!patch || !dirty) return
    update.mutate(patch, {
      onSuccess: () => toast.success('Settings saved'),
      onError: (err) => toast.error(describeAppsError(err)),
    })
  }

  return (
    <form onSubmit={save} className="space-y-6" noValidate>
      <SettingsCard
        title="General"
        description="What this app is called, what deploys production, and how pull requests get previews."
        footer={
          <>
            {!patch && (
              <span className="text-destructive mr-auto text-xs">
                Check the highlighted fields.
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              disabled={!dirty || update.isPending}
              onClick={() => setForm(toForm(app))}
            >
              Reset
            </Button>
            <Button type="submit" disabled={!dirty || update.isPending}>
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </>
        }
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-name">Name</Label>
            <Input
              id="settings-name"
              value={form.name}
              maxLength={APP_NAME_MAX}
              onChange={(e) => set({ name: e.target.value })}
              aria-invalid={!form.name.trim()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-branch">Production branch</Label>
            <Input
              id="settings-branch"
              value={form.productionBranch}
              className="font-mono"
              onChange={(e) => set({ productionBranch: e.target.value })}
              aria-invalid={!form.productionBranch.trim()}
            />
            <p className="text-muted-foreground text-xs">
              Update the workflow&apos;s push trigger too (snippet below).
            </p>
          </div>
        </div>
        <div className="border-border space-y-1 border-t pt-5">
          <h4 className="text-sm font-semibold">Preview environments</h4>
          <p className="text-muted-foreground text-sm">
            One slim environment per pull request, without secrets, deleted when the PR closes.
          </p>
        </div>
        <div className="border-border flex items-center justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-0.5">
            <Label htmlFor="settings-previews">Deploy pull requests</Label>
            <p className="text-muted-foreground text-xs">Fork pull requests never get previews.</p>
          </div>
          <Switch
            id="settings-previews"
            checked={form.previewsEnabled}
            onCheckedChange={(checked) => set({ previewsEnabled: checked })}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="settings-limit">Max previews</Label>
            <Input
              id="settings-limit"
              type="number"
              inputMode="numeric"
              min={PREVIEW_LIMIT_RANGE.min}
              max={PREVIEW_LIMIT_RANGE.max}
              value={form.previewLimit}
              disabled={!form.previewsEnabled}
              onChange={(e) => set({ previewLimit: e.target.value })}
              aria-invalid={intInRange(form.previewLimit, PREVIEW_LIMIT_RANGE) === null}
            />
            <p className="text-muted-foreground text-xs">
              At the limit, the least recently deployed preview makes room.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-ttl">Delete idle previews after (days)</Label>
            <Input
              id="settings-ttl"
              type="number"
              inputMode="numeric"
              min={PREVIEW_TTL_RANGE.min}
              max={PREVIEW_TTL_RANGE.max}
              value={form.previewTtlDays}
              disabled={!form.previewsEnabled}
              onChange={(e) => set({ previewTtlDays: e.target.value })}
              aria-invalid={intInRange(form.previewTtlDays, PREVIEW_TTL_RANGE) === null}
            />
          </div>
        </div>
      </SettingsCard>
    </form>
  )
}

function IdentityCard({ app, onAuthorize }: { app: App; onAuthorize: () => void }) {
  return (
    <SettingsCard
      title="Deploy identity"
      description="The Renown identity GitHub Actions use to publish and deploy this app."
      footer={
        app.status === 'PENDING_IDENTITY' ? (
          <Button onClick={onAuthorize}>
            <Fingerprint className="h-4 w-4" />
            Authorize on Renown
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <StatusPill meta={appStatusMeta(app.status)} />
        <div className="bg-muted/60 flex min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pr-1 pl-3">
          <code className="min-w-0 flex-1 truncate font-mono text-xs">{app.identityDid}</code>
          <CopyButton value={app.identityDid} label="Copy identity" />
        </div>
      </div>
      <dl className="text-muted-foreground grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt>App id</dt>
        <dd className="text-foreground truncate font-mono">{app.id}</dd>
        <dt>Image project</dt>
        <dd className="text-foreground truncate font-mono">cr.vetra.io/{app.harborProject}</dd>
      </dl>
    </SettingsCard>
  )
}

function DangerZone({ app }: { app: App }) {
  const router = useRouter()
  const del = useDeleteApp()
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleteEnvironments, setDeleteEnvironments] = useState(false)
  const confirmed = confirmText.trim() === app.name

  const onDelete = () => {
    del.mutate(
      { appId: app.id, deleteEnvironments },
      {
        onSuccess: () => {
          toast.success(`${app.name} deleted`)
          setOpen(false)
          router.push('/user')
        },
        onError: (err) => toast.error(describeAppsError(err)),
      },
    )
  }

  return (
    <SettingsCard
      danger
      title="Delete app"
      description="Stops deploys from GitHub and removes the app from your account."
      footer={
        <Button variant="destructive" onClick={() => setOpen(true)}>
          <Trash2 className="h-4 w-4" />
          Delete app
        </Button>
      }
    >
      <p className="text-muted-foreground text-sm">
        Its images in the Vetra registry are kept. The repository and its workflow file are not
        touched; remove <code className="font-mono text-xs">.github/workflows/vetra.yml</code>{' '}
        yourself if you no longer need it.
      </p>
      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o)
          if (!o) {
            setConfirmText('')
            setDeleteEnvironments(false)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {app.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Type{' '}
              <span className="text-foreground font-semibold">{app.name}</span> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            aria-label="App name"
            autoComplete="off"
          />
          <label className="border-border flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm">
            <Checkbox
              checked={deleteEnvironments}
              onCheckedChange={(v) => setDeleteEnvironments(v === true)}
              className="mt-0.5"
            />
            <span className="space-y-0.5">
              <span className="block font-medium">Also delete its environments</span>
              <span className="text-muted-foreground block text-xs">
                Unchecked, production keeps running as a standalone environment with its data, but
                CI deploys stop. Registry images are kept either way.
              </span>
            </span>
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={del.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                onDelete()
              }}
              disabled={!confirmed || del.isPending}
              className="bg-destructive hover:bg-destructive/90 text-white"
            >
              {del.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Delete app
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsCard>
  )
}

/** Settings tab: general + previews form, workflow, identity, danger zone. */
export function AppSettings({ app, onAuthorize }: { app: App; onAuthorize: () => void }) {
  return (
    <div className="space-y-6">
      <GeneralAndPreviews key={app.updatedAt} app={app} />
      <SettingsCard
        title="Deploy workflow"
        description="The GitHub Actions workflow that builds, publishes and deploys on every push."
      >
        <SetupDeploys app={app} disabled={app.status === 'DISCONNECTED'} />
      </SettingsCard>
      <IdentityCard app={app} onAuthorize={onAuthorize} />
      <DangerZone app={app} />
    </div>
  )
}
