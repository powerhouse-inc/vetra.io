'use client'
import { ExternalLink, IdCard } from 'lucide-react'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import { Avatar, AvatarFallback, AvatarImage } from '@/modules/shared/components/ui/avatar'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'

function Row({ label, value }: { label: string; value: string | undefined | null }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
      <div className="text-muted-foreground w-32 shrink-0 text-xs tracking-wide uppercase">
        {label}
      </div>
      <div className="font-mono text-sm break-all">
        {value || <span className="text-muted-foreground italic">Not set</span>}
      </div>
    </div>
  )
}

export function SettingsTab() {
  const auth = useRenownAuth()
  // `status` stays "initial" after a reload even with a restored user, so key
  // off the user rather than the resolved status.
  if (!auth.user) return null

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16">
            {auth.avatarUrl && <AvatarImage src={auth.avatarUrl} alt={auth.displayName ?? ''} />}
            <AvatarFallback>
              <IdCard className="size-7" />
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg font-semibold">
              {auth.displayName ?? 'Renown user'}
            </div>
            {auth.ensName && <div className="text-muted-foreground text-sm">{auth.ensName}</div>}
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t pt-6">
          <Row label="Address" value={auth.address} />
          <Row label="Display name" value={auth.displayName} />
          <Row label="ENS" value={auth.ensName} />
          <Row label="Profile ID" value={auth.profileId} />
        </div>

        <div className="flex border-t pt-6">
          <Button onClick={auth.openProfile} variant="outline">
            <IdCard className="mr-2 size-4" />
            Edit on Renown
            <ExternalLink className="ml-2 size-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
