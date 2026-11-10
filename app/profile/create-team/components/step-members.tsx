'use client'
import { Plus, ShieldCheck, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/modules/shared/components/ui/avatar'
import { Button } from '@/modules/shared/components/ui/button'
import { useEnsResolver } from '@/modules/profile/lib/use-ens-resolver'
import { isValidEthAddress } from '@/modules/profile/lib/validations'
import { usePersonName } from '@/modules/shared/hooks/use-person-name'
import { looksLikeAddress } from '@/modules/shared/lib/renown-person'

export type MemberRow = { address: string }
export type StepMembersProps = {
  creator: { address: string; displayName: string | undefined; displayAddress: string | undefined }
  members: MemberRow[]
  onChange: (next: MemberRow[]) => void
}

export function StepMembers({ creator, members, onChange }: StepMembersProps) {
  const { name: renownName } = usePersonName(creator.address)
  // The SDK's displayName is the Renown username, which may only be the short address.
  const creatorName =
    renownName ??
    (creator.displayName && !looksLikeAddress(creator.displayName) ? creator.displayName : null)
  const addRow = () => onChange([...members, { address: '' }])
  const updateRow = (i: number, address: string) => {
    const next = members.slice()
    next[i] = { address }
    onChange(next)
  }
  const removeRow = (i: number) => {
    const next = members.slice()
    next.splice(i, 1)
    onChange(next)
  }

  return (
    <div className="space-y-4">
      <div className="bg-muted/40 flex items-center gap-3 rounded-md border p-3">
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/15 text-primary">
            <ShieldCheck className="size-4" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{creatorName ?? 'You'}</div>
          <div className="text-muted-foreground font-mono text-xs">
            {creator.displayAddress ?? creator.address}
          </div>
        </div>
        <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
          You — admin
        </span>
      </div>

      {members.map((m, i) => (
        <MemberInviteRow
          key={i}
          address={m.address}
          creator={creator.address}
          others={members.filter((_, j) => j !== i).map((x) => x.address)}
          onChange={(v) => updateRow(i, v)}
          onRemove={() => removeRow(i)}
        />
      ))}

      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 size-3.5" />
        Add member
      </Button>
    </div>
  )
}

function MemberInviteRow({
  address,
  creator,
  others,
  onChange,
  onRemove,
}: {
  address: string
  creator: string
  others: string[]
  onChange: (v: string) => void
  onRemove: () => void
}) {
  const ens = useEnsResolver(address)
  const invalid = address !== '' && !isValidEthAddress(address)
  const dup =
    address !== '' &&
    (address.toLowerCase() === creator.toLowerCase() ||
      others.some((o) => o.toLowerCase() === address.toLowerCase()))
  const error = invalid ? 'Must be a 0x… address.' : dup ? 'Already invited.' : null
  return (
    <div>
      <div className="flex items-start gap-2">
        <input
          className="bg-background focus:ring-primary flex-1 rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
          placeholder="0x…"
          value={address}
          onChange={(e) => onChange(e.target.value)}
        />
        <Button variant="ghost" size="icon" onClick={onRemove} aria-label="Remove">
          <X className="size-4" />
        </Button>
      </div>
      {ens && !error && <p className="text-muted-foreground mt-1 pl-1 text-xs">→ {ens}</p>}
      {error && <p className="text-destructive mt-1 pl-1 text-xs">{error}</p>}
    </div>
  )
}
