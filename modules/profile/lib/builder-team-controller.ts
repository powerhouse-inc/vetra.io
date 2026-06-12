import type { ISigner } from 'document-model'
import { PHDocumentController } from 'document-model'
import { RemoteDocumentController } from '@powerhousedao/reactor-browser'
import { BuilderTeamV1 as BuilderTeam } from '@powerhousedao/vetra-builder-package/document-models'
import { client } from '@/modules/cloud/client'

/**
 * Action methods the BuilderTeam controller exposes. Shaped to match the
 * published vetra-builder-package's builder-team/v1 action creators.
 */
export type BuilderTeamActions = {
  setTeamName(i: { name: string }): void
  setSlug(i: { slug: string }): void
  setDescription(i: { description: string }): void
  setLogo(i: { logo?: string }): void
  setSocials(i: { xProfile?: string; github?: string; website?: string }): void
  addMember(i: { id: string }): void
  updateMemberInfo(i: {
    id: string
    ethAddress?: string
    name?: string
    phid?: string
    profileImage?: string
  }): void
  removeMember(i: { id: string }): void
  addSpace(i: { id: string }): void
  updateSpaceInfo(i: { id: string; title?: string; description?: string }): void
  removeSpace(i: { id: string }): void
  addPackage(i: { id: string; spaceId: string }): void
  updatePackageInfo(i: {
    id: string
    spaceId?: string
    title?: string
    description?: string
    github?: string
    npm?: string
    vetraDriveUrl?: string
    phid?: string
  }): void
  removePackage(i: { id: string }): void
}

export type BuilderTeamControllerInstance = BuilderTeamActions & {
  push(): Promise<{ remoteDocument: { id: string } }>
}

/**
 * Controller bound to the locally-installed BuilderTeam document model.
 * Built here (not imported from the package) to avoid cross-compile-unit
 * type mismatches — same pattern as modules/cloud/controller.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BuilderTeamController = PHDocumentController.forDocumentModel<any, any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
  BuilderTeam as any,
)

/**
 * Load an existing BuilderTeam document for signed pushes.
 *
 * `parentIdentifier` is the drive id that owns the document. Under the
 * multi-drive ownership model this will be `team:<slug>`; for legacy
 * callers it remains `'powerhouse'` (`DRIVE_ID`).
 */
export async function loadBuilderTeamController(options: {
  documentId: string
  parentIdentifier: string
  signer: ISigner
}): Promise<BuilderTeamControllerInstance> {
  const controller = await RemoteDocumentController.pull(BuilderTeamController, {
    client,
    documentId: options.documentId,
    mode: 'batch',
    parentIdentifier: options.parentIdentifier,
    signer: options.signer,
    onConflict: 'rebase',
  })
  return controller as unknown as BuilderTeamControllerInstance
}

/** Create a controller for a brand-new (not-yet-persisted) BuilderTeam document. */
export function createNewBuilderTeamController(options: {
  parentIdentifier: string
  signer: ISigner
}): BuilderTeamControllerInstance {
  const inner = new BuilderTeamController()
  const controller = RemoteDocumentController.from(inner, {
    client,
    mode: 'batch',
    parentIdentifier: options.parentIdentifier,
    signer: options.signer,
  })
  return controller as unknown as BuilderTeamControllerInstance
}
