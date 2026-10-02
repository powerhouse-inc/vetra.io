import { ArrowRight, BookOpen, GitCommitHorizontal, Github, Plus, Rocket } from 'lucide-react'
import Link from 'next/link'

import { Button } from '@/modules/shared/components/ui/button'

const STEPS = [
  {
    icon: Github,
    title: 'Connect a repo',
    body: 'Install Vetra Deploy on GitHub and pick the repository of your package or app.',
  },
  {
    icon: GitCommitHorizontal,
    title: 'Push',
    body: 'A GitHub Action builds, publishes your packages and ships your front-end image.',
  },
  {
    icon: Rocket,
    title: "It's live",
    body: 'main deploys production. Every pull request gets its own preview environment.',
  },
] as const

/** First-run hero for the Apps home: the three-step flow and the CTA. */
export function AppsEmptyState() {
  return (
    <section className="bg-card relative overflow-hidden rounded-2xl border px-6 py-12 shadow-sm sm:px-10">
      <div
        aria-hidden
        className="bg-primary/10 pointer-events-none absolute -top-24 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
      />
      <div className="relative mx-auto max-w-3xl text-center">
        <span className="bg-primary/10 text-primary inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <Rocket className="h-3.5 w-3.5" aria-hidden />
          Git push to deploy
        </span>
        <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
          Ship your first app in minutes
        </h2>
        <p className="text-muted-foreground mx-auto mt-3 max-w-xl">
          An app links a GitHub repository to a production environment. Pushing code is the deploy
          button.
        </p>
      </div>

      <ol className="relative mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="bg-background/60 relative rounded-xl border p-5">
            <div className="flex items-center gap-3">
              <span className="bg-foreground text-background flex h-9 w-9 items-center justify-center rounded-lg">
                <step.icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="text-muted-foreground font-mono text-xs">0{i + 1}</span>
            </div>
            <p className="mt-4 font-medium">{step.title}</p>
            <p className="text-muted-foreground mt-1 text-sm">{step.body}</p>
            {i < STEPS.length - 1 && (
              <ArrowRight
                aria-hidden
                className="text-muted-foreground/60 absolute top-1/2 -right-3.5 z-10 hidden h-5 w-5 -translate-y-1/2 sm:block"
              />
            )}
          </li>
        ))}
      </ol>

      <div className="relative mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/user/apps/new">
            <Plus className="h-4 w-4" />
            Create your first app
          </Link>
        </Button>
        <Button asChild size="lg" variant="ghost">
          <Link href="/docs/deploy">
            <BookOpen className="h-4 w-4" />
            Read the deploy guide
          </Link>
        </Button>
      </div>
    </section>
  )
}
