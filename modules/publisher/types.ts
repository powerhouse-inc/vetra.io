export type PublisherApp = { id: string; name: string; status: string }

export type PublisherTemplateService = { id: string; type: string; prefix: string | null }
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
export type CreateLicenseTypeInput = { appId: string; kind: string; label?: string | null; validityDays?: number | null }
export type SetLicenseTypeDetailsInput = { licenseTypeId: string; kind?: string | null; label?: string | null; validityDays?: number | null }
export type SetLicenseTypeTemplateInput = { licenseTypeId: string; size?: string | null; baseDomain?: string | null; packageRegistry?: string | null }
export type AddLicenseTypeServiceInput = { licenseTypeId: string; type: string; prefix?: string | null }
export type AddLicenseTypePackageInput = { licenseTypeId: string; packageName: string; version?: string | null }
export type IssueGrantInput = { appId: string; licenseTypeId: string; user: string }
// No appId: the server authorises from the licence document's own app.
export type RevokeLicenseInput = { licenseId: string; reason?: string | null }
