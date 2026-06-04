'use client'

import { useEffect, useState } from 'react'
import { useRenownAuth } from '@powerhousedao/reactor-browser'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Key,
  Loader2,
  Mail,
  MessageCircle,
  Terminal,
} from 'lucide-react'
import { BEARER_TOKEN_TTL_SECONDS, PENDING_CODE_KEY } from '@/modules/invites/lib/constants'

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; body: unknown }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json: unknown = await res.json().catch(() => ({}))
    return { ok: res.ok, body: json }
  } catch {
    return { ok: false, body: {} }
  }
}

/** The Renown bearer token (a DID-JWT), verified server-side to identify the user on redeem. */
async function getRenownToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null
  const renown = (
    window as unknown as {
      ph?: { renown?: { getBearerToken: (o: { expiresIn: number }) => Promise<string | null> } }
    }
  ).ph?.renown
  if (!renown) return null
  try {
    return await renown.getBearerToken({ expiresIn: BEARER_TOKEN_TTL_SECONDS })
  } catch {
    return null
  }
}

// Drop the two screenshots into public/images/studio/ with these exact filenames:
//   vetra-studio-1.png — workout tracker session (shown first)
//   vetra-studio-2.png — sessions list (shown after click)
const SLIDE_1 = '/images/studio/Vetra-studio-1.png'
const SLIDE_2 = '/images/studio/Vetra-studio-2.png'

const DISCORD_URL = 'https://discord.gg/Py28EMafEr'
const CURL_CMD = 'curl -fsSL https://get.vetra.io | sh'

// Replace with public/images/studio/vetra-studio-session.png once committed
const BACKDROP = '/images/home/stack-connect-app.png'

type Step = 'gate' | 'login' | 'granted'

export function EarlyAccessGate() {
  const auth = useRenownAuth()
  const [step, setStep] = useState<Step>('gate')
  const [slide, setSlide] = useState<1 | 2>(1)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [working, setWorking] = useState(false)

  // After a Renown login completes (same tab, ?user=… redirect), finish the
  // flow: redeem a pending code, or recognise a returning user who's already in.
  useEffect(() => {
    if (auth.status !== 'authorized' || step === 'granted') return
    let cancelled = false

    const finalize = async () => {
      setWorking(true)
      try {
        const token = await getRenownToken()
        if (!token) return

        const pending = sessionStorage.getItem(PENDING_CODE_KEY)
        if (pending) {
          const redeemed = await postJson('/api/invite/redeem', { code: pending, token })
          if (redeemed.ok && (redeemed.body as { ok?: boolean }).ok) {
            sessionStorage.removeItem(PENDING_CODE_KEY)
            if (!cancelled) setStep('granted')
            return
          }
          // Redeem failed — keep the pending code so a reload can retry, and
          // fall through to the status check.
        }

        // No pending code (or it failed) — maybe they're already a redeemed user.
        const status = await postJson('/api/invite/status', { token })
        if (!cancelled && status.ok && (status.body as { allowed?: boolean }).allowed) {
          setStep('granted')
        }
      } finally {
        if (!cancelled) setWorking(false)
      }
    }

    void finalize()
    return () => {
      cancelled = true
    }
  }, [auth.status, step])

  const handleGetAccess = async () => {
    const entered = code.trim()
    if (!entered || working) return
    setWorking(true)
    setError('')
    try {
      const res = await postJson('/api/invite/validate', { code: entered })
      const valid = res.ok && (res.body as { valid?: boolean }).valid
      if (!valid) {
        setError('Invalid invite code. Please try again.')
        return
      }

      // Already logged in → redeem now. Otherwise stash the code and send them
      // through Renown login; the effect above redeems when they return.
      if (auth.status === 'authorized') {
        const token = await getRenownToken()
        if (token) {
          const redeemed = await postJson('/api/invite/redeem', { code: entered, token })
          if (redeemed.ok && (redeemed.body as { ok?: boolean }).ok) {
            setStep('granted')
            return
          }
        }
        setError('Could not grant access. Please try again.')
        return
      }

      sessionStorage.setItem(PENDING_CODE_KEY, entered)
      setStep('login')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setWorking(false)
    }
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(CURL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Granted — full-screen slide reveal, no backdrop
  if (step === 'granted') {
    return (
      <div
        className={`relative h-screen w-screen overflow-hidden bg-white ${slide === 1 ? 'cursor-pointer' : ''}`}
        onClick={slide === 1 ? () => setSlide(2) : undefined}
      >
        <Image
          src={SLIDE_1}
          alt="Vetra Studio — session view"
          fill
          className={`object-contain object-top transition-opacity duration-500 ${slide === 1 ? 'opacity-100' : 'opacity-0'}`}
          priority
        />
        <Image
          src={SLIDE_2}
          alt="Vetra Studio — sessions list"
          fill
          className={`object-contain object-top transition-opacity duration-500 ${slide === 2 ? 'opacity-100' : 'opacity-0'}`}
        />

        {slide === 1 && (
          <div className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-black/40 px-4 py-2 text-xs text-white/80 backdrop-blur-sm">
              Click anywhere to continue
            </span>
          </div>
        )}

        {slide === 2 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <Link
              href="/"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full bg-black/40 px-4 py-2 text-xs text-white/80 backdrop-blur-sm transition-colors hover:text-white"
            >
              ← Back to vetra.to
            </Link>
          </div>
        )}
      </div>
    )
  }

  // While the initial auth check runs, or while we finalize a redemption after
  // login, show a splash instead of flashing the gate form.
  const finalizing = auth.status === 'authorized' && working
  if (auth.status === 'loading' || auth.status === 'checking' || finalizing) {
    return (
      <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <Image src={BACKDROP} alt="" fill className="object-contain object-top" priority />
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
        </div>
        <div className="relative z-10 flex items-center gap-3 text-sm text-white/90">
          <Loader2 className="h-5 w-5 animate-spin" />
          Setting up your access…
        </div>
      </div>
    )
  }

  // Gate + login — blurred backdrop with modal
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
      {/* Backdrop */}
      <div className="absolute inset-0">
        <Image src={BACKDROP} alt="" fill className="object-contain object-top" priority />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      </div>

      <div className="relative z-10 mx-4 w-full max-w-[800px]">
        {step === 'gate' && (
          <div>
            {/* Header */}
            <div className="mb-5 text-center">
              <h2 className="text-xl font-bold text-white drop-shadow">Vetra Studio</h2>
              <p className="mt-1 text-sm text-white/70">
                Early access — choose how you&apos;d like to get started.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Left column — have code / don't have code */}
              <div className="flex flex-col gap-4">
                {/* Card: I have a code */}
                <div className="bg-card border-border flex flex-col gap-4 rounded-2xl border p-5 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/15 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <Key className="text-primary h-3.5 w-3.5" />
                    </div>
                    <p className="text-foreground text-sm font-semibold">I have an invite code</p>
                  </div>
                  <p className="text-muted-foreground -mt-2 text-xs leading-relaxed">
                    Enter your code for immediate access to Vetra Cloud environments.
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <input
                        value={code}
                        onChange={(e) => {
                          setCode(e.target.value)
                          setError('')
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleGetAccess()
                        }}
                        disabled={working}
                        placeholder="Enter invite code"
                        className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/40 h-9 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none disabled:opacity-60"
                      />
                      <button
                        onClick={() => void handleGetAccess()}
                        disabled={working}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-lg px-4 text-sm font-semibold transition-colors disabled:opacity-60"
                      >
                        {working ? 'Checking…' : 'Get Access'}
                      </button>
                    </div>
                    {error && <p className="text-destructive text-xs">{error}</p>}
                  </div>
                </div>

                {/* Card: I don't have a code */}
                <div className="bg-card border-border flex flex-col gap-4 rounded-2xl border p-5 shadow-2xl">
                  <div className="flex items-center gap-2">
                    <div className="bg-primary/15 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <Mail className="text-primary h-3.5 w-3.5" />
                    </div>
                    <p className="text-foreground text-sm font-semibold">
                      I don&apos;t have a code
                    </p>
                  </div>
                  <p className="text-muted-foreground -mt-2 text-xs leading-relaxed">
                    Join the waitlist to be first in line when we open up more spots.
                  </p>
                  <form
                    action="https://gmail.us21.list-manage.com/subscribe/post?u=a65ca7e437961008f5f5c1bad&id=c8ea339c46&f_id=00fda7e6f0"
                    method="post"
                    target="_blank"
                    className="flex gap-2"
                  >
                    <input
                      type="email"
                      name="EMAIL"
                      required
                      placeholder="you@example.com"
                      className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/40 h-9 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-lg px-4 text-sm font-semibold transition-colors"
                    >
                      Subscribe
                    </button>
                  </form>
                  <div className="flex items-center gap-3">
                    <div className="border-border flex-1 border-t" />
                    <span className="text-muted-foreground text-xs">or</span>
                    <div className="border-border flex-1 border-t" />
                  </div>
                  <Link
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-border hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Request a code on Discord
                  </Link>
                </div>
              </div>

              {/* Right card — Run it locally */}
              <div className="bg-card border-border flex flex-col gap-4 rounded-2xl border p-5 shadow-2xl">
                <div className="flex items-center gap-2">
                  <div className="bg-primary/15 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                    <Terminal className="text-primary h-3.5 w-3.5" />
                  </div>
                  <p className="text-foreground text-sm font-semibold">Run it locally</p>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  No code needed. Spin up your own Vetra Cloud instance on your machine in seconds
                  with a single command.
                </p>
                <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2.5">
                  <span className="text-primary font-mono text-xs font-bold">$</span>
                  <code className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
                    {CURL_CMD}
                  </code>
                  <button
                    onClick={() => {
                      void handleCopy()
                    }}
                    className="text-muted-foreground hover:text-foreground ml-1 shrink-0 transition-colors"
                    aria-label="Copy command"
                  >
                    {copied ? (
                      <Check className="text-primary h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Runs fully on your infrastructure. Supports Docker and Kubernetes out of the box.
                  Offline-first with peer-to-peer sync.
                </p>
                <div className="border-border border-t pt-4">
                  <Link
                    href="https://academy.vetra.io/academy/MasteryTrack/BuilderEnvironment/CreateAPackageWithVetra"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-xs transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5 shrink-0" />
                    Step-by-step tutorial in the Vetra Academy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'login' && (
          <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-2xl">
            <div className="px-8 py-8 text-center">
              <div className="bg-primary/15 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full">
                <Check className="text-primary h-5 w-5" />
              </div>
              <h2 className="text-foreground text-lg font-semibold">Code accepted</h2>
              <p className="text-muted-foreground mt-2 text-sm">
                Connect your account to access Vetra Studio.
              </p>

              <div className="border-border my-6 border-t" />

              <button
                onClick={() => void auth.login()}
                disabled={working}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors disabled:opacity-60"
              >
                <Image
                  src="/logos/vetra-icon.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="opacity-90"
                />
                {working ? 'Signing you in…' : 'Continue with Renown'}
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={() => setStep('gate')}
                className="text-muted-foreground hover:text-foreground mt-3 text-sm transition-colors"
              >
                ← Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
