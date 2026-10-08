'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { TabError } from '@/modules/publisher/components/primitives'
import { RequireLogin } from '@/modules/shared/components/renown/require-login'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import { useStudioAccess } from '@/modules/subscriptions/hooks/use-subscriptions'
import { NoLicencePanel } from './no-licence-panel'
import { PreAlphaWarningDialog } from './pre-alpha-warning-dialog'

const PREALPHA_ACK_KEY = 'vetra_prealpha_ack'

function readAck(): boolean {
  try {
    return localStorage.getItem(PREALPHA_ACK_KEY) === '1'
  } catch {
    return true // storage blocked: do not nag on every visit
  }
}

function PreAlphaOnce() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage after mount is hydration-safe
    if (!readAck()) setOpen(true)
  }, [])
  const acknowledge = () => {
    try {
      localStorage.setItem(PREALPHA_ACK_KEY, '1')
    } catch {
      /* storage blocked */
    }
    setOpen(false)
  }
  return <PreAlphaWarningDialog open={open} onAcknowledge={acknowledge} />
}

function LicenceCheck({ children }: { children: ReactNode }) {
  const access = useStudioAccess()
  if (access.data?.allowed) {
    return (
      <>
        {children}
        <PreAlphaOnce />
      </>
    )
  }
  // A failed check is not a "no": never send a licensed user to /redeem because the network blinked.
  if (access.error) {
    return (
      <div className="mx-auto mt-28 max-w-lg px-6">
        <TabError error={access.error} onRetry={() => void access.refetch()} retrying={access.isRefetching} />
      </div>
    )
  }
  if (access.isPending || access.data == null) {
    return (
      <div role="status" aria-label="Checking your studio access" className="mx-auto mt-28 max-w-4xl space-y-4 px-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }
  return <NoLicencePanel />
}

/** Gates Vetra Studio and app creation on a vetra-studio licence (decision D2). */
export function StudioLicenseGate({ children }: { children: ReactNode }) {
  return (
    <RequireLogin title="Log in to use Vetra Studio">
      <LicenceCheck>{children}</LicenceCheck>
    </RequireLogin>
  )
}
