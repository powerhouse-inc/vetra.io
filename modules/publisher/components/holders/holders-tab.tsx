'use client'

import { Search, UserPlus, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/modules/shared/components/ui/select'
import {
  usePublisherAllowList,
  usePublisherEnvironments,
  usePublisherLicenses,
  usePublisherTemplates,
  usePublisherTerms,
} from '../../hooks/use-publisher'
import { termName } from '../../lib/format'
import {
  filterHolders,
  joinHolders,
  LICENSE_FILTERS,
  modeOfKind,
  type HolderRow,
  type LicenseFilter,
} from '../../lib/holders'
import { licenseStatusMeta } from '../../lib/status'
import { EmptyState, TabError, TabHeader, TabSkeleton } from '../primitives'
import { AllowListCard } from './allow-list-card'
import { ChangePlanDialog } from './change-plan-dialog'
import { GrantDialog } from './grant-dialog'
import { HoldersTable } from './holders-table'
import { RevokeDialog } from './revoke-dialog'

const ALL_PLANS = 'ALL'

export function HoldersTab({ appId }: { appId: string }) {
  const licenses = usePublisherLicenses(appId)
  const environments = usePublisherEnvironments(appId)
  const terms = usePublisherTerms(appId)
  const templates = usePublisherTemplates(appId)
  const allowList = usePublisherAllowList(appId)

  const [status, setStatus] = useState<LicenseFilter>('ALL')
  const [kind, setKind] = useState<string>(ALL_PLANS)
  const [query, setQuery] = useState('')
  const [granting, setGranting] = useState(false)
  const [changing, setChanging] = useState<HolderRow | null>(null)
  const [revoking, setRevoking] = useState<HolderRow | null>(null)

  const termList = terms.data ?? []
  const templateList = templates.data ?? []
  const rows = useMemo(
    () => joinHolders(licenses.data ?? [], environments.data ?? []),
    [licenses.data, environments.data],
  )
  const shown = filterHolders(rows, { status, kind, query })
  const modeOf = (k: string) => modeOfKind(k, termList, templateList)
  const plansError = terms.error ?? templates.error
  const grantLoadError = !!plansError || !!allowList.error || terms.isPending || templates.isPending || allowList.isPending
  const retryGrantData = () => {
    if (terms.error) void terms.refetch()
    if (templates.error) void templates.refetch()
    if (allowList.error) void allowList.refetch()
  }

  const grantButton = (
    <Button onClick={() => setGranting(true)} disabled={licenses.data === undefined}>
      <UserPlus className="h-4 w-4" />
      Grant licence
    </Button>
  )

  return (
    <div className="space-y-6">
      <TabHeader
        title="Holders"
        description="Everyone who holds a licence for this app, and the environment each one runs on."
        action={rows.length > 0 && grantButton}
      />
      {licenses.isPending ? (
        <TabSkeleton rows={4} label="Loading holders" />
      ) : licenses.error ? (
        <TabError error={licenses.error} onRetry={() => void licenses.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Users} title="Nobody holds a licence yet" action={grantButton}>
          Grant one yourself, or create an invite code and share its link.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {environments.error && environments.data === undefined && (
            <p role="alert" className="text-muted-foreground flex flex-wrap items-center gap-2 text-sm">
              Environments did not load, so they are not shown below.
              <Button size="sm" variant="outline" onClick={() => void environments.refetch()}>
                Try again
              </Button>
            </p>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" aria-hidden />
              <Input
                aria-label="Search holders"
                placeholder="Search by address or project"
                className="pl-9"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as LicenseFilter)}>
              <SelectTrigger aria-label="Status" className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_FILTERS.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f === 'ALL' ? 'All statuses' : licenseStatusMeta(f).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger aria-label="Plan filter" className="w-full sm:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PLANS}>All plans</SelectItem>
                {termList.map((t) => (
                  <SelectItem key={t.id} value={t.kind}>
                    {termName(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {shown.length === 0 ? (
            <p className="text-muted-foreground border-border rounded-xl border border-dashed py-10 text-center text-sm">
              No holders match these filters.
            </p>
          ) : (
            <HoldersTable
              rows={shown}
              terms={termList}
              modeOf={modeOf}
              environmentsUnavailable={environments.data === undefined}
              onChangePlan={setChanging}
              onRevoke={setRevoking}
            />
          )}
        </div>
      )}

      <AllowListCard
        appId={appId}
        entries={allowList.data}
        error={allowList.error}
        onRetry={() => void allowList.refetch()}
      />

      <GrantDialog
        appId={appId}
        open={granting}
        onOpenChange={setGranting}
        licenses={licenses.data ?? []}
        terms={termList}
        templates={templateList}
        allowList={allowList.data ?? []}
        loadError={grantLoadError}
        loadFailed={!!plansError || !!allowList.error}
        onRetry={retryGrantData}
      />
      <ChangePlanDialog
        appId={appId}
        license={changing}
        terms={termList}
        plansUnavailable={!!terms.error || terms.isPending}
        modeOf={modeOf}
        onClose={() => setChanging(null)}
      />
      <RevokeDialog
        appId={appId}
        license={revoking}
        mode={revoking ? modeOf(revoking.kind) : null}
        onClose={() => setRevoking(null)}
      />
    </div>
  )
}
