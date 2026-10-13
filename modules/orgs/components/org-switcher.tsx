'use client'

import { Building2, ExternalLink, Plus, User } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/modules/shared/components/ui/dropdown-menu'
import { useActiveOrg } from '../hooks/use-orgs'
import { renownCreateOrgUrl, renownOrgManageUrl } from '../lib/links'

const PERSONAL = 'personal'
const item = 'cursor-pointer rounded-md px-3 py-2 text-sm font-medium'

/** "Working in" section of the account menu: Personal + the viewer's organisations. */
export function OrgSwitcherMenuSection() {
  const { orgId, org, orgs, setActiveOrg } = useActiveOrg()
  return (
    <>
      <DropdownMenuLabel className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-medium">
        Working in
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={orgId ?? PERSONAL}
        onValueChange={(v) => setActiveOrg(v === PERSONAL ? null : v)}
      >
        <DropdownMenuRadioItem value={PERSONAL} className={item}>
          <User className="h-4 w-4" />
          Personal
        </DropdownMenuRadioItem>
        {orgs.map((o) => (
          <DropdownMenuRadioItem key={o.id} value={o.id} className={item}>
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{o.name}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {org && (
        <DropdownMenuItem asChild className={item}>
          <a href={renownOrgManageUrl(org.handle)} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            <span className="min-w-0 truncate">Manage {org.name}</span>
          </a>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem asChild className={item}>
        <a href={renownCreateOrgUrl()} target="_blank" rel="noreferrer">
          <Plus className="h-4 w-4" />
          Create an organisation
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="bg-border/50" />
    </>
  )
}

/** The active organisation's name for the account button; nothing when personal. */
export function ActiveOrgLabel() {
  const { org } = useActiveOrg()
  if (!org) return null
  return <span className="text-muted-foreground max-w-[10rem] truncate text-xs">· {org.name}</span>
}
