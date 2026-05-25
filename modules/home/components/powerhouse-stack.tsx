'use client'

import Image from 'next/image'
import Link from 'next/link'

import { Button } from '@/modules/shared/components/ui/button'
import { ScrollReveal, ScrollRevealItem } from '@/modules/shared/components/ui/scroll-reveal'

const HOST_APPS = [
  {
    key: 'connect',
    name: 'Connect',
    role: 'Front-end',
    logo: '/images/home/connect-light.svg' as const,
    logoWidth: 267,
    logoHeight: 50,
    displayHeight: 16,
  },
  {
    key: 'switchboard',
    name: 'Switchboard',
    role: 'Back-end',
    logo: '/images/home/switchboard-light.svg' as const,
    logoWidth: 355,
    logoHeight: 40,
    displayHeight: 13,
  },
  {
    key: 'renown',
    name: 'Renown',
    role: 'Identity',
    logo: '/images/home/renown-light.svg' as const,
    logoWidth: 219,
    logoHeight: 68,
    displayHeight: 22,
  },
] as const

// ── Shared pieces ────────────────────────────────────────────────────────────

function SectionHeader() {
  return (
    <div className="mb-12 text-center">
      <h2 className="text-foreground mb-3 text-3xl font-bold">Part of the Powerhouse Stack</h2>
      <p className="text-foreground-70 mt-2 text-xl">
        Tools that make distributed work local-first and private.
      </p>
    </div>
  )
}

function AchraCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-purple-300 bg-white dark:border-purple-900 dark:bg-gray-950 ${className}`}
    >
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-20"
        style={{ backgroundImage: 'url(/images/home/stack-achra-bg.png)' }}
      />
      <div className="relative z-10 flex h-full flex-col gap-4 p-6">
        <Image
          src="/images/home/achra-ph-logo-dark.svg"
          alt="Achra"
          width={545}
          height={133}
          className="h-[50px] w-auto self-start dark:hidden"
        />
        <Image
          src="/images/home/achra-ph-logo-light.svg"
          alt="Achra"
          width={545}
          height={133}
          className="hidden h-[50px] w-auto self-start dark:block"
        />
        <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
          A decentralized services & operations platform. Start your organisation, hire operators,
          find builders and offer your local-first products, platforms and agents to the world.
        </p>
        <span className="text-xs font-semibold tracking-wide text-purple-500 uppercase">
          Services Platform
        </span>
        <div className="mt-auto">
          <Button asChild size="sm" className="bg-purple-600 text-white hover:bg-purple-700">
            <Link href="https://achra.com/">Visit Achra ↗</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function VetraCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-green-300 bg-white dark:border-green-900 dark:bg-gray-950 ${className}`}
    >
      <div className="flex h-full flex-col gap-4 p-6">
        <Image
          src="/images/home/vetra-ph-logo-dark.svg"
          alt="Vetra"
          width={499}
          height={128}
          className="h-[50px] w-auto self-start dark:hidden"
        />
        <Image
          src="/images/home/vetra-ph-logo-light.svg"
          alt="Vetra"
          width={499}
          height={128}
          className="hidden h-[50px] w-auto self-start dark:block"
        />
        <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>
          Builder tooling platform for the local-first infrastructure stack of Powerhouse. Packages,
          cloud environments and rapid application development.
        </p>
        <span className="text-xs font-semibold tracking-wide text-green-600 uppercase dark:text-green-400">
          Builder Tooling
        </span>
        <div className="mt-auto">
          <Button asChild size="sm" className="bg-green-600 text-white hover:bg-green-700">
            <Link href="/cloud">Vetra Cloud ↗</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Layout A ─────────────────────────────────────────────────────────────────
// Three equal columns. Powerhouse sits in the centre with Connect, Switchboard
// and Renown listed as nested rows inside its card.

function LayoutA() {
  return (
    <ScrollReveal stagger>
      <section>
        <div className="mx-auto max-w-screen-xl px-6 py-20">
          <SectionHeader />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <ScrollRevealItem>
              <AchraCard />
            </ScrollRevealItem>

            <ScrollRevealItem>
              {/* Powerhouse centre card */}
              <div className="relative flex flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900">
                <div
                  className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
                  style={{ backgroundImage: 'url(/images/home/stack-powerhouse-bg.png)' }}
                />
                <div className="relative z-10 flex flex-col gap-6 p-6">
                  <div className="flex flex-col gap-3">
                    <Image
                      src="/images/home/stack-logo-powerhouse.svg"
                      alt="Powerhouse"
                      width={216}
                      height={25}
                      className="h-6 w-auto"
                    />
                    <p className="text-sm leading-relaxed text-gray-400">
                      Open-source infrastructure and tooling for distributed organisations and local
                      first apps, platform & agents.
                    </p>
                  </div>

                  {/* Host app rows */}
                  <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      Host Applications
                    </p>
                    {HOST_APPS.map((app) => (
                      <div
                        key={app.key}
                        className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3"
                      >
                        <div className="min-w-0">
                          <Image
                            src={app.logo}
                            alt={app.name}
                            width={app.logoWidth}
                            height={app.logoHeight}
                            style={{ height: app.displayHeight, width: 'auto' }}
                            className="w-auto"
                          />
                        </div>
                        <span className="ml-auto shrink-0 text-xs text-gray-500">{app.role}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="self-start border-white/20 bg-transparent text-white hover:bg-white/10"
                  >
                    <Link href="https://powerhouse.io">Visit Powerhouse ↗</Link>
                  </Button>
                </div>
              </div>
            </ScrollRevealItem>

            <ScrollRevealItem>
              <VetraCard />
            </ScrollRevealItem>
          </div>
        </div>
      </section>
    </ScrollReveal>
  )
}

export function PowerhouseStack() {
  return <LayoutA />
}
