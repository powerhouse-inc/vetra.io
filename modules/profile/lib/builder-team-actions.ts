// Input types shared across hooks that mutate a BuilderTeam document.
// These mirror the package's generated types but are kept here to avoid
// importing from deeply-nested dist paths.

export type UpdateSpaceInfoInput = {
  id: string
  title?: string
  description?: string
}

export type UpdatePackageInfoInput = {
  id: string
  spaceId?: string
  title?: string
  description?: string
  github?: string
  npm?: string
  vetraDriveUrl?: string
  phid?: string
}

export function generateId(): string {
  return crypto.randomUUID()
}
