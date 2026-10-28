'use client'
import { usePHToast, useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useMemo } from 'react'
import { PageShell, PageSpinner } from '@/modules/shared/components/page-shell'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { useTeamBySlug } from '@/modules/profile/lib/use-team-by-slug'
import { TeamTabs } from './components/team-tabs'
import { ProfileSection } from './components/profile-section'
import { MembersSection } from './components/members-section'
import { SpacesSection } from './components/spaces-section'

/** Teams are managed from the settings page; team pages link back there. */
const SETTINGS_TEAMS = '/user/settings?tab=teams'

function ManageTeamInner() {
  const params = useParams<{ slug: string }>()
  const slug = params.slug
  const auth = useRenownAuthAsync()
  const router = useRouter()
  const toast = usePHToast()

  const { data: team, isLoading, isError } = useTeamBySlug(slug)

  const isMember = useMemo(() => {
    if (!team || !auth.address) return false
    const me = auth.address.toLowerCase()
    return team.members.some((m) => m.ethAddress.toLowerCase() === me)
  }, [team, auth.address])

  // Send non-members back to their teams list once we know (public team pages are retired).
  useEffect(() => {
    if (!team || !auth.address || isLoading) return
    if (!isMember) {
      toast?.('Only members can manage this team', { type: 'error' })
      router.replace(SETTINGS_TEAMS)
    }
  }, [team, auth.address, isLoading, isMember, toast, router, slug])

  // RequireLogin gates the page; the address can trail the auth state by a render.
  if (!auth.address || isLoading) return <PageSpinner />

  if (isError || !team) {
    return (
      <PageShell className="max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <h2 className="text-lg font-semibold">Team not found</h2>
            <p className="text-muted-foreground text-sm">
              We couldn&apos;t find a team with slug <code>{slug}</code>.
            </p>
            <Button asChild variant="outline">
              <Link href={SETTINGS_TEAMS}>
                <ArrowLeft className="mr-1.5 size-4" />
                Back to settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  if (!isMember) {
    // useEffect will redirect; render a placeholder spinner.
    return <PageSpinner />
  }

  return (
    <PageShell className="max-w-3xl">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
            <Link
              href={SETTINGS_TEAMS}
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="size-3" />
              Back to settings
            </Link>
          </div>
          <h1 className="truncate text-2xl font-bold tracking-tight">Manage {team.profileName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Edit your team&apos;s profile, members, and packages.
          </p>
        </div>
      </div>

      <TeamTabs slug={team.profileSlug}>
        {{
          profile: <ProfileSection team={team} />,
          members: <MembersSection team={team} currentUserAddress={auth.address} />,
          spaces: <SpacesSection team={team} />,
        }}
      </TeamTabs>
    </PageShell>
  )
}

export default function ManageTeamPage() {
  return (
    <RequireLogin title="Log in to manage this team">
      <Suspense fallback={<PageSpinner />}>
        <ManageTeamInner />
      </Suspense>
    </RequireLogin>
  )
}
