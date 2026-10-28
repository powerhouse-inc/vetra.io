'use client'
import { Check, Github, Globe, Loader2, Save } from 'lucide-react'
import { useState } from 'react'
import { usePHToast } from '@powerhousedao/reactor-browser'
import { Avatar, AvatarFallback, AvatarImage } from '@/modules/shared/components/ui/avatar'
import { Button } from '@/modules/shared/components/ui/button'
import XLogo from '@/modules/shared/components/icons/x-logo'
import { isValidSlug, isValidUrl, slugify } from '@/modules/profile/lib/validations'
import { useSlugAvailability } from '@/modules/profile/lib/use-slug-availability'
import {
  computeProfileDiff,
  formFromTeam,
  useUpdateTeamProfile,
  type TeamProfileForm,
} from '@/modules/profile/lib/use-update-team-profile'
import type { FullTeam } from '@/modules/profile/lib/create-team-queries'
import { cn } from '@/modules/shared/lib/utils'

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase() || '??'
}

export function ProfileSection({ team }: { team: FullTeam }) {
  const [form, setForm] = useState<TeamProfileForm>(() => formFromTeam(team))
  const { saveProfile, isSaving } = useUpdateTeamProfile(team)
  const toast = usePHToast()

  // Only check availability when the slug changed (the team's own slug always
  // resolves to itself; treat that as "no need to check").
  const slugChanged = form.slug !== team.profileSlug
  const slugStatus = useSlugAvailability(form.slug, slugChanged && isValidSlug(form.slug))

  const diff = computeProfileDiff(form, team)
  const hasChanges = diff.length > 0
  const slugBlocked = slugChanged && (!isValidSlug(form.slug) || slugStatus !== 'available')
  const canSave = hasChanges && !slugBlocked && !isSaving

  const onSave = async () => {
    try {
      const result = await saveProfile(form)
      if (result.changed > 0) toast?.('Changes saved', { type: 'success' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't save — ${msg}`, { type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <Avatar className="size-16">
          {form.logo && <AvatarImage src={form.logo} alt={form.name} />}
          <AvatarFallback className="bg-muted text-base font-bold">
            {initials(form.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="truncate text-lg font-semibold">{form.name || 'Untitled team'}</div>
          <div className="text-muted-foreground truncate text-xs">
            vetra.to/builders/{form.slug || '…'}
          </div>
        </div>
      </header>

      <div>
        <label htmlFor="profile-name" className="mb-1 block text-sm font-medium">
          Team name
        </label>
        <input
          id="profile-name"
          className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          maxLength={60}
          value={form.name}
          onChange={(e) => {
            const next = e.target.value
            // Mirror create-team: auto-update slug if it was tracking the auto-suggestion.
            const previousAuto = slugify(form.name)
            const nextSlug =
              form.slug === previousAuto || form.slug === '' ? slugify(next) : form.slug
            setForm({ ...form, name: next, slug: nextSlug })
          }}
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="profile-slug" className="text-sm font-medium">
            URL slug
          </label>
          {slugChanged && (
            <SlugStatus status={slugStatus} invalid={form.slug !== '' && !isValidSlug(form.slug)} />
          )}
        </div>
        <div className="bg-background focus-within:ring-primary flex items-stretch rounded-md border focus-within:ring-2">
          <span className="text-muted-foreground border-r px-3 py-2 text-sm">
            vetra.to/builders/
          </span>
          <input
            id="profile-slug"
            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
            value={form.slug}
            maxLength={40}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
        </div>
        <p className="text-muted-foreground mt-1 text-xs">
          Lowercase letters, numbers, and dashes. 3–40 characters.
        </p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="profile-description" className="text-sm font-medium">
            Description
          </label>
          <span className="text-muted-foreground text-xs">{form.description.length} / 280</span>
        </div>
        <textarea
          id="profile-description"
          className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          rows={4}
          maxLength={280}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div>
        <label htmlFor="profile-logo" className="mb-1 block text-sm font-medium">
          Logo URL
        </label>
        <input
          id="profile-logo"
          className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
          placeholder="https://example.com/logo.png"
          value={form.logo}
          onChange={(e) => setForm({ ...form, logo: e.target.value })}
        />
      </div>

      <div className="space-y-4 border-t pt-6">
        <h3 className="text-sm font-medium">Socials</h3>
        <SocialField
          id="profile-x"
          label="X (Twitter)"
          Icon={({ className }) => <XLogo className={className} />}
          value={form.socialsX}
          placeholder="https://x.com/your-team"
          onChange={(v) => setForm({ ...form, socialsX: v })}
        />
        <SocialField
          id="profile-github"
          label="GitHub"
          Icon={Github}
          value={form.socialsGithub}
          placeholder="https://github.com/your-team"
          onChange={(v) => setForm({ ...form, socialsGithub: v })}
        />
        <SocialField
          id="profile-website"
          label="Website"
          Icon={Globe}
          value={form.socialsWebsite}
          placeholder="https://your-team.com"
          onChange={(v) => setForm({ ...form, socialsWebsite: v })}
        />
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-6">
        {!hasChanges && !isSaving && (
          <span className="text-muted-foreground text-xs">No changes to save</span>
        )}
        <Button disabled={!canSave} onClick={() => void onSave()}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-1.5 size-4" />
              Save changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

function SocialField({
  id,
  label,
  value,
  placeholder,
  Icon,
  onChange,
}: {
  id: string
  label: string
  value: string
  placeholder: string
  Icon: React.ComponentType<{ className?: string }>
  onChange: (v: string) => void
}) {
  const invalid = !isValidUrl(value)
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex items-center gap-1.5 text-sm font-medium">
        <Icon className="size-3.5" />
        {label}
      </label>
      <input
        id={id}
        type="url"
        className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {invalid && <p className="text-destructive mt-1 text-xs">Must be a valid URL.</p>}
    </div>
  )
}

function SlugStatus({
  status,
  invalid,
}: {
  status: 'idle' | 'checking' | 'available' | 'taken' | 'error'
  invalid: boolean
}) {
  if (invalid) {
    return (
      <span className="text-destructive flex items-center gap-1 text-xs font-medium">
        Invalid format
      </span>
    )
  }
  const map = {
    idle: null,
    checking: {
      icon: <Loader2 className="size-3 animate-spin" />,
      label: 'Checking',
      cls: 'text-muted-foreground',
    },
    available: {
      icon: <Check className="size-3" />,
      label: 'Available',
      cls: 'text-success dark:text-success',
    },
    taken: { icon: null, label: 'Taken', cls: 'text-destructive' },
    error: { icon: null, label: "Couldn't check", cls: 'text-muted-foreground' },
  }[status]
  if (!map) return null
  return (
    <span className={cn('flex items-center gap-1 text-xs font-medium', map.cls)}>
      {map.icon}
      {map.label}
    </span>
  )
}
