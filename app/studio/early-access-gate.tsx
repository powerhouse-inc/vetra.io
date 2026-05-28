'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, Check, Copy, Key, MessageCircle, Terminal } from 'lucide-react'

const VALID_CODE = 'LOCAL-FIRST'

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
  const [step, setStep] = useState<Step>('gate')
  const [slide, setSlide] = useState<1 | 2>(1)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGetAccess = () => {
    if (code.trim().toUpperCase() === VALID_CODE) {
      setError('')
      setStep('login')
    } else {
      setError('Invalid invite code. Please try again.')
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
            <span className="bg-black/40 text-white/80 rounded-full px-4 py-2 text-xs backdrop-blur-sm">
              Click anywhere to continue
            </span>
          </div>
        )}

        {slide === 2 && (
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
            <Link
              href="/"
              onClick={(e) => e.stopPropagation()}
              className="bg-black/40 text-white/80 hover:text-white rounded-full px-4 py-2 text-xs backdrop-blur-sm transition-colors"
            >
              ← Back to vetra.to
            </Link>
          </div>
        )}
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

      <div className="relative z-10 mx-4 w-full max-w-[560px]">
        {step === 'gate' && (
          <div className="bg-card border-border overflow-hidden rounded-2xl border shadow-2xl">
            {/* Header */}
            <div className="flex items-start gap-3 px-6 pt-6">
              <div className="bg-primary/15 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                <Key className="text-primary h-4 w-4" />
              </div>
              <div className="flex-1">
                <h2 className="text-foreground text-base font-semibold">Early Access Required</h2>
                <p className="text-muted-foreground mt-0.5 text-sm">
                  Vetra Studio is currently in limited preview. Pick one of the options below to get
                  started.
                </p>
              </div>
            </div>

            <div className="border-border mx-6 mt-5 border-t" />

            {/* Options */}
            <div className="px-6 py-5">
              <div className="relative space-y-6">
                <div className="border-border absolute top-5 bottom-5 left-4 w-px border-l border-dashed" />

                {/* Option 1 — Invite code */}
                <div className="flex gap-4">
                  <div className="bg-card border-border relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
                    <Key className="text-foreground-70 h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold">I have an invite code</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      Enter your code to get immediate access to Vetra Cloud environments.
                    </p>
                    <div className="mt-3 space-y-1.5">
                      <div className="flex gap-2">
                        <input
                          value={code}
                          onChange={(e) => {
                            setCode(e.target.value)
                            setError('')
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && handleGetAccess()}
                          placeholder="Enter your invite code"
                          className="border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/40 h-9 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
                        />
                        <button
                          onClick={handleGetAccess}
                          className="bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-lg px-4 text-sm font-semibold transition-colors"
                        >
                          Get Access
                        </button>
                      </div>
                      {error && <p className="text-destructive text-xs">{error}</p>}
                    </div>
                  </div>
                </div>

                {/* Option 2 — Run locally */}
                <div className="flex gap-4">
                  <div className="bg-card border-border relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
                    <Terminal className="text-foreground-70 h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold">Run it locally</p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      No code needed. Run your own Vetra Cloud instance on your machine with a
                      single command.
                    </p>
                    <div className="bg-muted mt-3 flex items-center gap-2 rounded-lg px-3 py-2">
                      <span className="text-primary font-mono text-xs font-bold">$</span>
                      <code className="text-foreground min-w-0 flex-1 truncate font-mono text-xs">
                        {CURL_CMD}
                      </code>
                      <button
                        onClick={handleCopy}
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
                  </div>
                </div>

                {/* Option 3 — Discord */}
                <div className="flex gap-4">
                  <div className="bg-card border-border relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border">
                    <MessageCircle className="text-foreground-70 h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground text-sm font-semibold">
                      I don&apos;t have a code
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                      Request access from the Powerhouse community. Drop a message in #vetra-cloud
                      and we&apos;ll get you sorted.
                    </p>
                    <div className="mt-3">
                      <Link
                        href={DISCORD_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="border-border hover:bg-accent inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
                      >
                        <MessageCircle className="h-4 w-4" />
                        Open Powerhouse Discord
                      </Link>
                    </div>
                  </div>
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
                onClick={() => setStep('granted')}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition-colors"
              >
                <Image
                  src="/logos/vetra-icon.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="opacity-90"
                />
                Continue with Renown
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
