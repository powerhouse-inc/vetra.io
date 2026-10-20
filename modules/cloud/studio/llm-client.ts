import { PublisherApiError, publisherGql, type FetchLike } from '@/modules/publisher/graphql'

// vetraLlm (vetra-cloud-package vetra-llm subgraph) on the cloud switchboard.
// Same transport and error mapping as vetraPublisher / vetraSubscriptions.

type Ns<T> = { vetraLlm: T }

export type StudioLlmProvision = { environmentId: string; connected: boolean; llmBudgetUsd: number }
export type StudioLlmStatus = { environmentId: string; connected: boolean }
export type StudioLlmUsage = {
  source: string
  model: string
  usageUsd: number
  limitUsd: number | null
  resetsAt: string | null
}

/**
 * Provision the new Studio's model key from the caller's licence budget,
 * server-side (the key never reaches this client). `connected: false` means
 * the licence has no LLM budget. Null means the deployment has no OpenRouter
 * broker configured. Either way the Studio still comes up, in
 * connect-a-model mode.
 */
export async function provisionStudioLlm(
  tenantId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<StudioLlmProvision | null> {
  try {
    const data = await publisherGql<Ns<{ provisionStudioLlm: StudioLlmProvision }>>(
      `mutation ($tenantId: String!) { vetraLlm { provisionStudioLlm(tenantId: $tenantId) { environmentId connected llmBudgetUsd } } }`,
      { tenantId },
      token,
      fetchImpl,
    )
    return data.vetraLlm.provisionStudioLlm
  } catch (err) {
    if (err instanceof PublisherApiError && err.code === 'SERVICE_NOT_CONFIGURED') return null
    throw err
  }
}

/** Whether the Studio's tenant holds a model key (cheap: no OpenRouter call). */
export async function fetchStudioLlmStatus(
  environmentId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<StudioLlmStatus> {
  const data = await publisherGql<Ns<{ studioLlmStatus: StudioLlmStatus }>>(
    `query ($environmentId: String!) { vetraLlm { studioLlmStatus(environmentId: $environmentId) { environmentId connected } } }`,
    { environmentId },
    token,
    fetchImpl,
  )
  return data.vetraLlm.studioLlmStatus
}

/** This month's spend against the Studio's budget; null without a key (operators only, cached 60 s). */
export async function fetchStudioLlmUsage(
  environmentId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<StudioLlmUsage | null> {
  const data = await publisherGql<Ns<{ studioLlmUsage: StudioLlmUsage | null }>>(
    `query ($environmentId: String!) { vetraLlm { studioLlmUsage(environmentId: $environmentId) { source model usageUsd limitUsd resetsAt } } }`,
    { environmentId },
    token,
    fetchImpl,
  )
  return data.vetraLlm.studioLlmUsage
}
