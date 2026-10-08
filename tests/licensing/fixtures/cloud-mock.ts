/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- GraphQL variables are untyped JSON here, by design (see Vars). */
import type { Page } from '@playwright/test'
import { CLOUD_URL } from './cloud-url'
import { INVALID_CHECK, ME, type CloudState } from './data'

type Vars = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Handler = { match: RegExp; reply: (v: Vars, s: CloudState) => unknown }

const pub = (field: string, value: unknown) => ({ vetraPublisher: { [field]: value } })
const subs = (field: string, value: unknown) => ({ vetraSubscriptions: { [field]: value } })
const defined = (o: Vars) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined))

// First match wins: namespaced vetraPublisher { myApps } must come before the top-level apps myApps.
const HANDLERS: Handler[] = [
  { match: /vetraPublisher\s*\{\s*myApps/, reply: (_, s) => pub('myApps', s.publisherApps) },
  { match: /vetraPublisher\s*\{\s*templates\(/, reply: (_, s) => pub('templates', s.templates) },
  { match: /vetraPublisher\s*\{\s*terms\(/, reply: (_, s) => pub('terms', s.terms) },
  {
    match: /vetraPublisher\s*\{\s*appArtifacts\(/,
    reply: (_, s) => pub('appArtifacts', s.artifacts),
  },
  { match: /vetraPublisher\s*\{\s*licenses\(/, reply: (_, s) => pub('licenses', s.licenses) },
  {
    match: /vetraPublisher\s*\{\s*environments\(/,
    reply: (_, s) => pub('environments', s.environments),
  },
  {
    match: /vetraPublisher\s*\{\s*inviteCodes\(/,
    reply: (_, s) => pub('inviteCodes', s.inviteCodes),
  },
  { match: /vetraPublisher\s*\{\s*allowList\(/, reply: (_, s) => pub('allowList', s.allowList) },
  {
    match: /addTemplate\(input/,
    reply: (v, s) => {
      const id = `tpl-${s.templates.length + 1}`
      s.templates.push({
        id,
        name: v.input.name ?? null,
        mode: v.input.mode,
        sharedEnvironment: null,
        size: null,
        baseDomain: null,
        packageRegistry: null,
        services: [],
        packages: [],
        templateHash: `h-${id}`,
        environmentCount: 0,
      })
      return pub('addTemplate', id)
    },
  },
  {
    match: /setTemplateDetails\(input/,
    reply: (v, s) => {
      const { templateId, ...rest } = v.input
      Object.assign(
        s.templates.find((t) => t.id === templateId)!,
        defined(rest),
      )
      return pub('setTemplateDetails', true)
    },
  },
  {
    match: /addTemplateService\(input/,
    reply: (v, s) => {
      const t = s.templates.find((x) => x.id === v.input.templateId)!
      t.services.push({
        id: `svc-${t.services.length + 1}`,
        type: v.input.type,
        prefix: v.input.prefix ?? null,
        artifactName: v.input.artifactName ?? null,
        artifactChannel: v.input.artifactChannel ?? null,
      })
      return pub('addTemplateService', true)
    },
  },
  {
    match: /addTerm\(input/,
    reply: (v, s) => {
      const id = `term-${s.terms.length + 1}`
      s.terms.push({
        id,
        kind: v.input.kind,
        label: v.input.label ?? null,
        templateId: v.input.templateId ?? null,
        validityDays: v.input.validityDays ?? null,
        issuers: v.input.issuers ?? [],
        status: 'DRAFT',
        activeLicenses: 0,
      })
      return pub('addTerm', id)
    },
  },
  {
    match: /publishTerm\(/,
    reply: (v, s) => {
      s.terms.find((t) => t.id === v.termId)!.status = 'ACTIVE'
      return pub('publishTerm', true)
    },
  },
  {
    match: /createInviteCode\(input/,
    reply: (v, s) => {
      const code = {
        code: v.input.code ?? 'GEN-0001',
        kind: v.input.kind,
        label: v.input.label ?? null,
        active: true,
        expiresAt: v.input.expiresAt ?? null,
        maxUses: v.input.maxUses ?? null,
        redemptions: 0,
        hasAnthropicKey: !!v.input.anthropicKey,
        createdAt: new Date().toISOString(),
      }
      s.inviteCodes.push(code)
      return pub('createInviteCode', code)
    },
  },
  {
    match: /vetraSubscriptions\s*\{\s*inviteCode\(/,
    reply: (v, s) => subs('inviteCode', s.inviteChecks[v.code] ?? INVALID_CHECK),
  },
  { match: /mySubscriptions/, reply: (_, s) => subs('mySubscriptions', s.subscriptions) },
  { match: /studioAccess/, reply: (_, s) => subs('studioAccess', s.studioAccess) },
  {
    match: /redeemInviteCode\(input/,
    reply: (v, s) => {
      const check = s.inviteChecks[v.input.code]
      const replaced = v.input.upgrades
        ? s.subscriptions.find((x) => x.licenseId === v.input.upgrades)
        : undefined
      if (replaced) replaced.status = 'REPLACED'
      const sub = {
        licenseId: `lic-${s.subscriptions.length + 1}`,
        appId: check.appId!,
        appName: check.appName!,
        kind: check.kind!,
        termLabel: check.termLabel,
        issuer: 'INVITE_CODE',
        status: 'ACTIVE',
        start: new Date().toISOString(),
        end: null,
        mode: (check.mode ?? 'SHARED') as 'SHARED' | 'DEDICATED',
        environmentId: replaced?.environmentId ?? (check.mode === 'DEDICATED' ? 'env-kv-1' : null),
        environmentLabel: replaced?.environmentLabel ?? v.input.label ?? null,
        openUrl: 'https://acme.kv.vetra.io',
        stoppedAt: null,
        deleteAfter: null,
        warnings: [],
      }
      s.subscriptions.push(sub)
      return subs('redeemInviteCode', sub)
    },
  },
  // vetra-apps (top-level fields)
  { match: /\bapp\(id:/, reply: (v, s) => ({ app: s.apps.find((a) => a.id === v.id) ?? null }) },
  { match: /appDeployments\(/, reply: () => ({ appDeployments: [] }) },
  {
    match: /githubDeployAppInfo/,
    reply: () => ({
      githubDeployAppInfo: {
        slug: 'vetra-deploy',
        installUrl: 'https://github.com/apps/vetra-deploy',
        authorizeUrl: 'https://github.com',
      },
    }),
  },
  { match: /\bmyApps\s*\{/, reply: (_, s) => ({ myApps: s.apps }) },
  // vetra-cloud: the header and app page ask who we are and list our environments (none).
  { match: /\bviewer\s*\{/, reply: () => ({ viewer: { address: ME, isAdmin: false } }) },
  { match: /\bmyEnvironments\(/, reply: () => ({ myEnvironments: [] }) },
  // The environment page reads the environment document (read path, also the header metadata).
  {
    match: /VetraCloudEnvironment\s*\{\s*document\(/,
    reply: (v, s) => {
      const env = s.cloudEnvironments.find((e) => e.id === v.id)
      return {
        VetraCloudEnvironment: {
          document: env
            ? {
                document: {
                  id: env.id,
                  documentType: 'powerhouse/vetra-cloud-environment',
                  createdAtUtcIso: '2026-10-08T00:00:00Z',
                  lastModifiedAtUtcIso: '2026-10-08T00:00:00Z',
                  revisionsList: [{ scope: 'global', revision: 1 }],
                  state: { global: env.state },
                },
              }
            : null,
        },
      }
    },
  },
  // The rest of the environment page: nothing configured, status not reported yet.
  { match: /\benvVars\(/, reply: () => ({ envVars: [] }) },
  { match: /\bsecrets\(/, reply: () => ({ secrets: [] }) },
  { match: /\bclintRuntimeEndpointsByEnv\(/, reply: () => ({ clintRuntimeEndpointsByEnv: [] }) },
  { match: /\benvironmentStatus\(/, reply: () => ({ environmentStatus: null }) },
]

/**
 * Operations the journeys may leave unanswered, each with the reason it is safe. Anything else
 * in `state.unmatched` fails the journey: a new query the UI depends on must be mocked.
 */
export const ALLOWED_UNMATCHED: Array<{ match: RegExp; reason: string }> = [
  {
    match: /^query GetDocumentWithOperations\(/,
    reason:
      'The signed-in environment page also loads the document with its full operation history ' +
      'for editing. Mocking a reactor operation log is out of scope; the page renders from the ' +
      'mocked VetraCloudEnvironment document read, which is what the journey asserts.',
  },
]

/** `state.unmatched` minus the allow-listed operations; journeys expect this to be empty. */
export const unexpectedCalls = (s: CloudState): string[] =>
  s.unmatched.filter((q) => !ALLOWED_UNMATCHED.some((a) => a.match.test(q)))

/** Answers every cloud GraphQL POST from `state`; unknown operations get a GraphQL error and are recorded. */
export async function mockCloud(page: Page, state: CloudState): Promise<void> {
  await page.route(CLOUD_URL, async (route) => {
    const body = route.request().postDataJSON() as { query: string; variables?: Vars }
    const variables = body.variables ?? {}
    state.calls.push({ query: body.query, variables })
    const handler = HANDLERS.find((h) => h.match.test(body.query))
    if (!handler) {
      state.unmatched.push(body.query.replace(/\s+/g, ' ').slice(0, 140))
      return route.fulfill({ json: { data: null, errors: [{ message: 'not mocked in e2e' }] } })
    }
    return route.fulfill({ json: { data: handler.reply(variables, state) } })
  })
}
