'use client'

import { useCallback } from 'react'
import { track } from '@/modules/shared/lib/track'
import { DRIVE_ID, resolveAuthToken } from '../client'
import { createNewEnvironmentController } from '../controller'
import { handOverToOrg } from '../org-sync'
import { useCanSign } from './use-can-sign'

export type CreateEnvironmentInput = {
  label: string
  subdomain: string
  baseDomain: string
  defaultPackageRegistry?: string | null
  enabledServices: Array<{ type: 'CONNECT' | 'SWITCHBOARD' | 'FUSION'; prefix: string }>
  /**
   * Active organisation: the env is created personally, then handed over with
   * setEnvironmentOrg (retried while the read model catches up). A failed
   * hand-over throws `EnvironmentHandOverError` carrying the new env id.
   */
  orgId?: string | null
}

export type CreateEnvironmentResult = { documentId: string }

/**
 * Returns a function that creates a new environment document and dispatches
 * the initial actions (setLabel, initialize, enableService) in a single
 * signed batch via `RemoteDocumentController`. Resolves with the new doc id.
 */
export function useCreateEnvironment() {
  const { signer } = useCanSign()
  return useCallback(
    async (input: CreateEnvironmentInput): Promise<CreateEnvironmentResult> => {
      if (!signer) {
        throw new Error('You must be logged in with Renown to create an environment')
      }
      const ownerAddress = signer.user?.address
      if (!ownerAddress) {
        throw new Error('Signer has no user address — cannot claim ownership')
      }
      const controller = createNewEnvironmentController({
        parentIdentifier: DRIVE_ID,
        signer,
      })
      // Claim ownership FIRST — every subsequent action (setLabel, initialize,
      // enableService) is owner-gated, so ownership must exist before they
      // reach the reducer. The signer's own address is used; the reducer
      // enforces that user-signed claims can only set the signer's address.
      controller.setOwner({ address: ownerAddress })
      controller.setLabel({ label: input.label })
      controller.initialize({
        genericSubdomain: input.subdomain,
        genericBaseDomain: input.baseDomain,
        defaultPackageRegistry: input.defaultPackageRegistry ?? undefined,
      })
      for (const svc of input.enabledServices) {
        controller.enableService({ type: svc.type, prefix: svc.prefix })
      }
      const result = await controller.push()
      const documentId = result.remoteDocument.id
      track('env_created', { environmentId: documentId })
      if (input.orgId) await handOverToOrg(documentId, input.orgId, await resolveAuthToken())
      return { documentId }
    },
    [signer],
  )
}
