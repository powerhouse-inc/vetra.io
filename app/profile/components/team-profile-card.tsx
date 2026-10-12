'use client'
import Link from 'next/link'
import { ArrowRight, Users, Package } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/modules/shared/components/ui/avatar'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import type { ProfileTeam } from '@/modules/profile/lib/queries'

function initials(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

function avatarColor(name: string): string {
  const colors = ['bg-green-600', 'bg-blue-600', 'bg-purple-600', 'bg-orange-600', 'bg-rose-600']
  const hash = [...name].reduce((a, b) => a + b.charCodeAt(0), 0)
  return colors[hash % colors.length]
}

function packageCount(team: ProfileTeam): number {
  return team.spaces.reduce((acc, s) => acc + s.packages.length, 0)
}

export function TeamProfileCard({ team }: { team: ProfileTeam }) {
  const pkgCount = packageCount(team)
  const memCount = team.members.length

  return (
    <Card className="group flex h-full flex-col transition-shadow hover:shadow-md">
      <CardContent className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <Avatar className="size-12">
            {team.profileLogo && <AvatarImage src={team.profileLogo} alt={team.profileName} />}
            <AvatarFallback
              className={`${avatarColor(team.profileName)} text-sm font-bold text-white`}
            >
              {initials(team.profileName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold">{team.profileName}</h3>
            <p className="text-muted-foreground truncate text-xs">/{team.profileSlug}</p>
          </div>
        </div>

        {team.profileDescription && (
          <p className="text-muted-foreground line-clamp-3 flex-1 text-sm leading-relaxed">
            {team.profileDescription}
          </p>
        )}

        <div className="text-muted-foreground flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1">
            <Users className="size-3.5" />
            {memCount} {memCount === 1 ? 'member' : 'members'}
          </span>
          <span className="flex items-center gap-1">
            <Package className="size-3.5" />
            {pkgCount} {pkgCount === 1 ? 'package' : 'packages'}
          </span>
        </div>

        <div className="flex gap-2 pt-2">
          <Button variant="ghost" size="sm" className="flex-1" asChild>
            <Link href={`/profile/teams/${team.profileSlug}`}>
              Manage
              <ArrowRight className="ml-1 size-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
