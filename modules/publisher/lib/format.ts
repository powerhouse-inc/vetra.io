import { formatDate } from '@/modules/apps/lib/time'
import type { PublisherTemplate, PublisherTerm } from '../types'

const ADDRESS = /^0x[0-9a-fA-F]{40}$/
const PKH = /^did:pkh:eip155:\d+:(0x[0-9a-fA-F]{40})$/

/** "0x1234…abcd" for wallets; first 12 + "…" + last 6 characters for any other long DID. */
export function shortDid(did: string): string {
  const address = PKH.exec(did)?.[1] ?? (ADDRESS.test(did) ? did : null)
  if (address) return `${address.slice(0, 6)}…${address.slice(-4)}`
  return did.length > 20 ? `${did.slice(0, 12)}…${did.slice(-6)}` : did
}

export function termName(term: Pick<PublisherTerm, 'label' | 'kind'>): string {
  return term.label?.trim() || term.kind
}

export function templateName(template: Pick<PublisherTemplate, 'name' | 'mode'>): string {
  return (
    template.name?.trim() ||
    (template.mode === 'SHARED' ? 'Untitled shared template' : 'Untitled dedicated template')
  )
}

export function validityText(days: number | null): string {
  if (days == null) return 'No end date'
  return days === 1 ? '1 day' : `${days} days`
}

export function envCountText(n: number): string {
  if (n === 0) return 'No environments yet'
  return n === 1 ? '1 environment' : `${n} environments`
}

export function dateRange(start: string | null, end: string | null): string {
  if (!start) return 'Not started'
  return `${formatDate(start)} – ${end ? formatDate(end) : 'no end date'}`
}
