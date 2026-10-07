export type PublisherApp = { id: string; name: string; status: string }

export type PublisherTemplateService = {
  id: string
  type: string
  prefix: string | null
  /** The app artifact a FUSION service runs; null for every other type. */
  artifactName: string | null
  /** DEV | STAGING | LATEST — which published version the service follows. */
  artifactChannel: string | null
}

/** One artifact the app has published, as the builder offers it. */
export type PublisherAppArtifact = {
  kind: 'PACKAGE' | 'FUSION_IMAGE'
  name: string
  /** Newest last, as the document stores them. */
  versions: string[]
  channels: { channel: string; version: string }[]
}
export type PublisherTemplatePackage = {
  id: string
  packageName: string | null
  version: string | null
}

export type PublisherLicenseType = {
  id: string
  kind: string | null
  label: string | null
  status: string
  validityDays: number | null
  templateHash: string
  // SET_TEMPLATE is a full replace: all three must be read so all three can be sent back.
  size: string | null
  baseDomain: string | null
  packageRegistry: string | null
  services: PublisherTemplateService[]
  packages: PublisherTemplatePackage[]
}

export type PublisherLicense = {
  id: string
  user: string
  licenseTypeId: string
  status: string
  start: string | null
  end: string | null
  environmentId: string | null
}

export type AppUserEnvironment = {
  appId: string
  user: string
  environmentId: string
  licenseId: string
  templateHash: string
}

// Mutation inputs. These mirror the server's input types exactly.
//
// SetLicenseTypeDetailsInput deliberately has NO app/appId field and must never
// get one: the document model's input can reassign a tier's app, and the server
// omits it so one publisher cannot move a tier into another publisher's app.
// Omit a key to leave that field unchanged; send null to clear it (the server
// tells the two apart by key presence, so never default or strip keys).
export type CreateLicenseTypeInput = {
  appId: string
  kind: string
  label?: string | null
  validityDays?: number | null
}
export type SetLicenseTypeDetailsInput = {
  licenseTypeId: string
  kind?: string | null
  label?: string | null
  validityDays?: number | null
}
export type SetLicenseTypeTemplateInput = {
  licenseTypeId: string
  size?: string | null
  baseDomain?: string | null
  packageRegistry?: string | null
}
export type AddLicenseTypeServiceInput = {
  licenseTypeId: string
  type: string
  prefix?: string | null
  /** Only a FUSION service may name an artifact; the server refuses the rest. */
  artifactName?: string | null
  /** Defaults to LATEST when an artifact is named. */
  artifactChannel?: string | null
}
export type RemoveLicenseTypeEntryInput = { licenseTypeId: string; id: string }
export type AddLicenseTypePackageInput = {
  licenseTypeId: string
  packageName: string
  version?: string | null
}
export type IssueGrantInput = { appId: string; licenseTypeId: string; user: string }
// No appId: the server authorises from the licence document's own app.
export type RevokeLicenseInput = { licenseId: string; reason?: string | null }
