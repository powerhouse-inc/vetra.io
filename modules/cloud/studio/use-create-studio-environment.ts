'use client'

import { useCallback } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { DRIVE_ID } from '@/modules/cloud/client'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { applyConfigChanges, type ConfigChange } from '@/modules/cloud/config/apply'
import { getAuthToken } from '@/modules/cloud/graphql'
import { applyInviteCodeSecret } from '@/modules/invites/lib/client'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { deriveTenantId } from './studio-tenant'
import {
  STUDIO_AGENT_PACKAGE,
  STUDIO_AGENT_PREFIX,
  STUDIO_AGENT_SIZE,
  STUDIO_AGENT_VERSION,
  STUDIO_ANTHROPIC_SECRET_NAMES,
  STUDIO_BASE_DOMAIN,
  STUDIO_DEFAULT_ENV_VARS,
  STUDIO_ENV_LABEL,
  STUDIO_REGISTRY,
  STUDIO_SERVICE_COMMAND,
} from './constants'

export type CreateStudioResult = { documentId: string; subdomain: string; tenantId: string }

/**
 * Provisions a dedicated Vetra Studio environment: a single vetra-cli CLINT
 * agent (XL). Supplies the Anthropic key to the tenant secret store under all
 * the names the manifest requires, then approves so the deploy rolls.
 *
 * Two ways the key is supplied:
 *  - `anthropicApiKey` passed in → written client-side via applyConfigChanges
 *    (manual entry / fallback path).
 *  - omitted → asked of the vetra-access-codes subgraph, which writes the key
 *    attached to the caller's redeemed invite code into the tenant secret store
 *    server-side. The key never reaches this client.
 */
export function useCreateStudioEnvironment() {
  const { signer } = useCanSign()
  const renown = useRenown()
  return useCallback(
    async (input: { anthropicApiKey?: string } = {}): Promise<CreateStudioResult> => {
      if (!signer) throw new Error('You must be logged in with Renown to create a studio')
      const ownerAddress = signer.user?.address
      if (!ownerAddress) throw new Error('Signer has no user address — cannot claim ownership')

      const subdomain = generateSubdomain(crypto.randomUUID())
      const controller = createNewEnvironmentController({ parentIdentifier: DRIVE_ID, signer })
      controller.setOwner({ address: ownerAddress })
      controller.setLabel({ label: STUDIO_ENV_LABEL })
      controller.initialize({
        genericSubdomain: subdomain,
        genericBaseDomain: STUDIO_BASE_DOMAIN,
        defaultPackageRegistry: STUDIO_REGISTRY,
      })
      controller.addPackage({ packageName: STUDIO_AGENT_PACKAGE, version: STUDIO_AGENT_VERSION })
      controller.enableService({
        type: 'CLINT',
        prefix: STUDIO_AGENT_PREFIX,
        clintConfig: {
          package: {
            registry: STUDIO_REGISTRY,
            name: STUDIO_AGENT_PACKAGE,
            version: STUDIO_AGENT_VERSION,
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

      if (input.anthropicApiKey) {
        // Manual entry / fallback: write the provided key client-side.
        const changes: ConfigChange[] = STUDIO_ANTHROPIC_SECRET_NAMES.map((name) => ({
          kind: 'setSecret',
          name,
          value: input.anthropicApiKey as string,
        }))
        await applyConfigChanges(tenantId, changes, renown)
      } else {
        // Inject the key attached to the caller's invite code, server-side.
        const token = await getAuthToken(renown)
        if (!token) throw new Error('Could not authenticate to provision the studio key')
        const result = await applyInviteCodeSecret(
          tenantId,
          [...STUDIO_ANTHROPIC_SECRET_NAMES],
          token,
        )
        if (!result?.injected) {
          throw new Error('No Anthropic API key is available for your invite code')
        }
      }

      controller.approveChanges({})
      await controller.push()

      return { documentId, subdomain, tenantId }
    },
    [signer, renown],
  )
}
