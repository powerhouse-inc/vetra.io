// Ambient declarations for @powerhousedao/vetra-builder-package subpaths.
// The package's exports map points at `dist/browser/...d.ts` which the
// publish output doesn't include yet (ph-cli build only emits the root
// `dist/index.d.ts`). Once the package's build is normalised to match
// vetra-cloud-package's full per-export d.ts output, this shim can go.

declare module '@powerhousedao/vetra-builder-package/document-models' {
  import type { PHDocumentController } from 'document-model'
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type AnyClass = new (...args: any[]) => PHDocumentController<any> & {
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
  export const BuilderTeamV1: AnyClass
  export const BuilderAccountV1: AnyClass
}

declare module '@powerhousedao/vetra-builder-package/document-models/builder-team' {
  export type BuilderTeamAction = unknown
  export type BuilderTeamPHState = unknown
}
