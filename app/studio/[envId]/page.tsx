import { StudioEmbedClient } from '@/modules/cloud/studio/studio-embed-client'

export default async function StudioProductPage({
  params,
}: {
  params: Promise<{ envId: string }>
}) {
  const { envId } = await params
  return <StudioEmbedClient envId={envId} />
}
