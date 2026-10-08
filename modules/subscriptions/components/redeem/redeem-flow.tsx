'use client'

import { useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { ArrowRight, Loader2, Server, Ticket, Users, XCircle } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { describePublisherError, isPublisherError } from '@/modules/publisher/graphql'
import { useOpenLogin } from '@/modules/shared/components/renown/login-modal-context'
import { Alert, AlertDescription, AlertTitle } from '@/modules/shared/components/ui/alert'
import { Button } from '@/modules/shared/components/ui/button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/modules/shared/components/ui/radio-group'
import { Skeleton } from '@/modules/shared/components/ui/skeleton'
import {
  useInviteCodeCheck,
  useMySubscriptions,
  useRedeemInviteCode,
} from '../../hooks/use-subscriptions'
import { redeemInput, type RedeemChoice } from '../../lib/redeem'
import { defaultRedeemChoice, NEW_CHOICE, offersNew, redeemOptions } from '../../lib/redeem-options'
import { subscriptionHref, subscriptionName } from '../../lib/subscriptions'
import { RedeemSteps } from './redeem-steps'

const NEW = NEW_CHOICE

/** `step` null: login state is not known yet, so no step is claimed. */
function Shell({ step, children }: { step: 1 | 2 | 3 | null; children: ReactNode }) {
  return (
    <div className="bg-card border-border space-y-6 rounded-2xl border p-6 shadow-sm sm:p-8">
      {step === null ? (
        <Skeleton className="h-6 w-56 max-w-full" aria-hidden />
      ) : (
        <RedeemSteps current={step} />
      )}
      {children}
    </div>
  )
}

export function RedeemFlow({ code }: { code: string }) {
  const check = useInviteCodeCheck(code)
  const { state } = useRenownAuthAsync()
  const openLogin = useOpenLogin()
  const subs = useMySubscriptions()
  const redeem = useRedeemInviteCode()
  const router = useRouter()
  // null = not chosen yet, so the default applies (see defaultRedeemChoice): renewing the plan
  // they hold, never switching a live licence to another plan without an explicit choice.
  const [picked, setPicked] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [error, setError] = useState<unknown>(null)
  // Set once redeem succeeds: the button stays off until the route changes.
  const [done, setDone] = useState(false)
  const choose = (value: string) => {
    setPicked(value)
    setError(null)
  }

  if (check.isPending) {
    return (
      <Shell step={1}>
        <div role="status" aria-label="Checking your code" className="space-y-3">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Shell>
    )
  }

  // A failed lookup says nothing about the code: offer a retry, never "invalid".
  if (check.error || !check.data) {
    return (
      <Shell step={1}>
        <div className="space-y-4 text-center">
          <XCircle className="text-destructive mx-auto h-10 w-10" aria-hidden />
          <h1 className="text-xl font-semibold">We couldn’t check this code</h1>
          <p className="text-muted-foreground text-sm">
            {check.error ? describePublisherError(check.error) : 'Something went wrong.'} Your code
            has not been used.
          </p>
          <Button variant="outline" onClick={() => void check.refetch()}>
            Try again
          </Button>
        </div>
      </Shell>
    )
  }

  if (!check.data.valid) {
    return (
      <Shell step={1}>
        <div className="space-y-4 text-center">
          <XCircle className="text-destructive mx-auto h-10 w-10" aria-hidden />
          <h1 className="text-xl font-semibold">This code can’t be used</h1>
          <p className="text-muted-foreground text-sm">
            It may be mistyped, paused, expired or used up. Check the link you were sent, or ask
            whoever shared it.
          </p>
          <Button asChild variant="outline">
            <Link href="/redeem">Try another code</Link>
          </Button>
        </div>
      </Shell>
    )
  }

  const info = check.data
  const dedicated = info.mode === 'DEDICATED'
  const authenticated = state === 'authenticated'
  const options = redeemOptions(subs.data ?? [], info)
  const showNew = offersNew(options, info.mode)
  const choice = picked ?? defaultRedeemChoice(options, info.mode)
  const redeemChoice: RedeemChoice | null =
    choice === null ? null : choice === NEW ? 'new' : { upgrades: choice }
  const needsName = dedicated && choice === NEW

  const hero = (
    <div className="space-y-2">
      <p className="text-muted-foreground inline-flex items-center gap-1.5 text-sm">
        <Ticket className="h-4 w-4" aria-hidden />
        Invite code <span className="text-foreground font-mono">{code}</span>
      </p>
      <h1 className="text-3xl font-bold tracking-tight">{info.appName}</h1>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 font-medium">
          {info.termLabel || info.kind}
        </span>
        <span className="text-muted-foreground inline-flex items-center gap-1.5">
          {dedicated ? (
            <Server className="h-4 w-4" aria-hidden />
          ) : (
            <Users className="h-4 w-4" aria-hidden />
          )}
          {dedicated ? 'Your own environment' : `An account on ${info.appName}`}
        </span>
      </div>
    </div>
  )

  // Until login state is known, claim no step: showing "Log in" and then jumping to "Set up"
  // reads as a glitch.
  if (state === 'resolving') {
    return (
      <Shell step={null}>
        {hero}
        <div
          className="border-border space-y-3 border-t pt-6"
          role="status"
          aria-label="Checking your login"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-10 w-44" />
        </div>
      </Shell>
    )
  }

  if (!authenticated) {
    return (
      <Shell step={2}>
        {hero}
        <div className="border-border space-y-3 border-t pt-6">
          <p className="text-muted-foreground text-sm">
            Log in with Renown to claim it. No wallet needed in advance.
          </p>
          <Button size="lg" onClick={openLogin}>
            Log in with Renown
          </Button>
        </div>
      </Shell>
    )
  }

  // Wait for the licences we hold: offering "start something new" first and then
  // flipping to "upgrade" would be a trap. A failed lookup gets a retry, not a guess.
  if (subs.isPending || subs.error) {
    return (
      <Shell step={3}>
        {hero}
        <div className="border-border space-y-3 border-t pt-6">
          {subs.error ? (
            <>
              <p className="text-muted-foreground text-sm">
                We couldn’t load your subscriptions. {describePublisherError(subs.error)}
              </p>
              <Button variant="outline" onClick={() => void subs.refetch()}>
                Try again
              </Button>
            </>
          ) : (
            <div role="status" aria-label="Checking what you already have" className="space-y-3">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-11 w-full" />
            </div>
          )}
        </div>
      </Shell>
    )
  }

  const submit = async () => {
    if (!redeemChoice) return
    setError(null)
    try {
      const sub = await redeem.mutateAsync(
        redeemInput({ code, choice: redeemChoice, label, mode: info.mode }),
      )
      setDone(true)
      toast.success(`${subscriptionName(sub)} is yours`)
      router.push(subscriptionHref(sub.licenseId))
    } catch (err) {
      setError(err)
    }
  }

  return (
    <Shell step={3}>
      {hero}
      <div className="border-border space-y-5 border-t pt-6">
        {options.length > 0 && (
          <div className="space-y-2">
            <Label>You already have {info.appName}</Label>
            {choice === null && (
              <p className="text-muted-foreground text-xs">Choose what this code should do.</p>
            )}
            <RadioGroup value={choice ?? ''} onValueChange={choose} className="space-y-2">
              {options.map((o) => (
                <label
                  key={o.licenseId}
                  className="border-border has-[[data-state=checked]]:border-primary flex cursor-pointer items-start gap-3 rounded-xl border p-3"
                >
                  <RadioGroupItem
                    value={o.licenseId}
                    aria-label={o.title}
                    className="border-muted-foreground/50 data-[state=checked]:border-primary mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium">{o.title}</span>
                    <span className="text-muted-foreground block text-xs">{o.detail}</span>
                  </span>
                </label>
              ))}
              {showNew && (
                <label className="border-border has-[[data-state=checked]]:border-primary flex cursor-pointer items-start gap-3 rounded-xl border p-3">
                  <RadioGroupItem
                    value={NEW}
                    aria-label="Start something new"
                    className="border-muted-foreground/50 data-[state=checked]:border-primary mt-1"
                  />
                  <span>
                    <span className="block text-sm font-medium">Start something new</span>
                    <span className="text-muted-foreground block text-xs">
                      {dedicated
                        ? 'A second environment, for a different project.'
                        : 'Keep what you have and add this.'}
                    </span>
                  </span>
                </label>
              )}
            </RadioGroup>
          </div>
        )}
        {needsName && (
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="e.g. Acme research"
              value={label}
              maxLength={60}
              onChange={(e) => {
                setLabel(e.target.value)
                setError(null)
              }}
            />
            <p className="text-muted-foreground text-xs">
              Your environment is called this. You can have several.
            </p>
          </div>
        )}
        {error !== null && (
          <Alert variant={isPublisherError(error, 'ALREADY_HOLDS') ? 'default' : 'destructive'}>
            <AlertTitle>
              {isPublisherError(error, 'ALREADY_HOLDS')
                ? 'You already have this plan'
                : isPublisherError(error, 'INVALID_CODE')
                  ? 'This code can’t be used any more'
                  : 'That did not work'}
            </AlertTitle>
            <AlertDescription className="space-y-2">
              {isPublisherError(error, 'ALREADY_HOLDS') ? (
                <>
                  <p>Nothing to renew.</p>
                  <Link
                    href="/user/subscriptions"
                    className="text-primary block font-medium hover:underline"
                  >
                    See your subscriptions
                  </Link>
                </>
              ) : (
                <p>{describePublisherError(error)}</p>
              )}
            </AlertDescription>
          </Alert>
        )}
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => void submit()}
          disabled={redeem.isPending || done || !redeemChoice || (needsName && !label.trim())}
        >
          {redeem.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Get access
          {!redeem.isPending && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>
    </Shell>
  )
}
