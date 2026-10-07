'use client'

import React, { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useMyApps } from '../hooks/use-publisher'
import { describePublisherError } from '../graphql'
import { TiersTab } from './tiers-tab'
import { HoldersTab } from './holders-tab'
import { EnvironmentsTab } from './environments-tab'

const TABS = ['tiers', 'holders', 'environments'] as const
type TabKey = (typeof TABS)[number]

export default function PublisherDashboard() {
  const apps = useMyApps()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const list = apps.data ?? []
  const [selected, setSelected] = useState<string | null>(null)
  // Derived, so appId is always a member of the list: a stale selection (app removed,
  // wallet switched) falls back to a default instead of leaving the tabs on a dead id.
  // The default prefers an ACTIVE app: every publisher resolver refuses an app whose
  // status is not ACTIVE, so defaulting to a freshly registered PENDING_IDENTITY app
  // would error all three tabs at once — and with a single app there is no picker to
  // escape with.
  const fallback = list.find((a) => a.status === 'ACTIVE') ?? list[0]
  const current = list.find((a) => a.id === selected) ?? fallback
  const appId = current?.id ?? null

  const tab = useMemo<TabKey>(() => {
    const raw = params.get('tab')
    return (TABS as readonly string[]).includes(raw ?? '') ? (raw as TabKey) : 'tiers'
  }, [params])

  const setTab = (next: string) => {
    const qs = new URLSearchParams(params.toString())
    if (next === 'tiers') qs.delete('tab')
    else qs.set('tab', next)
    const s = qs.toString()
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false })
  }

  if (apps.isPending) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-16">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your apps…
      </div>
    )
  }

  if (apps.error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load your apps</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center gap-3">
          {describePublisherError(apps.error)}
          <Button size="sm" variant="outline" onClick={() => void apps.refetch()} disabled={apps.isRefetching}>
            <RefreshCw className={apps.isRefetching ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  if (list.length === 0) {
    return (
      <div className="border-border rounded-xl border border-dashed p-10 text-center">
        <h2 className="text-lg font-semibold">No apps yet</h2>
        <p className="text-muted-foreground mt-2 text-sm">
          Licensing is managed per app. Register an app first, then come back to define tiers and grant licences.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {list.length > 1 && (
        <Select value={appId ?? undefined} onValueChange={setSelected}>
          <SelectTrigger className="w-72"><SelectValue placeholder="Choose an app" /></SelectTrigger>
          <SelectContent>
            {list.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.status === 'ACTIVE' ? a.name : `${a.name} — ${a.status.toLowerCase().replace(/_/g, ' ')}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {current && current.status !== 'ACTIVE' && (
        <Alert variant="destructive">
          <AlertTitle>Licensing is unavailable for {current.name}</AlertTitle>
          <AlertDescription>
            This app is {current.status.toLowerCase().replace(/_/g, ' ')}. Licensing needs an app whose identity
            delegation is active, so tiers, holders and environments cannot be managed until it is.
          </AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="tiers">Tiers</TabsTrigger>
          <TabsTrigger value="holders">Holders</TabsTrigger>
          <TabsTrigger value="environments">Environments</TabsTrigger>
        </TabsList>
        <TabsContent value="tiers">{appId && <TiersTab appId={appId} />}</TabsContent>
        <TabsContent value="holders">{appId && <HoldersTab appId={appId} />}</TabsContent>
        <TabsContent value="environments">{appId && <EnvironmentsTab appId={appId} />}</TabsContent>
      </Tabs>
    </div>
  )
}
