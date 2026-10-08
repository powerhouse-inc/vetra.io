'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { RefreshCw } from 'lucide-react'
import { TabError } from '@/modules/publisher/components/primitives'
import { Button } from '@/modules/shared/components/ui/button'
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

function LicenceCheck({ children, notAllowed }: { children: ReactNode; notAllowed?: ReactNode }) {
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
        <TabError
          error={access.error}
          onRetry={() => void access.refetch()}
          retrying={access.isRefetching}
        />
      </div>
    )
  }
  // No answer for about a minute (usually no login token): say so instead of loading forever.
  if (access.timedOut) {
    return (
      <div className="mx-auto mt-28 max-w-lg px-6">
        <div
          role="alert"
          className="border-border bg-card flex flex-col items-center gap-3 rounded-xl border px-6 py-10 text-center"
        >
          <p className="text-sm font-semibold">We couldn’t check your studio access</p>
          <p className="text-muted-foreground max-w-md text-sm">
            Your login may not have finished. Try again, or log out and back in.
          </p>
          <Button size="sm" variant="outline" onClick={access.retry}>
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      </div>
    )
  }
  if (access.isPending || access.data == null) {
    return (
      <div
        role="status"
        aria-label="Checking your studio access"
        className="mx-auto mt-28 max-w-4xl space-y-4 px-6"
      >
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    )
  }
  return notAllowed ?? <NoLicencePanel />
}

/**
 * Gates Vetra Studio and app creation on a vetra-studio licence (decision D2). `notAllowed`
 * replaces the "redeem a code" panel for pages that still show something without a licence.
 */
export function StudioLicenseGate({
  children,
  notAllowed,
}: {
  children: ReactNode
  notAllowed?: ReactNode
}) {
  return (
    <RequireLogin title="Log in to use Vetra Studio">
      <LicenceCheck notAllowed={notAllowed}>{children}</LicenceCheck>
    </RequireLogin>
  )
}
