'use client'

import { useCallback } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { DRIVE_ID } from '@/modules/cloud/client'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { applyConfigChanges, type ConfigChange } from '@/modules/cloud/config/apply'
import { getAuthToken } from '@/modules/cloud/graphql'
import { cloudSwitchboardUrl, studioRegistry } from '@/modules/cloud/switchboard-url'
import { claimStudioEnvironment, fetchStudioPoolVersion } from './pool-client'
import { provisionStudioLlm } from './llm-client'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { deriveTenantId } from './studio-tenant'
import {
  STUDIO_AGENT_PACKAGE,
  STUDIO_AGENT_PREFIX,
  STUDIO_AGENT_SIZE,
  STUDIO_AGENT_VERSION,
  STUDIO_BASE_DOMAIN,
  STUDIO_DEFAULT_ENV_VARS,
  STUDIO_ENV_LABEL,
  STUDIO_SERVICE_COMMAND,
} from './constants'

export type CreateStudioResult = {
  documentId: string
  subdomain: string
  tenantId: string
}

/**
 * Provisions a dedicated Vetra Studio environment: a single vetra-cli CLINT
 * agent (XL). A warm pool env is claimed first (it gets its model key in the
 * claim). Cold path: the env is created, then `vetraLlm.provisionStudioLlm`
 * writes the Studio's OpenRouter key from the caller's licence budget,
 * server-side, and the deploy is approved. Creation always finishes: without a
 * budget the Studio serves in connect-a-model mode and its card says so.
 */
export function useCreateStudioEnvironment() {
  const { signer } = useCanSign()
  const renown = useRenown()
  return useCallback(async (): Promise<CreateStudioResult> => {
    if (!signer) throw new Error('You must be logged in with Renown to create a studio')
    const ownerAddress = signer.user?.address
    if (!ownerAddress) throw new Error('Signer has no user address — cannot claim ownership')

    // Try to claim a pre-provisioned ("warm") env first. On null (pool empty,
    // no studio licence) fall through to cold provisioning.
    const token = await getAuthToken(renown)
    if (token) {
      const claimed = await claimStudioEnvironment(token)
      if (claimed) return claimed
    }

    // Source the version live from the backend so a stale (cached) bundle
    // still cold-provisions the current CLI. Falls back to the bundled
    // constant if the backend is unreachable or predates the query.
    const version = (await fetchStudioPoolVersion()) ?? STUDIO_AGENT_VERSION

    const subdomain = generateSubdomain(crypto.randomUUID())
    // Per-deployment registry (prod → registry.vetra.io, staging → dev).
    const registry = studioRegistry()
    const controller = createNewEnvironmentController({ parentIdentifier: DRIVE_ID, signer })
    controller.setOwner({ address: ownerAddress })
    controller.setLabel({ label: STUDIO_ENV_LABEL })
    controller.initialize({
      genericSubdomain: subdomain,
      genericBaseDomain: STUDIO_BASE_DOMAIN,
      defaultPackageRegistry: registry,
    })
    controller.addPackage({ packageName: STUDIO_AGENT_PACKAGE, version })
    controller.enableService({
      type: 'CLINT',
      prefix: STUDIO_AGENT_PREFIX,
      clintConfig: {
        package: {
          registry,
          name: STUDIO_AGENT_PACKAGE,
          version,
        },
        env: STUDIO_DEFAULT_ENV_VARS.map((v) => ({ ...v })),
        serviceCommand: STUDIO_SERVICE_COMMAND,
        selectedRessource: STUDIO_AGENT_SIZE,
      },
      selectedRessource: STUDIO_AGENT_SIZE,
    })
    const result = await controller.push()
    const documentId = result.remoteDocument.id
    const tenantId = deriveTenantId(subdomain, documentId)

    // The Studio's model key (and session-export secret), server-side. A
    // licence without a budget or a deployment without a broker still finishes;
    // a real failure throws before approving, so nothing half-configured rolls.
    if (!token) throw new Error('Could not authenticate to provision the studio')
    await provisionStudioLlm(tenantId, token)

    const githubChanges: ConfigChange[] = [
      { kind: 'setVar', name: 'VETRA_ENVIRONMENT_ID', value: documentId },
      {
        kind: 'setVar',
        name: 'VETRA_CLOUD_SWITCHBOARD_URL',
        value: cloudSwitchboardUrl().replace(/\/graphql\/?$/, ''),
      },
    ]
    try {
      await applyConfigChanges(tenantId, githubChanges, renown)
    } catch {
      // ignore
    }

    controller.approveChanges({})
    await controller.push()

    return { documentId, subdomain, tenantId }
  }, [signer, renown])
}
