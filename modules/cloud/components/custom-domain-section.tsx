'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { useOptimistic } from '@/modules/cloud/hooks/use-optimistic'
import type { CloudEnvironment, TenantService } from '@/modules/cloud/types'
import { Button } from '@/modules/shared/components/ui/button'
import { Checkbox } from '@/modules/shared/components/ui/checkbox'
import { Input } from '@/modules/shared/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/components/ui/table'

/** Domains the cluster's external-dns provider controls directly. DNS A
 * records for hosts under these zones are published automatically from
 * Ingress annotations — no manual setup required on the user's side. */
const OWNED_DNS_ZONES = ['.vetra.io']

function isOwnedDomain(domain: string | null | undefined): boolean {
  if (!domain) return false
  const lower = domain.trim().toLowerCase()
  return OWNED_DNS_ZONES.some((zone) => lower === zone.slice(1) || lower.endsWith(zone))
}

// Mirror of the SERVICE_LABELS map in overview.tsx — kept local so this file
// stays self-contained. Both must agree on the user-facing names. Only
// CONNECT and SWITCHBOARD can host the apex of a custom domain (see
// TenantService), so those are the only ones we render labels for.
const SERVICE_LABELS: Record<TenantService, string> = {
  CONNECT: 'Powerhouse Connect',
  SWITCHBOARD: 'Powerhouse Switchboard',
  CLINT: 'Clint',
  FUSION: 'Fusion',
}

type Props = {
  customDomain: CloudEnvironment['state']['customDomain']
  apexService: TenantService | null
  /**
   * Enabled services eligible to serve at the apex. CLINT and FUSION are
   * filtered out by the caller — only CONNECT / SWITCHBOARD can host the
   * apex.
   */
  enabledServices: TenantService[]
  onSetCustomDomain: (
    enabled: boolean,
    domain?: string | null,
    apexService?: TenantService | null,
  ) => Promise<void>
}

/**
 * Custom domain editor — toggle, save, apex-routing pick, DNS records table
 * with Google-DNS verification. Lives in its own file so the env settings
 * drawer can mount it without pulling the entire overview tab along.
 */
export function CustomDomainSection({
  customDomain,
  apexService,
  enabledServices,
  onSetCustomDomain,
}: Props) {
  const [domainInput, setDomainInput] = useState(customDomain?.domain ?? '')
  const [apexInput, setApexInput] = useState<TenantService | ''>(apexService ?? '')
  const [dnsResults, setDnsResults] = useState<Record<string, boolean | null>>({})
  const [isVerifying, setIsVerifying] = useState(false)
  const records = customDomain?.dnsRecords ?? []
  const domainIsOwned = isOwnedDomain(domainInput || customDomain?.domain)

  const { value: enabled, set: setEnabledOptimistic } = useOptimistic(
    customDomain?.enabled ?? false,
    (next) =>
      onSetCustomDomain(
        next,
        next ? domainInput || undefined : undefined,
        next ? apexInput || null : null,
      ),
  )

  const handleToggle = async (checked: boolean) => {
    try {
      await setEnabledOptimistic(checked)
      if (!checked) {
        setDomainInput('')
        setApexInput('')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update custom domain')
    }
  }

  const handleSaveDomain = async () => {
    if (!domainInput.trim()) return
    try {
      await onSetCustomDomain(true, domainInput.trim(), apexInput || null)
      toast.success('Custom domain saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save custom domain')
    }
  }

  const handleVerifyDns = async () => {
    if (records.length === 0) return
    setIsVerifying(true)
    const results: Record<string, boolean | null> = {}
    for (const record of records) {
      try {
        const res = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(record.host)}&type=A`,
        )
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = await res.json()
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const answers = (data.Answer ?? []) as Array<{ data: string }>
        results[record.host] = answers.some((a: { data: string }) => a.data === record.value)
      } catch {
        results[record.host] = null
      }
    }
    setDnsResults(results)
    setIsVerifying(false)
  }

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="custom-domain"
            checked={enabled}
            onCheckedChange={(checked) => void handleToggle(checked === true)}
          />
          <label htmlFor="custom-domain" className="text-sm font-medium">
            Custom Domain
          </label>
        </div>
        {enabled && (
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="e.g. my-app.example.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSaveDomain()
              }}
              className="font-mono text-sm"
            />
            <Button
              size="sm"
              onClick={() => void handleSaveDomain()}
              disabled={!domainInput.trim() || domainInput === customDomain?.domain}
            >
              Save
            </Button>
          </div>
        )}
      </div>

      {/* Apex routing — only meaningful while a custom domain is set. */}
      {enabled && (
        <div className="space-y-1 pt-2">
          <label htmlFor="apex-service" className="text-muted-foreground text-sm font-medium">
            Serve at apex
          </label>
          <p className="text-muted-foreground text-xs">
            Pin one enabled service to the apex of the custom domain — the service is served at the
            domain itself instead of{' '}
            <span className="font-mono">&lt;prefix&gt;.&lt;domain&gt;</span>.
          </p>
          <select
            id="apex-service"
            className="border-input bg-background h-9 w-full rounded-md border px-3 font-mono text-sm"
            value={apexInput}
            onChange={(e) => setApexInput(e.target.value as TenantService | '')}
          >
            <option value="">None</option>
            {enabledServices.map((s) => (
              <option key={s} value={s}>
                {SERVICE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      )}

      {enabled && domainIsOwned && (
        <div className="space-y-1 pt-2">
          <h4 className="text-muted-foreground text-sm font-medium">DNS</h4>
          <p className="text-muted-foreground text-xs">
            DNS is managed automatically for <span className="font-mono">.vetra.io</span> domains —
            nothing to configure on your side.
          </p>
        </div>
      )}

      {enabled && !domainIsOwned && records.length > 0 && (
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between">
            <h4 className="text-muted-foreground text-sm font-medium">DNS Records</h4>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleVerifyDns()}
              disabled={isVerifying}
              className="text-xs"
            >
              {isVerifying ? 'Verifying...' : 'Verify DNS'}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Host</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="w-16">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record, i) => {
                const status = dnsResults[record.host]
                return (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{record.type}</TableCell>
                    <TableCell className="font-mono text-xs">{record.host}</TableCell>
                    <TableCell className="font-mono text-xs">{record.value}</TableCell>
                    <TableCell>
                      {status === true && <span className="text-success text-xs">Valid</span>}
                      {status === false && (
                        <span className="text-destructive text-xs">Missing</span>
                      )}
                      {status === null && <span className="text-warning text-xs">Error</span>}
                      {status === undefined && (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          <p className="text-muted-foreground text-xs">
            Add these A records to your DNS provider. Verification uses Google DNS.
          </p>
        </div>
      )}
    </>
  )
}
