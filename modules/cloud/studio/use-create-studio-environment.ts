'use client'

import { useCallback } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { DRIVE_ID } from '@/modules/cloud/client'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { applyConfigChanges, type ConfigChange } from '@/modules/cloud/config/apply'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { deriveTenantId } from './studio-tenant'
import {
  STUDIO_AGENT_PACKAGE,
  STUDIO_AGENT_PREFIX,
  STUDIO_AGENT_SIZE,
  STUDIO_ANTHROPIC_SECRET_NAMES,
  STUDIO_BASE_DOMAIN,
  STUDIO_ENV_LABEL,
  STUDIO_REGISTRY,
  STUDIO_SERVICE_COMMAND,
} from './constants'

export type CreateStudioResult = { documentId: string; subdomain: string; tenantId: string }

/**
 * Provisions a dedicated Vetra Studio environment: a single vetra-cli CLINT
 * agent (XL). Writes the Anthropic key to the tenant secret store under all
 * three names the manifest requires, then approves so the deploy rolls.
 */
export function useCreateStudioEnvironment() {
  const { signer } = useCanSign()
  const renown = useRenown()
  return useCallback(
    async (input: { anthropicApiKey: string }): Promise<CreateStudioResult> => {
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
      controller.addPackage({ packageName: STUDIO_AGENT_PACKAGE, version: undefined })
      controller.enableService({
        type: 'CLINT',
        prefix: STUDIO_AGENT_PREFIX,
        clintConfig: {
          package: { registry: STUDIO_REGISTRY, name: STUDIO_AGENT_PACKAGE, version: null },
          env: [],
          serviceCommand: STUDIO_SERVICE_COMMAND,
          selectedRessource: STUDIO_AGENT_SIZE,
        },
        selectedRessource: STUDIO_AGENT_SIZE,
      })
      const result = await controller.push()
      const documentId = result.remoteDocument.id
      const tenantId = deriveTenantId(subdomain, documentId)

      const changes: ConfigChange[] = STUDIO_ANTHROPIC_SECRET_NAMES.map((name) => ({
        kind: 'setSecret',
        name,
        value: input.anthropicApiKey,
      }))
      await applyConfigChanges(tenantId, changes, renown)

      controller.approveChanges({})
      await controller.push()

      return { documentId, subdomain, tenantId }
    },
    [signer, renown],
  )
}
