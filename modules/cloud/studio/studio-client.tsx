'use client'

import { useState } from 'react'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { useStudioEnvironment } from './use-studio-environment'
import { StudioBootScreen } from './components/studio-boot-screen'
import { StudioCreateForm } from './components/studio-create-form'
import { StudioFrame } from './components/studio-frame'

export function StudioClient() {
  const { status, embedUrl, error, create } = useStudioEnvironment()
  const [confirming, setConfirming] = useState(false)

  switch (status) {
    case 'unauthenticated':
      return <CloudLanding />
    case 'not-allowed':
      return (
        <StudioBootScreen
          title="Vetra Studio is in limited preview"
          detail="Your account doesn't have access yet. Reach out to the team to be added to the preview."
        />
      )
    case 'loading':
      return <StudioBootScreen title="Loading your studio…" />
    case 'none':
      return confirming ? (
        <StudioCreateForm onCreate={create} error={error} />
      ) : (
        <div className="mx-auto mt-16 max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold">Vetra Studio</h1>
          <p className="text-muted-foreground text-sm">
            You don&apos;t have a studio yet. Create one to start building.
          </p>
          <button
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            onClick={() => setConfirming(true)}
          >
            Create your studio
          </button>
        </div>
      )
    case 'creating':
      return (
        <StudioBootScreen
          title="Creating your studio…"
          detail="Provisioning the environment and agent."
        />
      )
    case 'booting':
      return (
        <StudioBootScreen
          title="Starting Vetra Studio…"
          detail="The agent is booting. This can take a few minutes on first start."
        />
      )
    case 'ready':
      return embedUrl ? <StudioFrame embedUrl={embedUrl} /> : <StudioBootScreen title="Opening studio…" />
    case 'error':
      return (
        <div className="mx-auto mt-16 max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-destructive text-sm">{error}</p>
          {/* On create errors the form is the fastest recovery path. */}
          <StudioCreateForm onCreate={create} error={error} />
        </div>
      )
  }
}
