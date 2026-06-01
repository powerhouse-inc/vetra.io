'use client'

import {
  ArrowDownCircle,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  History,
  Loader2,
  Zap,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { fetchEnvironmentReleaseHistory, fetchLatestRelease } from '@/modules/cloud/graphql'
import { useOptimistic } from '@/modules/cloud/hooks/use-optimistic'
import type {
  AutoUpdateChannel,
  CloudEnvironment,
  ReleaseHistoryEntry,
  ReleaseIndexEntry,
  TenantService,
} from '@/modules/cloud/types'
import { Badge } from '@/modules/shared/components/ui/badge'
import { Button } from '@/modules/shared/components/ui/button'
import { Card, CardContent, CardTitle } from '@/modules/shared/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/modules/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'
import { EVENTS, useAnalytics } from '@/shared/analytics'

const CHANNEL_OPTIONS: { value: AutoUpdateChannel | 'OFF'; label: string; description: string }[] =
  [
    { value: 'OFF', label: 'Off', description: 'No auto-updates' },
    { value: 'DEV', label: 'Dev', description: 'Every push to main' },
    { value: 'STAGING', label: 'Staging', description: 'Pre-release candidates' },
    { value: 'LATEST', label: 'Latest', description: 'Stable production tag' },
  ]

const SERVICE_LABELS: Record<TenantService, string> = {
  CONNECT: 'Connect',
  SWITCHBOARD: 'Switchboard',
}

/** Human-readable relative time (e.g. "2m ago"). Keeps us off date-fns. */
function timeAgo(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const s = Math.max(1, Math.round(delta / 1000))
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.round(h / 24)
  return `${d}d ago`
}

type AutoUpdateCardProps = {
  environment: CloudEnvironment
  onChangeChannel: (channel: AutoUpdateChannel | null) => Promise<void>
  onUpdateNow: () => Promise<string[]>
  onRollback: () => Promise<string[]>
}

export function AutoUpdateCard({
  environment,
  onChangeChannel,
  onUpdateNow,
  onRollback,
}: AutoUpdateCardProps) {
  const { track } = useAnalytics()
  const state = environment.state
  const serverChannel: AutoUpdateChannel | null = state.autoUpdateChannel ?? null

  // Channel flips instantly via the optimistic hook; reverts on error.
  const {
    value: channel,
    set: commitChannel,
    isPending: isChannelPending,
  } = useOptimistic(serverChannel, onChangeChannel)

  const handleChannelChange = async (next: AutoUpdateChannel | 'OFF') => {
    // Block further clicks while the mutation is in flight — stacking
    // commits races the controller.push() queue and makes the radios
    // visibly stutter between the previous committed value and the new
    // optimistic one. Ignoring late clicks is less surprising than
    // watching the selection bounce.
    if (isChannelPending) return
    const nextChannel = next === 'OFF' ? null : next
    if (nextChannel === channel) return
    try {
      await commitChannel(nextChannel)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to set auto-update channel')
    }
  }

  // Latest release per enabled service — only fetched once a channel is picked,
  // so we don't hammer the subgraph for envs with auto-update off.
  const enabledServices = state.services
    .filter((s) => s.enabled && (s.type === 'CONNECT' || s.type === 'SWITCHBOARD'))
    .map((s) => ({ type: s.type as TenantService, version: s.version }))

  const [latestByService, setLatestByService] = useState<
    Record<TenantService, ReleaseIndexEntry | null>
  >({} as Record<TenantService, ReleaseIndexEntry | null>)

  const channelRef = useRef(channel)
  channelRef.current = channel

  useEffect(() => {
    if (!channel) return
    let cancelled = false
    void (async () => {
      const entries: [TenantService, ReleaseIndexEntry | null][] = []
      for (const svc of enabledServices) {
        try {
          const row = await fetchLatestRelease(channel, svc.type)
          entries.push([svc.type, row])
        } catch {
          entries.push([svc.type, null])
        }
      }
      if (cancelled || channelRef.current !== channel) return
      setLatestByService(
        entries.reduce(
          (acc, [k, v]) => {
            acc[k] = v
            return acc
          },
          {} as Record<TenantService, ReleaseIndexEntry | null>,
        ),
      )
    })()
    return () => {
      cancelled = true
    }
    // enabledServices is derived from state and already covered by `channel`
    // as a dependency via the channel-change re-fetch; intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel])

  // Release history feed — refetched when the env's service versions move
  // (a bump lands, a rollback happens, etc.).
  const [history, setHistory] = useState<ReleaseHistoryEntry[]>([])
  const versionFingerprint = enabledServices.map((s) => `${s.type}:${s.version ?? ''}`).join('|')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const rows = await fetchEnvironmentReleaseHistory(environment.id, 10)
        if (!cancelled) setHistory(rows)
      } catch {
        // non-fatal — feed just stays stale
      }
    })()
    return () => {
      cancelled = true
    }
  }, [environment.id, versionFingerprint])

  const [isUpdating, setIsUpdating] = useState(false)
  const handleUpdateNow = useCallback(async () => {
    setIsUpdating(true)
    try {
      const updated = await onUpdateNow()
      if (updated.length > 0) {
        track(EVENTS.cloudDeploy, { environmentId: environment.id, services: updated })
        toast.success('Updating to latest — argo will roll the pod in a few seconds')
      } else {
        toast.info('Already on the latest tag')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('NO_CHANNEL')) {
        toast.error('Pick a channel first')
      } else if (msg.includes('NO_RELEASE_KNOWN')) {
        toast.error('No release observed for this channel yet')
      } else {
        toast.error(msg)
      }
    } finally {
      setIsUpdating(false)
    }
  }, [onUpdateNow, track, environment.id])

  const [isRollingBack, setIsRollingBack] = useState(false)
  const handleRollback = useCallback(async () => {
    setIsRollingBack(true)
    try {
      const rolled = await onRollback()
      if (rolled.length > 0) {
        toast.success('Rolling back to previous tag')
      } else {
        toast.info('No prior version to roll back to')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('NO_PRIOR_RELEASE')) {
        toast.error('No prior version recorded for any enabled service')
      } else {
        toast.error(msg)
      }
    } finally {
      setIsRollingBack(false)
    }
  }, [onRollback])

  const hasHistory = history.length > 0

  // Collapsed by default — the card is useful but not essential for most
  // envs, and rendering a radio group + per-service rows + activity feed
  // pushes the surrounding sections down. Auto-open when the env actually
  // has a channel set so the owner sees the state at a glance.
  const [isOpen, setIsOpen] = useState<boolean>(serverChannel !== null)
  const serverChannelRef = useRef(serverChannel)
  useEffect(() => {
    // If another writer flips the channel on (e.g. programmatic opt-in),
    // expand the card so the owner sees what happened. Manual collapse
    // from an open state is preserved — we only auto-open, never
    // auto-close.
    if (serverChannel && !serverChannelRef.current) setIsOpen(true)
    serverChannelRef.current = serverChannel
  }, [serverChannel])

  const summaryBadge = channel ? (
    <Badge variant="secondary" className="font-mono text-[10px]">
      {channel.toLowerCase()}
    </Badge>
  ) : (
    <Badge variant="outline" className="text-[10px]">
      off
    </Badge>
  )

  return (
    <Card>
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        aria-expanded={isOpen}
        className="hover:bg-muted/30 flex w-full items-center justify-between rounded-t-xl px-6 py-4 text-left transition-colors"
      >
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4" />
          Auto-Update
          {summaryBadge}
          {isChannelPending && (
            <Loader2 className="text-muted-foreground h-3.5 w-3.5 animate-spin" />
          )}
        </CardTitle>
        {isOpen ? (
          <ChevronDown className="text-muted-foreground h-4 w-4" />
        ) : (
          <ChevronRight className="text-muted-foreground h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <CardContent className="space-y-5">
          {/* Channel picker */}
          <div>
            <label className="text-muted-foreground mb-2 block text-sm font-medium">Channel</label>
            <RadioGroup
              value={channel ?? 'OFF'}
              onValueChange={(v) => void handleChannelChange(v as AutoUpdateChannel | 'OFF')}
              disabled={isChannelPending}
              className={cn(
                'grid grid-cols-4 gap-2',
                isChannelPending && 'pointer-events-none opacity-60',
              )}
            >
              {CHANNEL_OPTIONS.map((opt) => {
                const id = `auto-update-${opt.value.toLowerCase()}`
                const active = (channel ?? 'OFF') === opt.value
                return (
                  <label
                    key={opt.value}
                    htmlFor={id}
                    className={cn(
                      'flex flex-col gap-0.5 rounded-md border p-2 text-xs transition-colors',
                      isChannelPending ? 'cursor-wait' : 'cursor-pointer',
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border/50 hover:border-border',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={opt.value} id={id} disabled={isChannelPending} />
                      <span className="font-medium">{opt.label}</span>
                    </div>
                    <span className="text-muted-foreground pl-6 text-[10px]">
                      {opt.description}
                    </span>
                  </label>
                )
              })}
            </RadioGroup>
          </div>

          {/* Per-service current vs latest */}
          {channel && (
            <div className="space-y-2">
              <label className="text-muted-foreground block text-sm font-medium">Versions</label>
              {enabledServices.length === 0 ? (
                <p className="text-muted-foreground text-xs italic">
                  No enabled services to track.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {enabledServices.map((svc) => {
                    const latest = latestByService[svc.type]
                    const outOfDate =
                      latest !== null && latest !== undefined && svc.version !== latest.tag
                    return (
                      <div
                        key={svc.type}
                        className="border-border/40 bg-muted/20 flex items-center justify-between rounded border px-3 py-1.5 text-xs"
                      >
                        <span className="font-medium">{SERVICE_LABELS[svc.type]}</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className={cn(outOfDate && 'text-muted-foreground line-through')}>
                            {svc.version ?? '—'}
                          </span>
                          {outOfDate && latest && (
                            <>
                              <ArrowUpCircle className="h-3 w-3 text-emerald-500" />
                              {latest.releaseUrl ? (
                                <a
                                  href={latest.releaseUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary hover:underline"
                                >
                                  {latest.tag}
                                </a>
                              ) : (
                                <span className="text-primary">{latest.tag}</span>
                              )}
                            </>
                          )}
                          {!outOfDate && latest && (
                            <Badge variant="outline" className="text-[9px]">
                              up to date
                            </Badge>
                          )}
                          {!latest && (
                            <Badge variant="outline" className="text-[9px]">
                              no release seen
                            </Badge>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleUpdateNow}
                  disabled={isUpdating}
                  className="gap-1.5"
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  {isUpdating ? 'Updating...' : 'Update now'}
                </Button>
                {hasHistory && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRollback}
                    disabled={isRollingBack}
                    className="gap-1.5"
                  >
                    <ArrowDownCircle className="h-3.5 w-3.5" />
                    {isRollingBack ? 'Rolling back...' : 'Rollback'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Release history feed */}
          {hasHistory && (
            <div>
              <div className="text-muted-foreground mb-2 flex items-center gap-1.5 text-sm font-medium">
                <History className="h-3.5 w-3.5" />
                Recent activity
              </div>
              <div className="space-y-1">
                {history.map((h) => (
                  <div
                    key={h.documentId + h.service + h.at}
                    className="border-border/30 flex items-center justify-between gap-3 rounded border px-3 py-1.5 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Badge
                        variant={
                          h.trigger === 'ROLLBACK'
                            ? 'destructive'
                            : h.trigger === 'MANUAL'
                              ? 'default'
                              : 'secondary'
                        }
                        className="shrink-0 text-[9px]"
                      >
                        {h.trigger}
                      </Badge>
                      <span className="text-muted-foreground shrink-0">
                        {SERVICE_LABELS[h.service]}
                      </span>
                      <span className="truncate font-mono">
                        {h.fromTag ?? '—'} → {h.toTag}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-muted-foreground">{timeAgo(h.at)}</span>
                      {h.releaseUrl && (
                        <a
                          href={h.releaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          aria-label="Release notes"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  )
}
