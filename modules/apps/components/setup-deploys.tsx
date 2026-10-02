'use client'

import { ArrowUpRight, GitPullRequest, Loader2, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/modules/shared/components/ui/button'

import { describeAppsError } from '../graphql'
import { useOpenSetupPullRequest } from '../hooks/use-apps'
import { buildWorkflowYaml, WORKFLOW_PATH } from '../lib/workflow'
import type { App } from '../types'
import { CodeBlock } from './code-block'

/**
 * "Set up deploys": the Vetra Deploy bot opens a PR adding the workflow, or the
 * user copies the same file. Used by the new-app flow, the App's getting-started
 * checklist and its settings.
 */
export function SetupDeploys({
  app,
  disabled,
}: {
  app: Pick<App, 'id' | 'productionBranch' | 'repository'>
  disabled?: boolean
}) {
  const openPr = useOpenSetupPullRequest(app.id)
  const [prUrl, setPrUrl] = useState<string | null>(null)
  const yaml = buildWorkflowYaml(app.id, { productionBranch: app.productionBranch })

  const handleOpenPr = () => {
    openPr.mutate(undefined, {
      onSuccess: (url) => {
        setPrUrl(url)
        toast.success('Setup pull request opened', {
          action: { label: 'View', onClick: () => window.open(url, '_blank', 'noopener') },
        })
      },
      onError: (err) => toast.error(describeAppsError(err)),
    })
  }

  return (
    <div className="space-y-5">
      <div className="border-primary/30 bg-primary/5 flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center">
        <div className="bg-primary/15 text-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Sparkles className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">Let Vetra open the pull request</p>
          <p className="text-muted-foreground text-sm">
            Adds <code className="font-mono text-xs">{WORKFLOW_PATH}</code> to{' '}
            <span className="font-medium">{app.repository.fullName}</span>. Merge it and every push
            deploys.
          </p>
        </div>
        {prUrl ? (
          <Button asChild variant="outline" className="shrink-0">
            <a href={prUrl} target="_blank" rel="noopener noreferrer">
              <GitPullRequest className="h-4 w-4" />
              View pull request
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </Button>
        ) : (
          <Button
            onClick={handleOpenPr}
            disabled={disabled || openPr.isPending}
            className="shrink-0"
          >
            {openPr.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitPullRequest className="h-4 w-4" />
            )}
            {openPr.isPending ? 'Opening…' : 'Open setup pull request'}
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="bg-border h-px flex-1" />
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            or add it yourself
          </span>
          <span className="bg-border h-px flex-1" />
        </div>
        <CodeBlock code={yaml} filename={WORKFLOW_PATH} />
        <p className="text-muted-foreground text-xs">
          Needs <code className="font-mono">id-token: write</code> so the action can prove it runs
          in your repo.{' '}
          <Link href="/docs/deploy" className="text-primary hover:underline">
            How deploys work
          </Link>
        </p>
      </div>
    </div>
  )
}
