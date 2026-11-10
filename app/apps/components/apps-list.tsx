import { ArrowUpRight } from 'lucide-react'
import { AppLogo } from '@/modules/apps/components/profile/app-logo'
import type { DirectoryApp } from '../lib/directory'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The apps directory, most held first (the order given). */
export function AppsList({ apps }: { apps: DirectoryApp[] }) {
  if (apps.length === 0) {
    return <p className="text-muted-foreground mt-10 text-sm">No apps here yet.</p>
  }
  return (
    <ul className="divide-border border-border bg-card mt-8 divide-y rounded-xl border">
      {apps.map((app) => (
        <li key={app.appId} className="flex items-start gap-4 p-4">
          <AppLogo name={app.name} seed={app.appId} src={app.logoUrl} size="md" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {app.pageUrl ? (
                <a
                  href={app.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold hover:underline"
                >
                  {app.name}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : (
                <span className="font-semibold">{app.name}</span>
              )}
              {app.category && (
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                  {app.category}
                </span>
              )}
            </div>
            {app.tagline && <p className="text-muted-foreground text-sm">{app.tagline}</p>}
          </div>
          <div className="text-muted-foreground shrink-0 text-right text-sm">
            <p className="text-foreground font-medium">{count(app.holders, 'holder', 'holders')}</p>
            <p>{count(app.plans, 'plan', 'plans')}</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
