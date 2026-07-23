'use client'
import { usePHToast, useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { ArrowLeft, ExternalLink, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useMemo } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { useTeamBySlug } from '@/modules/profile/lib/use-team-by-slug'
import { LoginPrompt } from '../../components/login-prompt'
import { TeamTabs } from './components/team-tabs'
import { ProfileSection } from './components/profile-section'
import { MembersSection } from './components/members-section'
import { SpacesSection } from './components/spaces-section'

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

  // Redirect non-members to the public page once we know.
  useEffect(() => {
    if (!team || !auth.address || isLoading) return
    if (!isMember) {
      toast?.('Only members can manage this team', { type: 'error' })
      router.replace(`/builders/${slug}`)
    }
  }, [team, auth.address, isLoading, isMember, toast, router, slug])

  if (auth.state === 'resolving') {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }
  if (auth.state !== 'authenticated' || !auth.address) {
    return (
      <div className="container mx-auto px-4 py-8">
        <LoginPrompt />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  if (isError || !team) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-8">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <h2 className="text-lg font-semibold">Team not found</h2>
            <p className="text-muted-foreground text-sm">
              We couldn&apos;t find a team with slug <code>{slug}</code>.
            </p>
            <Button asChild variant="outline">
              <Link href="/profile?tab=teams">
                <ArrowLeft className="mr-1.5 size-4" />
                Back to My profile
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isMember) {
    // useEffect will redirect; render a placeholder spinner.
    return (
      <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
        <Loader2 className="text-muted-foreground size-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
            <Link
              href="/profile?tab=teams"
              className="hover:text-foreground inline-flex items-center gap-1"
            >
              <ArrowLeft className="size-3" />
              My profile
            </Link>
          </div>
          <h1 className="truncate text-2xl font-bold tracking-tight">Manage {team.profileName}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Edit your team&apos;s profile, members, and packages.
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/builders/${team.profileSlug}`} target="_blank" rel="noopener noreferrer">
            Open public page
            <ExternalLink className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      </div>

      <TeamTabs slug={team.profileSlug}>
        {{
          profile: <ProfileSection team={team} />,
          members: <MembersSection team={team} currentUserAddress={auth.address} />,
          spaces: <SpacesSection team={team} />,
        }}
      </TeamTabs>
    </div>
  )
}

export default function ManageTeamPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto flex min-h-[60vh] items-center justify-center px-4 py-8">
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
        </div>
      }
    >
      <ManageTeamInner />
    </Suspense>
  )
}
