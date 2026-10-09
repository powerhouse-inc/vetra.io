'use client'

import {
  ArrowUpRight,
  Fingerprint,
  Loader2,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'

import { TabHeader, TabSkeleton } from '@/modules/publisher/components/primitives'
import { describePublisherError, isPublisherError } from '@/modules/publisher/graphql'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Textarea } from '@/modules/shared/components/ui/textarea'

import { useAppProfile, useRenownBearer, useUpdateAppProfile } from '../../hooks/use-app-profile'
import type { RenownAppProfile } from '../../lib/app-profile/api'
import {
  CATEGORY_SUGGESTIONS,
  changedFields,
  fieldForServer,
  formFromProfile,
  formProblems,
  hasChanges,
  PROFILE_LIMITS,
  type AppProfileField,
  type AppProfileForm,
} from '../../lib/app-profile/form'
import type { ImageKind } from '../../lib/app-profile/image'
import { appPageUrl } from '../../lib/app-profile/renown'
import { Banner } from '../banner'
import { AppProfilePreview, type ImagePreviews } from './app-profile-preview'
import { ImageField } from './image-field'
import { LinksEditor } from './links-editor'
import { describedBy, ProfileField } from './profile-field'
import { useUnsavedChangesGuard } from './use-unsaved-guard'

const NO_PREVIEWS: ImagePreviews = { logo: null, cover: null }

/** The Profile tab: the app's public Renown profile, edited by its publisher (both app kinds). */
export function AppProfileTab({
  appId,
  appName,
  appDid,
}: {
  appId: string
  appName: string
  appDid: string | null | undefined
}) {
  if (!appDid) {
    return (
      <Banner tone="neutral" icon={Fingerprint} title="No Renown identity yet">
        {appName} gets a public Renown profile once its deploy identity is registered. Authorize it
        from the Overview, then come back here.
      </Banner>
    )
  }
  return <ProfileEditor appId={appId} appName={appName} appDid={appDid} />
}

function ProfileEditor({
  appId,
  appName,
  appDid,
}: {
  appId: string
  appName: string
  appDid: string
}) {
  const profile = useAppProfile(appDid)
  if (profile.isPending) return <TabSkeleton rows={2} label="Loading profile" />
  if (profile.error && !profile.data) {
    return (
      <Banner
        tone="warning"
        icon={TriangleAlert}
        title="The Renown profile did not load"
        actions={
          <Button size="sm" variant="outline" onClick={() => void profile.refetch()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        }
      >
        {profile.error.message}
      </Banner>
    )
  }
  const stored = profile.data ?? null
  // A new document id (the first save) starts the form over from what Renown stored.
  return (
    <ProfileForm
      key={stored?.documentId ?? 'new'}
      appId={appId}
      appName={appName}
      appDid={appDid}
      stored={stored}
      refreshFailed={!!profile.error}
    />
  )
}

function ProfileForm({
  appId,
  appName,
  appDid,
  stored,
  refreshFailed = false,
}: {
  appId: string
  appName: string
  appDid: string
  stored: RenownAppProfile | null
  /** A background refresh failed; the form keeps the last loaded profile. */
  refreshFailed?: boolean
}) {
  const initial = useMemo(() => formFromProfile(stored), [stored])
  // An empty profile starts with the app's Vetra name, so the first save names it.
  const fresh = useMemo(() => ({ ...initial, name: initial.name || appName }), [initial, appName])
  const [form, setForm] = useState<AppProfileForm>(fresh)
  const [previews, setPreviews] = useState<ImagePreviews>(NO_PREVIEWS)
  const [uploading, setUploading] = useState<Record<ImageKind, boolean>>({
    logo: false,
    cover: false,
  })
  const [serverError, setServerError] = useState<{
    field: AppProfileField | null
    message: string
  } | null>(null)
  const update = useUpdateAppProfile(appId, appDid)
  const getBearer = useRenownBearer()

  const problems = formProblems(form)
  const changes = changedFields(initial, form)
  const dirty = hasChanges(changes)
  const busy = uploading.logo || uploading.cover || update.isPending
  const canSave = dirty && !busy && Object.keys(problems).length === 0
  const documentId = stored?.documentId ?? null
  const saving = useRef(false)
  const previewsRef = useRef<ImagePreviews>(NO_PREVIEWS)
  useEffect(() => {
    previewsRef.current = previews
  }, [previews])
  useEffect(
    () => () => {
      for (const url of Object.values(previewsRef.current)) if (url) URL.revokeObjectURL(url)
    },
    [],
  )
  useUnsavedChangesGuard(dirty)

  const errorFor = (field: AppProfileField): string | undefined =>
    problems[field] ?? (serverError?.field === field ? serverError.message : undefined)

  function set<K extends keyof AppProfileForm>(key: K, value: AppProfileForm[K]) {
    setForm((current) => ({ ...current, [key]: value }))
    setServerError(null)
  }

  function setImage(kind: ImageKind, ref: string | null, previewUrl: string | null) {
    const old = previewsRef.current[kind]
    if (old && old !== previewUrl) URL.revokeObjectURL(old)
    set(kind === 'logo' ? 'logoRef' : 'coverRef', ref)
    setPreviews((current) => ({ ...current, [kind]: previewUrl }))
  }

  function reset() {
    for (const url of Object.values(previewsRef.current)) if (url) URL.revokeObjectURL(url)
    setForm(fresh)
    setPreviews(NO_PREVIEWS)
    setServerError(null)
  }

  async function save() {
    if (saving.current || !canSave) return
    saving.current = true
    try {
      await update.mutateAsync(changes)
      toast.success('Profile saved. It is live on Renown.')
    } catch (err) {
      const field = isPublisherError(err) ? fieldForServer(err.field) : null
      const message = describePublisherError(err)
      setServerError({ field, message })
      if (!field) toast.error(message)
    } finally {
      saving.current = false
    }
  }

  const imageField = (kind: ImageKind) => (
    <ImageField
      kind={kind}
      documentId={documentId}
      value={kind === 'logo' ? form.logoRef : form.coverRef}
      previewUrl={previews[kind]}
      fallbackUrl={kind === 'logo' ? (stored?.logo ?? null) : null}
      getBearer={getBearer}
      onUploaded={(ref, url) => setImage(kind, ref, url)}
      onClear={() => setImage(kind, null, null)}
      onBusyChange={(value) => setUploading((current) => ({ ...current, [kind]: value }))}
      error={errorFor(kind)}
    />
  )

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
      <form
        className="min-w-0 space-y-8"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          if (canSave) void save()
        }}
      >
        {refreshFailed && (
          <p className="text-muted-foreground text-sm" role="status">
            Couldn’t refresh — showing last loaded profile.
          </p>
        )}
        <TabHeader
          title="Public profile"
          description={
            <>
              How {appName} appears on Renown: its app page and the profile of whoever publishes it.
              Saving publishes immediately.
            </>
          }
          action={
            <Button asChild variant="outline" size="sm">
              <a href={appPageUrl(appDid)} target="_blank" rel="noopener noreferrer">
                View on Renown
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </Button>
          }
        />

        <section className="space-y-6">
          {imageField('cover')}
          {imageField('logo')}
        </section>

        <section className="grid gap-6 sm:grid-cols-2">
          <ProfileField
            id="profile-name"
            label="Name"
            error={errorFor('name')}
            count={form.name.trim().length}
            max={PROFILE_LIMITS.name}
          >
            <Input
              id="profile-name"
              aria-describedby={describedBy('profile-name', errorFor('name'), false)}
              value={form.name}
              aria-invalid={!!errorFor('name')}
              onChange={(e) => set('name', e.target.value)}
            />
          </ProfileField>
          <ProfileField
            id="profile-category"
            label="Category"
            hint="Where it fits, for example Productivity."
            error={errorFor('category')}
            count={form.category.trim().length}
            max={PROFILE_LIMITS.category}
          >
            <Input
              id="profile-category"
              aria-describedby={describedBy('profile-category', errorFor('category'), true)}
              list="profile-category-suggestions"
              value={form.category}
              aria-invalid={!!errorFor('category')}
              onChange={(e) => set('category', e.target.value)}
            />
            <datalist id="profile-category-suggestions">
              {CATEGORY_SUGGESTIONS.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </ProfileField>
          <ProfileField
            id="profile-tagline"
            label="Tagline"
            hint="One line under the name."
            className="sm:col-span-2"
            error={errorFor('tagline')}
            count={form.tagline.trim().length}
            max={PROFILE_LIMITS.tagline}
          >
            <Input
              id="profile-tagline"
              aria-describedby={describedBy('profile-tagline', errorFor('tagline'), true)}
              value={form.tagline}
              aria-invalid={!!errorFor('tagline')}
              onChange={(e) => set('tagline', e.target.value)}
            />
          </ProfileField>
          <ProfileField
            id="profile-website"
            label="Website"
            className="sm:col-span-2"
            error={errorFor('website')}
          >
            <Input
              id="profile-website"
              aria-describedby={describedBy('profile-website', errorFor('website'), false)}
              type="url"
              inputMode="url"
              placeholder="https://"
              value={form.website}
              aria-invalid={!!errorFor('website')}
              onChange={(e) => set('website', e.target.value)}
            />
          </ProfileField>
          <ProfileField
            id="profile-description"
            label="Description"
            className="sm:col-span-2"
            hint="Markdown: **bold**, *italic*, `code`, [links](https://…), lists and > quotes."
            error={errorFor('description')}
            count={form.description.trim().length}
            max={PROFILE_LIMITS.description}
          >
            <Textarea
              id="profile-description"
              aria-describedby={describedBy('profile-description', errorFor('description'), true)}
              rows={8}
              value={form.description}
              aria-invalid={!!errorFor('description')}
              onChange={(e) => set('description', e.target.value)}
            />
          </ProfileField>
        </section>

        <section className="space-y-3" aria-labelledby="profile-links-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="profile-links-heading" className="text-sm font-medium">
              Links
            </h3>
            <span className="text-muted-foreground text-xs tabular-nums">
              {form.links.length}/{PROFILE_LIMITS.links}
            </span>
          </div>
          <LinksEditor
            links={form.links}
            onChange={(links) => set('links', links)}
            error={errorFor('links')}
          />
        </section>

        <div className="border-border flex flex-wrap items-center justify-end gap-3 border-t pt-6">
          {dirty && <span className="text-muted-foreground mr-auto text-sm">Unsaved changes</span>}
          <Button type="button" variant="ghost" onClick={reset} disabled={!dirty || busy}>
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            aria-busy={update.isPending}
          >
            {update.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save profile
          </Button>
        </div>
      </form>

      <aside className="min-w-0 space-y-3 lg:sticky lg:top-24 lg:self-start" aria-label="Preview">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Preview</p>
        <AppProfilePreview
          appName={appName}
          appDid={appDid}
          form={form}
          documentId={documentId}
          previews={previews}
          legacyLogo={stored?.logo ?? null}
        />
      </aside>
    </div>
  )
}
