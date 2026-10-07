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
