'use client'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { usePHToast } from '@powerhousedao/reactor-browser'
import { Avatar, AvatarFallback } from '@/modules/shared/components/ui/avatar'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent } from '@/modules/shared/components/ui/card'
import { useEnsResolver } from '@/modules/profile/lib/use-ens-resolver'
import { useTeamMembers } from '@/modules/profile/lib/use-team-members'
import { isValidEthAddress } from '@/modules/profile/lib/validations'
import type { FullTeam, FullTeamMember } from '@/modules/profile/lib/create-team-queries'
import { ConfirmDialog } from './confirm-dialog'
import { usePersonName } from '@/modules/shared/hooks/use-person-name'
import { GeneratedAvatar } from '@/modules/shared/components/generated-avatar'

function shortAddr(addr: string): string {
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr
}

export function MembersSection({
  team,
  currentUserAddress,
}: {
  team: FullTeam
  currentUserAddress: string
}) {
  const { inviteMember, removeMember, isPending } = useTeamMembers(team)
  const toast = usePHToast()
  const [inviteAddress, setInviteAddress] = useState('')
  const ens = useEnsResolver(inviteAddress)
  const [pendingRemove, setPendingRemove] = useState<FullTeamMember | null>(null)

  const trimmedAddr = inviteAddress.trim()
  const dup = team.members.some((m) => m.ethAddress.toLowerCase() === trimmedAddr.toLowerCase())
  const invalid = trimmedAddr !== '' && !isValidEthAddress(trimmedAddr)
  const inviteError = invalid ? 'Must be a 0x… address.' : dup ? 'Already a member.' : null
  const canInvite = isValidEthAddress(trimmedAddr) && !dup && !isPending

  const doInvite = async () => {
    if (!canInvite) return
    try {
      await inviteMember(trimmedAddr)
      setInviteAddress('')
      toast?.('Member added', { type: 'success' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't add member — ${msg}`, { type: 'error' })
    }
  }

  const doRemove = async () => {
    if (!pendingRemove) return
    const m = pendingRemove
    setPendingRemove(null)
    try {
      await removeMember(m.id)
      toast?.('Member removed', { type: 'success' })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong'
      toast?.(`Couldn't remove — ${msg}`, { type: 'error' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {team.members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            isSelf={m.ethAddress.toLowerCase() === currentUserAddress.toLowerCase()}
            isOnlyMember={team.members.length === 1}
            onRemove={() => setPendingRemove(m)}
          />
        ))}
      </div>

      <Card>
        <CardContent className="space-y-3 p-5">
          <h3 className="text-sm font-medium">Invite a member</h3>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <input
                className="bg-background focus:ring-primary w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
                placeholder="0x…"
                value={inviteAddress}
                onChange={(e) => setInviteAddress(e.target.value)}
              />
              {ens && !inviteError && <p className="text-muted-foreground mt-1 text-xs">→ {ens}</p>}
              {inviteError && <p className="text-destructive mt-1 text-xs">{inviteError}</p>}
            </div>
            <Button onClick={() => void doInvite()} disabled={!canInvite}>
              {isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 size-4" />
              )}
              Invite
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        title={
          pendingRemove?.ethAddress.toLowerCase() === currentUserAddress.toLowerCase()
            ? 'Leave team?'
            : 'Remove member?'
        }
        description={
          pendingRemove?.ethAddress.toLowerCase() === currentUserAddress.toLowerCase()
            ? "If you remove yourself you'll lose access to this management page."
            : `Remove ${pendingRemove ? shortAddr(pendingRemove.ethAddress) : ''} from the team?`
        }
        confirmLabel={
          pendingRemove?.ethAddress.toLowerCase() === currentUserAddress.toLowerCase()
            ? 'Leave team'
            : 'Remove'
        }
        destructive
        onConfirm={() => void doRemove()}
        onCancel={() => setPendingRemove(null)}
      />
    </div>
  )
}

function MemberRow({
  member,
  isSelf,
  isOnlyMember,
  onRemove,
}: {
  member: FullTeamMember
  isSelf: boolean
  isOnlyMember: boolean
  onRemove: () => void
}) {
  const ens = useEnsResolver(member.ethAddress)
  // Renown's profile first (name and picture), then what the team stored, then ENS.
  const { name: renownName, avatarUrl } = usePersonName(member.ethAddress)
  const displayName = renownName || member.name || ens || shortAddr(member.ethAddress)
  const image = avatarUrl ?? member.profileImage
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <Avatar className="size-10">
          {image && (
            // eslint-disable-next-line @next/next/no-img-element -- Renown /media 302s to short-lived storage URLs
            <img src={image} alt={displayName} className="h-full w-full object-cover" />
          )}
          <AvatarFallback className="bg-transparent p-0">
            <GeneratedAvatar seed={member.ethAddress} className="h-full w-full rounded-full" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm font-medium">
            {displayName}
            {isSelf && (
              <span className="text-muted-foreground text-xs tracking-wide uppercase">You</span>
            )}
          </div>
          <div className="text-muted-foreground font-mono text-xs">
            {shortAddr(member.ethAddress)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={isOnlyMember}
          title={isOnlyMember ? "Can't remove the last member" : undefined}
        >
          <Trash2 className="mr-1 size-3.5" />
          {isSelf ? 'Leave' : 'Remove'}
        </Button>
      </CardContent>
    </Card>
  )
}
