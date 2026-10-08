/**
 * Types for vetraPublisher (vetra-licensing subgraph). Field names and
 * nullability mirror docs/superpowers/specs/2026-10-08-licensing-api-contract.md
 * in vetra-cloud-package exactly. Enum-valued fields arrive as strings.
 */

export type PublisherApp = { id: string; name: string; status: string }

export type TemplateMode = 'SHARED' | 'DEDICATED'
export type TermStatus = 'DRAFT' | 'ACTIVE' | 'RETIRED'
export type IssuerKind = 'INVITE_CODE' | 'PUBLISHER_GRANT' | 'ACHRA_SUBSCRIPTION'
export type LicenseStatus = 'ISSUED' | 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'REPLACED'

export type PublisherTemplateService = {
  id: string
  type: string
  prefix: string | null
  /** The app artifact a FUSION service runs; null for every other type. */
  artifactName: string | null
  /** DEV | STAGING | LATEST — which published version the service follows. */
  artifactChannel: string | null
}

export type PublisherTemplatePackage = {
  id: string
  packageName: string | null
  version: string | null
}

export type PublisherTemplate = {
  id: string
  name: string | null
  mode: TemplateMode
  /** SHARED only; null means the App Environment. */
  sharedEnvironment: string | null
  size: string | null
  baseDomain: string | null
  packageRegistry: string | null
  services: PublisherTemplateService[]
  packages: PublisherTemplatePackage[]
  templateHash: string
  /** Environments currently provisioned from this template (DEDICATED). */
  environmentCount: number
}

export type PublisherTerm = {
  id: string
  kind: string
  label: string | null
  templateId: string | null
  validityDays: number | null
  issuers: IssuerKind[]
  status: TermStatus
  activeLicenses: number
}

export type PublisherLicense = {
  id: string
  /** DID of the holder. */
  user: string
  kind: string
  issuer: string
  status: LicenseStatus
  start: string | null
  end: string | null
  environmentId: string | null
  replacedBy: string | null
}

export type PublisherEnvironment = {
  environmentId: string
  user: string
  licenseId: string
  rootLicenseId: string
  label: string | null
  templateHash: string
  stoppedAt: string | null
  deleteAfter: string | null
}

export type PublisherInviteCode = {
  code: string
  kind: string
  label: string | null
  active: boolean
  expiresAt: string | null
  maxUses: number | null
  redemptions: number
  hasAnthropicKey: boolean
  createdAt: string
}

export type PublisherAllowListEntry = { user: string; addedAt: string }

/** One artifact the app has published, as the template builder offers it. */
export type PublisherAppArtifact = {
  kind: 'PACKAGE' | 'FUSION_IMAGE'
  name: string
  /** Oldest first, as the document stores them. */
  versions: { version: string; reference: string }[]
  channels: { channel: string; version: string }[]
}

// Mutation inputs — mirror the server input types exactly. Omit a key to leave
// it out of the JSON; null is sent as null. Never default or strip keys.
export type AddTemplateInput = { appId: string; name?: string | null; mode: TemplateMode }
export type SetTemplateDetailsInput = {
  appId: string
  templateId: string
  name?: string | null
  mode?: TemplateMode | null
  sharedEnvironment?: string | null
  size?: string | null
  baseDomain?: string | null
  packageRegistry?: string | null
}
export type AddTemplateServiceInput = {
  appId: string
  templateId: string
  type: string
  prefix?: string | null
  artifactName?: string | null
  artifactChannel?: string | null
}
export type AddTemplatePackageInput = {
  appId: string
  templateId: string
  packageName: string
  version?: string | null
}
export type RemoveTemplateEntryInput = { appId: string; templateId: string; id: string }
export type AddTermInput = {
  appId: string
  kind: string
  label?: string | null
  templateId?: string | null
  validityDays?: number | null
  issuers?: IssuerKind[] | null
}
export type SetTermDetailsInput = {
  appId: string
  termId: string
  kind?: string | null
  label?: string | null
  templateId?: string | null
  validityDays?: number | null
  issuers?: IssuerKind[] | null
}
export type IssueGrantInput = { appId: string; kind: string; user: string; label?: string | null }
export type ReplaceGrantInput = { licenseId: string; kind: string }
export type RevokeLicenseInput = { licenseId: string; reason?: string | null }
export type CreateInviteCodeInput = {
  appId: string
  kind: string
  label?: string | null
  /** Omit to let the server generate a random code. */
  code?: string | null
  expiresAt?: string | null
  maxUses?: number | null
  /** Write-only; stored encrypted, never returned. */
  anthropicKey?: string | null
}
