'use client'

import { BookOpen, ExternalLink, Github, Mail, MessageCircle, Sparkles, Terminal, Ticket } from 'lucide-react'
import Link from 'next/link'
import { CopyButton } from '@/modules/apps/components/copy-button'
import { Button } from '@/modules/shared/components/ui/button'

const DISCORD_URL = 'https://discord.gg/Py28EMafEr'
const CURL_CMD = 'curl -fsSL https://get.vetra.io | sh'
const NPM_CMD = 'npm install -g ph-cmd vetra'
const GITHUB_URL = 'https://github.com/powerhouse-inc/vetra-cli'
const WAITLIST_ACTION =
  'https://gmail.us21.list-manage.com/subscribe/post?u=a65ca7e437961008f5f5c1bad&id=c8ea339c46&f_id=00fda7e6f0'
const ACADEMY_URL = 'https://academy.vetra.io/academy/GetStarted/VetraStudio#running-vetra-studio-locally'

function Command({ cmd, label }: { cmd: string; label: string }) {
  return (
    <div className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2">
      <span className="text-primary font-mono text-xs font-bold">$</span>
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{cmd}</code>
      <CopyButton value={cmd} label={label} />
    </div>
  )
}

/** What a logged-in person without a studio licence sees on Studio and app creation. */
export function NoLicencePanel() {
  return (
    <main className="mx-auto mt-24 max-w-4xl space-y-6 px-4 py-10 sm:px-6">
      <section className="bg-card border-border relative overflow-hidden rounded-2xl border p-6 shadow-sm sm:p-10">
        <div aria-hidden className="bg-primary/10 pointer-events-none absolute -top-24 right-0 h-64 w-96 rounded-full blur-3xl" />
        <div className="relative space-y-4">
          <span className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-2xl">
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <h1 className="text-3xl font-bold tracking-tight">Vetra Studio is in early access</h1>
          <p className="text-muted-foreground max-w-xl">
            Building apps and running a studio needs an early-access licence. If someone gave you an
            invite code, redeem it and you are in.
          </p>
          <Button asChild size="lg">
            <Link href="/redeem">
              <Ticket className="h-4 w-4" />
              Redeem a code
            </Link>
          </Button>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-card border-border space-y-4 rounded-2xl border p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Mail className="text-primary h-4 w-4" aria-hidden />
            No code yet?
          </h2>
          <p className="text-muted-foreground text-sm">Join the waitlist and we will send one when a spot opens.</p>
          <form action={WAITLIST_ACTION} method="post" target="_blank" className="flex gap-2">
            <input
              type="email"
              name="EMAIL"
              required
              aria-label="Email for the waitlist"
              placeholder="you@example.com"
              className="border-border bg-background focus:ring-primary/40 h-9 min-w-0 flex-1 rounded-lg border px-3 text-sm focus:ring-2 focus:outline-none"
            />
            <Button type="submit" size="sm" className="h-9">
              Join
            </Button>
          </form>
          <Button asChild variant="outline" size="sm">
            <Link href={DISCORD_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" />
              Ask for a code on Discord
            </Link>
          </Button>
        </section>

        <section className="bg-card border-border space-y-4 rounded-2xl border p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <Terminal className="text-primary h-4 w-4" aria-hidden />
            Run it on your machine
          </h2>
          <p className="text-muted-foreground text-sm">No code needed: run Vetra locally with one command.</p>
          <Command cmd={CURL_CMD} label="Copy install script command" />
          <Command cmd={NPM_CMD} label="Copy npm install command" />
          <div className="flex flex-wrap gap-3 text-sm">
            <Link href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
              <Github className="h-4 w-4" aria-hidden />
              powerhouse-inc/vetra-cli
              <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
            <Link href={ACADEMY_URL} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5">
              <BookOpen className="h-4 w-4" aria-hidden />
              Step-by-step guide
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
