import type { App } from '../../../modules/apps/types'
import type {
  PublisherAllowListEntry,
  PublisherApp,
  PublisherAppArtifact,
  PublisherEnvironment,
  PublisherInviteCode,
  PublisherLicense,
  PublisherTemplate,
  PublisherTerm,
} from '../../../modules/publisher/types'
import type {
  InviteCodeCheck,
  StudioAccess,
  Subscription,
} from '../../../modules/subscriptions/types'

export const ME = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'

export type CloudState = {
  apps: App[]
  publisherApps: PublisherApp[]
  artifacts: PublisherAppArtifact[]
  templates: PublisherTemplate[]
  terms: PublisherTerm[]
  licenses: PublisherLicense[]
  environments: PublisherEnvironment[]
  inviteCodes: PublisherInviteCode[]
  allowList: PublisherAllowListEntry[]
  subscriptions: Subscription[]
  inviteChecks: Record<string, InviteCodeCheck>
  studioAccess: StudioAccess
  calls: Array<{ query: string; variables: Record<string, unknown> }>
  unmatched: string[]
}

const urls = { app: 'https://vault.vetra.io', connect: null, switchboard: null }

export function app(id: string, name: string): App {
  return {
    id,
    slug: id,
    name,
    ownerAddress: ME,
    status: 'ACTIVE',
    repository: { installationId: '1', repositoryId: '2', fullName: `acme/${id}` },
    productionBranch: 'main',
    productionEnvironmentId: 'env-prod',
    previewsEnabled: false,
    previewLimit: 0,
    previewTtlDays: 0,
    harborProject: 'acme',
    identityDid: 'did:key:z6Mk',
    renownAuthorizeUrl: 'https://renown.id',
    identityExpiresAt: null,
    productionUrls: urls,
    previews: [],
    latestDeployment: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
  }
}

export const INVALID_CHECK: InviteCodeCheck = {
  valid: false,
  appId: null,
  appName: null,
  kind: null,
  termLabel: null,
  mode: null,
}

export function baseState(): CloudState {
  return {
    apps: [app('app-vault', 'Knowledge Vault')],
    publisherApps: [{ id: 'app-vault', name: 'Knowledge Vault', status: 'ACTIVE' }],
    artifacts: [
      {
        kind: 'FUSION_IMAGE',
        name: 'vault-app',
        versions: [{ version: '1.4.0', reference: 'sha256:abc' }],
        channels: [{ channel: 'LATEST', version: '1.4.0' }],
      },
      {
        kind: 'PACKAGE',
        name: '@acme/vault',
        versions: [{ version: '1.4.0', reference: 'npm:@acme/vault@1.4.0' }],
        channels: [],
      },
    ],
    templates: [],
    terms: [],
    licenses: [],
    environments: [],
    inviteCodes: [],
    allowList: [],
    subscriptions: [],
    inviteChecks: {
      // Used only to reach a public page with a login button (see auth.ts).
      'E2E-LOGIN': {
        valid: true,
        appId: 'app-e2e',
        appName: 'E2E',
        kind: 'e2e',
        termLabel: 'E2E',
        mode: 'SHARED',
      },
      'KV-PILOT': {
        valid: true,
        appId: 'app-kv',
        appName: 'Knowledge Vault',
        kind: 'kv-pilot',
        termLabel: 'Pilot',
        mode: 'DEDICATED',
      },
    },
    studioAccess: { allowed: true, licenseId: 'lic-studio', expires: null, hasAttachedKey: true },
    calls: [],
    unmatched: [],
  }
}
