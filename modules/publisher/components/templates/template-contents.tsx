'use client'

import { Info } from 'lucide-react'
import { usePublisherAppArtifacts } from '../../hooks/use-publisher'
import type { PublisherTemplate } from '../../types'
import { TemplatePackages } from './template-packages'
import { TemplateServices } from './template-services'

type Guard = (title: string, run: () => Promise<unknown>) => void

/** What each owner gets: services and packages for DEDICATED, a note for SHARED. */
export function TemplateContents({
  appId,
  template,
  guard,
}: {
  appId: string
  template: PublisherTemplate
  guard: Guard
}) {
  const artifacts = usePublisherAppArtifacts(template.mode === 'DEDICATED' ? appId : null)
  if (template.mode === 'SHARED') {
    return (
      <p className="bg-muted text-muted-foreground flex gap-2 rounded-lg p-3 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        Shared templates do not start anything. Your app decides who gets in by checking whether
        someone holds a licence.
      </p>
    )
  }
  const list = artifacts.data ?? []
  const failed = !!artifacts.error && !artifacts.data
  const retry = () => void artifacts.refetch()
  return (
    <div className="space-y-6">
      <TemplateServices
        appId={appId}
        template={template}
        guard={guard}
        artifacts={list}
        artifactsLoading={artifacts.isLoading}
        artifactsFailed={failed}
        onRetryArtifacts={retry}
      />
      <TemplatePackages
        appId={appId}
        template={template}
        guard={guard}
        artifacts={list}
        artifactsLoading={artifacts.isLoading}
        artifactsFailed={failed}
        onRetryArtifacts={retry}
      />
    </div>
  )
}
