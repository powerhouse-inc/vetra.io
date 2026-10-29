'use client'

import { Check, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'

type Props = {
  environmentId: string
  environmentName: string
  appId: string | null
  appName?: string
}

/** "Production", "PR #142", or nothing for a standalone environment. */
function roleLabel(env: CloudEnvironment): string | null {
  if (env.app?.role === 'PREVIEW') return env.app.prNumber ? `PR #${env.app.prNumber}` : 'Preview'
  if (env.app?.role === 'PRODUCTION') return 'Production'
  return null
}

/**
 * Parent / current environment, where the current one opens a switcher listing
 * its siblings: the same app's environments, or the other standalone ones.
 */
export function EnvBreadcrumb({ environmentId, environmentName, appId, appName }: Props) {
  const { viewer } = useViewer()
  const { orgId } = useActiveOrg()
  const { environments } = useEnvironments('MINE', viewer?.address ?? null, { orgId })
  const siblings = environments.filter((env) =>
    appId ? env.app?.appId === appId : !env.app?.appId,
  )

  const parent = appId ? (
    <Link href={`/user/apps/${appId}`} className="hover:text-foreground transition-colors">
      {appName ?? 'App'}
    </Link>
  ) : (
    <Link href="/user/environments" className="hover:text-foreground transition-colors">
      Environments
    </Link>
  )

  return (
    <nav aria-label="Breadcrumb" className="text-muted-foreground flex items-center gap-2 text-sm">
      {parent}
      <span aria-hidden className="text-border">
        /
      </span>
      {siblings.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger className="text-foreground hover:bg-secondary/60 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors">
            {environmentName}
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Switch environment</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {siblings.map((env) => {
              const role = roleLabel(env)
              return (
                <DropdownMenuItem key={env.id} asChild>
                  <Link href={`/user/environments/${env.id}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{env.name}</span>
                    {role && <span className="text-muted-foreground text-xs">{role}</span>}
                    {env.id === environmentId && <Check className="h-4 w-4" aria-hidden />}
                  </Link>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={appId ? `/user/apps/${appId}` : '/user/environments'}>
                {appId ? 'All environments of this app' : 'All environments'}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <span className="text-foreground" aria-current="page">
          {environmentName}
        </span>
      )}
    </nav>
  )
}
