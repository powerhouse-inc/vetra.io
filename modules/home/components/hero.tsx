'use client'

import Link from 'next/link'
import { useState } from 'react'
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

const chatMessages = [
  {
    role: 'user',
    text: "Build a case tracker for our field teams. They're often offline and can't depend on any single company's servers.",
  },
  {
    role: 'assistant',
    text: 'Done! Case tracker set up across your own nodes. Syncs peer-to-peer when connected. Want per-case access controls?',
  },
  {
    role: 'user',
    text: 'Yes. Our team is spread across 14 countries.',
  },
  {
    role: 'assistant',
    text: "Covered. It runs entirely on infrastructure you control. Real-time sync keeps your distributed team in step whenever they're connected.",
  },
]

export function Hero() {
  const [devOpen, setDevOpen] = useState(false)

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
            <span className="text-foreground text-sm font-semibold">Vetra Agent Rupert</span>
            <span className="bg-primary/15 text-primary ml-auto rounded-full px-2 py-0.5 text-xs font-medium">
              Online
            </span>
          </div>

          {/* Messages */}
          <div className="space-y-3 p-4">
            {chatMessages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-sm text-right'
                      : 'bg-accent text-foreground rounded-bl-sm text-left'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Input area */}
          <div className="border-border flex items-center gap-2 border-t px-4 py-3">
            <div className="bg-muted text-muted-foreground flex-1 rounded-lg px-4 py-2 text-left text-sm">
              Ask Vetra anything...
            </div>
            <button className="bg-primary text-primary-foreground flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold transition-opacity hover:opacity-80">
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
