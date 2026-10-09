'use client'

import { ArrowUpRight, Pencil, Sparkles } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { useAppProfile } from '../../hooks/use-app-profile'
import { formFromProfile } from '../../lib/app-profile/form'
import { appPageUrl } from '../../lib/app-profile/renown'
import { AppProfilePreview } from './app-profile-preview'

/** The Overview's "Public profile" section: the Renown profile card, with edit and view links. */
export function AppProfileCard({
  appDid,
  appName,
  onEdit,
}: {
  appDid: string | null | undefined
  appName: string
  onEdit?: () => void
}) {
  const profile = useAppProfile(appDid)
  if (!appDid) return null
  return (
    <section className="space-y-4" aria-labelledby="public-profile-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="public-profile-heading" className="text-lg font-semibold">
          Public profile
        </h2>
        <div className="flex gap-2">
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </Button>
          )}
          <Button size="sm" variant="ghost" asChild>
            <a href={appPageUrl(appDid)} target="_blank" rel="noopener noreferrer">
              View on Renown
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        </div>
      </div>
      {profile.isPending ? (
        <Skeleton className="h-56 w-full max-w-md rounded-2xl" />
      ) : profile.data ? (
        <div className="max-w-md">
          <AppProfilePreview
            appName={appName}
            appDid={appDid}
            form={formFromProfile(profile.data)}
            documentId={profile.data.documentId}
            previews={{ logo: null, cover: null }}
            legacyLogo={profile.data.logo}
            compact
          />
        </div>
      ) : profile.error ? (
        <p className="text-muted-foreground text-sm">
          The Renown profile could not be loaded right now.
        </p>
      ) : (
        <div className="border-border bg-card flex max-w-md flex-col items-start gap-3 rounded-2xl border border-dashed p-6">
          <Sparkles className="text-primary h-5 w-5" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Give {appName} a public face</p>
            <p className="text-muted-foreground text-sm">
              Add a logo, a cover, a description and links. They show on Renown, on the app’s page
              and on your profile.
            </p>
          </div>
          {onEdit && (
            <Button size="sm" onClick={onEdit}>
              Set up profile
            </Button>
          )}
        </div>
      )}
    </section>
  )
}
