'use client'

import Link from 'next/link'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { StudioBootScreen } from './components/studio-boot-screen'
import { StudioFrame } from './components/studio-frame'
import { useStudioProductEmbed } from './use-studio-product-embed'

export function StudioEmbedClient({ envId }: { envId: string }) {
  const { status, embedUrl } = useStudioProductEmbed(envId)

  switch (status) {
    case 'unauthenticated':
      return <CloudLanding />
    case 'loading':
      return <StudioBootScreen title="Loading product…" />
    case 'not-found':
      return (
        <div className="mx-auto mt-24 max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Product not found</h1>
          <Link href="/user" className="text-primary text-sm underline-offset-2 hover:underline">
            Back to products
          </Link>
        </div>
      )
    case 'booting':
      return (
        <StudioBootScreen
          title="Starting Vetra Studio…"
          detail="The agent is booting. This can take a few minutes on first start."
        />
      )
    case 'ready':
      return embedUrl ? <StudioFrame embedUrl={embedUrl} /> : <StudioBootScreen title="Opening…" />
  }
}
