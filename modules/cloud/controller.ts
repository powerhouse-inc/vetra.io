import type { ISigner } from 'document-model'
import { PHDocumentController } from 'document-model'
import { RemoteDocumentController } from '@powerhousedao/reactor-browser'
import { VetraCloudEnvironmentV1 as VetraCloudEnvironment } from '@powerhousedao/vetra-cloud-package/document-models'
import type {
  VetraCloudEnvironmentAction,
  VetraCloudEnvironmentPHState,
} from '@powerhousedao/vetra-cloud-package/document-models/vetra-cloud-environment'
import { client, resolveAuthToken } from './client'
import { cachedSyncEnvironmentOrg, withOrgSync } from './org-sync'

/**
 * A controller class bound to our installed document-model version.
 * Built locally (rather than importing the package's prebuilt class) to
 * avoid cross-compile-unit type mismatches.
 */
const VetraCloudEnvironmentController = PHDocumentController.forDocumentModel<
  VetraCloudEnvironmentPHState,
  VetraCloudEnvironmentAction
>(VetraCloudEnvironment)

export type EnvironmentController = Awaited<ReturnType<typeof loadEnvironmentController>>

/**
 * Load an existing environment document and wrap it for signed pushes.
 * Callers gate each signed action with `ensureCanOperateEnvironment`.
 *
 * `parentIdentifier` is the drive id that owns the document. Under the
 * multi-drive ownership model this will be `user:<eth>` or `team:<slug>`;
 * for legacy callers it remains `'powerhouse'` (`DRIVE_ID`).
 */
export function loadEnvironmentController(options: {
  documentId: string
  parentIdentifier: string
  signer: ISigner
  /**
   * The env's organisation when the caller already knows it (list / read
   * model). Only then is the caller's operator entry refreshed before the
   * pull; personal envs (`null`) make no sync call. When unknown
   * (`undefined`), a refused first pull is followed by one sync and a retry.
   */
  ownerOrgId?: string | null
}) {
  const pull = () =>
    RemoteDocumentController.pull(VetraCloudEnvironmentController, {
      client,
      documentId: options.documentId,
      mode: 'batch',
      parentIdentifier: options.parentIdentifier,
      signer: options.signer,
      onConflict: 'rebase',
    })
  const caller = options.signer.user?.address ?? null
  const sync = (id: string, token: string | null) =>
    cachedSyncEnvironmentOrg(id, token, { caller, fresh: true })
  if (options.ownerOrgId) {
    return withOrgSync(options.documentId, pull, { sync, token: resolveAuthToken })
  }
  if (options.ownerOrgId === null) return pull()
  return pullUnknownEnvironment(pull, async () =>
    sync(options.documentId, await resolveAuthToken()),
  )
}

/**
 * Load an env whose organisation is not known yet. Personal envs (and org envs
 * the caller already has a grant on) load on the first pull, with no sync. A
 * refused first pull may be an org env whose grant the periodic job has not
 * written yet (a just-added member or publisher): sync once (which writes the
 * grant) and, when it names an organisation the caller may view, retry.
 * Otherwise the first refusal is rethrown.
 */
export async function pullUnknownEnvironment<T>(
  pull: () => Promise<T>,
  sync: () => Promise<{ ownerOrgId: string | null; canView: boolean }>,
): Promise<T> {
  try {
    return await pull()
  } catch (first) {
    const access = await sync().catch(() => null)
    if (!access?.ownerOrgId || !access.canView) throw first
    return pull()
  }
}

/** Create a controller for a new (not-yet-persisted) environment document. */
export function createNewEnvironmentController(options: {
  parentIdentifier: string
  signer: ISigner
}) {
  const inner = new VetraCloudEnvironmentController()
  return RemoteDocumentController.from(inner, {
    client,
    mode: 'batch',
    parentIdentifier: options.parentIdentifier,
    signer: options.signer,
  })
}
