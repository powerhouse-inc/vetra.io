import { StudioEmbedClient } from '@/modules/cloud/studio/studio-embed-client'
import { EarlyAccessGate } from '@/modules/invites/early-access-gate'

export default async function StudioProductPage({
  params,
}: {
  params: Promise<{ envId: string }>
}) {
  const { envId } = await params
  return (
    <EarlyAccessGate>
      <StudioEmbedClient envId={envId} />
    </EarlyAccessGate>
  )
}
