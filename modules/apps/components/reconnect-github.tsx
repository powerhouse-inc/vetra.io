'use client'

import { Github } from 'lucide-react'

import { Button } from '@/modules/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

import { useGithubDeployAppInfo } from '../hooks/use-apps'
import { GithubFlowLink } from './github-flow-link'

/**
 * Shown when the API answers GITHUB_NOT_CONNECTED: the user's GitHub
 * authorization expired or never happened. Re-authorizing returns through
 * /user/apps/github/callback.
 */
export function ReconnectGithub({
  message = 'Your GitHub authorization expired. Reconnect to list your repositories.',
  className,
}: {
  message?: string
  className?: string
}) {
  const info = useGithubDeployAppInfo()
  const href = info.data?.authorizeUrl
  return (
    <div
      role="alert"
      className={cn(
        'border-warning/40 bg-warning/10 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center',
        className,
      )}
    >
      <Github className="text-warning h-5 w-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">{message}</p>
      <Button asChild size="sm" className="shrink-0">
        <GithubFlowLink url={href}>
          <Github className="h-4 w-4" />
          Reconnect GitHub
        </GithubFlowLink>
      </Button>
    </div>
  )
}
