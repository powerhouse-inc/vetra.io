'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AnimatedVetraLogo } from '@/modules/shared/components/ui/animated-vetra-logo'

const devFeatures = [
  ['100% open source (Copyleft)', 'Data instantly as GraphQL API'],
  ['TypeScript + React SDK', 'Self-hostable, Cloud, or Hybrid'],
  ['Real-time event streaming', 'Offline-first sync'],
  ['Git-like version history', 'Docker + Kubernetes'],
  ['Blockchain & Web3 support', 'Role-based permissions'],
  ['REST + WebSocket support', 'Specification Driven AI'],
]

const typewriterPrompts = [
  'Build a case tracker for our field teams that works offline...',
  'Generate a supply chain backend for an NGO distributing medical supplies...',
  'Build a contributor management system for a decentralized network...',
  'Build a compliance tracker that syncs our operational policies...',
  'Set up an invoicing workflow my whole team can edit in real time...',
  'Create a CRM and shared equipment tracker for an agricultural cooperative...',
]

const TYPE_SPEED_MS = 45
const DELETE_SPEED_MS = 20
const PAUSE_AFTER_TYPE_MS = 2200
const PAUSE_AFTER_DELETE_MS = 500

function useTypewriter(prompts: string[]) {
  const [promptIndex, setPromptIndex] = useState(0)
  const [charCount, setCharCount] = useState(0)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const prompt = prompts[promptIndex]

    let delay: number
    if (!deleting && charCount === prompt.length) {
      delay = PAUSE_AFTER_TYPE_MS
    } else if (deleting && charCount === 0) {
      delay = PAUSE_AFTER_DELETE_MS
    } else {
      delay = deleting ? DELETE_SPEED_MS : TYPE_SPEED_MS
    }

    const timeout = setTimeout(() => {
      if (!deleting) {
        if (charCount < prompt.length) {
          setCharCount(charCount + 1)
        } else {
          setDeleting(true)
        }
      } else {
        if (charCount > 0) {
          setCharCount(charCount - 1)
        } else {
          setDeleting(false)
          setPromptIndex((promptIndex + 1) % prompts.length)
        }
      }
    }, delay)

    return () => clearTimeout(timeout)
  }, [prompts, promptIndex, charCount, deleting])

  return prompts[promptIndex].slice(0, charCount)
}

export function Hero() {
  const [devOpen, setDevOpen] = useState(false)
  const typedPrompt = useTypewriter(typewriterPrompts)

  return (
    <section className="relative bg-transparent px-[74px] py-20 text-center md:py-28">
      <div className="relative mx-auto max-w-screen-xl">
        <h1 className="mx-auto mb-3 max-w-3xl text-[clamp(40px,5vw,64px)] leading-[1.1] font-bold tracking-tight">
          Describe what you want.
          <br />
          Own what gets built.
        </h1>
        <p className="text-muted-foreground mx-auto mb-4 max-w-2xl text-[clamp(20px,2.5vw,28px)] leading-[1.3] font-semibold">
          Build AI ready software for your team
          <br />
          on a data layer & infrastructure that&apos;s always yours.
        </p>
        <p className="text-foreground-70 mx-auto mb-9 max-w-xl text-lg leading-relaxed">
          Unlike other AI builders, the platform is fully open source and runs wherever you choose.
          Your cloud or ours. No lock-in, ever.
        </p>
        <div className="mb-12 flex flex-wrap justify-center gap-3">
          <Link
            href="/user"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center rounded-lg px-8 py-3.5 text-base font-semibold transition-colors"
          >
            Vetra Studio
          </Link>
          <Link
            href="https://academy.vetra.io/"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent text-foreground hover:bg-accent/80 inline-flex h-10 items-center rounded-lg px-8 py-3.5 text-base font-semibold transition-colors"
          >
            See how it works
          </Link>
        </div>

        {/* Chat mockup */}
        <div className="border-border bg-background mx-auto max-w-2xl overflow-hidden rounded-xl border shadow-lg">
          {/* Header bar */}
          <div className="border-border flex items-center gap-2 border-b px-4 py-3">
            <AnimatedVetraLogo size={24} variant="loader" />
            <span className="text-foreground text-sm font-semibold">Vetra Agent</span>
            <span className="bg-primary/15 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
              Online
            </span>
          </div>

          {/* Typewriter input */}
          <div className="flex items-center gap-2 px-4 py-4">
            <div className="bg-muted flex-1 overflow-hidden rounded-lg px-4 py-3 text-left text-sm whitespace-nowrap">
              {typedPrompt ? (
                <span className="text-foreground">{typedPrompt}</span>
              ) : (
                <span className="text-muted-foreground">Ask Vetra anything...</span>
              )}
              <span className="bg-primary ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle" />
            </div>
            <button className="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold transition-opacity hover:opacity-80">
              ↑
            </button>
          </div>
        </div>

        {/* Developer disclosure */}
        <div className="mx-auto mt-6 max-w-2xl">
          <button
            onClick={() => setDevOpen((v) => !v)}
            className="text-foreground-70 hover:text-foreground mx-auto flex items-center gap-2 text-sm font-medium transition-colors"
          >
            <AnimatedVetraLogo size={20} variant="threeStep" />
            For developers
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${devOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div
            className={`overflow-hidden transition-all duration-300 ${devOpen ? 'mt-4 max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <div className="border-border bg-accent/40 rounded-xl border p-5">
              <p className="text-foreground-70 mb-3 text-center text-xs font-semibold tracking-wider uppercase">
                Vetra is built to scale.
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {devFeatures.map(([left, right], i) => (
                  <div key={i} className="contents">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-primary font-bold">✓</span>
                      <span className="text-foreground-70">{left}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-primary font-bold">✓</span>
                      <span className="text-foreground-70">{right}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
