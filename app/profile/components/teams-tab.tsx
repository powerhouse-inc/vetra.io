'use client'
import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { useMyTeams } from '@/modules/profile/lib/use-my-teams'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { TabErrorState } from './tab-error-state'
import { TeamProfileCard } from './team-profile-card'

export function TeamsTab({ address }: { address: string }) {
  const { data, isLoading, isError, refetch } = useMyTeams(address)

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} data-testid="team-card-skeleton">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-muted size-12 animate-pulse rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="bg-muted h-4 w-32 animate-pulse rounded" />
                  <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                </div>
              </div>
              <div className="bg-muted h-3 w-full animate-pulse rounded" />
              <div className="bg-muted h-3 w-2/3 animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (isError) {
    return <TabErrorState message="Couldn’t load your teams" onRetry={() => void refetch?.()} />
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
          <div className="bg-muted flex size-12 items-center justify-center rounded-full">
            <Users className="text-muted-foreground size-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold">You&apos;re not in any builder team yet</h3>
            <p className="text-muted-foreground mx-auto mt-1 max-w-sm text-sm">
              Create your first team to start showcasing what you&apos;re building, or browse the
              ecosystem to find one to join.
            </p>
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <Link href="/profile/create-team">
                <Plus className="mr-1.5 size-4" />
                Create your first team
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {data.map((t) => (
        <TeamProfileCard key={t.id} team={t} />
      ))}
    </div>
  )
}
