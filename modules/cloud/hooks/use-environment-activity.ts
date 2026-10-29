'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import { useEnvironments } from '@/modules/cloud/hooks/use-environment'
import {
  environmentActivity,
  transitionMessage,
  type ActivityEnvironment,
} from '@/modules/cloud/lib/activity'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'

/**
 * The environment list the console watches: the active organisation's (or the
 * user's own). Shares the env list query with the dashboard, so it adds no
 * polling of its own.
 */
function useConsoleEnvironments() {
  const { orgId } = useActiveOrg()
  const { environments, isPending, isError, isFetchedAfterMount } = useEnvironments('MINE', null, {
    orgId,
  })
  // A list restored from the persisted cache may be from an earlier visit;
  // only a list fetched in this session counts as a baseline.
  return { environments, loaded: !isPending && !isError && isFetchedAfterMount, orgId }
}

/** Environments currently deploying, syncing or terminating. */
export function useEnvironmentsInMotion(): ActivityEnvironment[] {
  const { environments } = useConsoleEnvironments()
  return useMemo(() => environmentActivity(null, environments).inMotion, [environments])
}

/**
 * Toasts each environment that finishes moving while the console is open:
 * "acme-prod is ready" / "acme-prod failed to deploy". The first list seen (and
 * the first after an organisation switch) only sets the baseline.
 */
export function useEnvironmentTransitionToasts() {
  const router = useRouter()
  const { environments, loaded, orgId } = useConsoleEnvironments()
  const previous = useRef<{ orgId: string | null; list: CloudEnvironment[] } | null>(null)

  useEffect(() => {
    if (!loaded) return
    const baseline = previous.current?.orgId === orgId ? previous.current.list : null
    previous.current = { orgId, list: environments }
    if (!baseline) return
    for (const t of environmentActivity(baseline, environments).finished) {
      const show = t.outcome === 'success' ? toast.success : toast.error
      show(transitionMessage(t), {
        id: `env-activity-${t.id}`,
        action: { label: 'Open', onClick: () => router.push(`/user/environments/${t.id}`) },
      })
    }
  }, [environments, loaded, orgId, router])
}
