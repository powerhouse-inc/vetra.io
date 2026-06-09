# `/studio` Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/studio` route that detects whether the logged-in user has a Vetra Studio (`vetra-cli`) agent, provisions one (XL, allowlist-gated, prompting for an Anthropic key) if not, shows a boot spinner, and embeds the studio Connect UI in an iframe with a new-tab fallback.

**Architecture:** A client route `app/studio` backed by a state hook in `modules/cloud/studio/`. Pure helpers (detection, embed URL, tenant id, allowlist, readiness) are unit-tested; provisioning reuses the document-model controller (`createNewEnvironmentController`) plus the tenant-secret mutation; readiness is derived from the agent's announced runtime website endpoint.

**Tech Stack:** Next.js App Router, React 19, TypeScript, vitest (happy-dom, `vitest.unit.config.ts`), `@powerhousedao/reactor-browser` (Renown), `@powerhousedao/vetra-cloud-package` document model.

**Test command (all tasks):** `npx vitest run --config vitest.unit.config.ts`
**Lint/type:** `npm run lint` and `npm run tsc`

---

### Task 1: Studio constants

**Files:**
- Create: `modules/cloud/studio/constants.ts`

- [ ] **Step 1: Write constants**

```ts
import type { CloudResourceSize } from '@/modules/cloud/types'

/** The package whose presence (as a CLINT agent) marks a Vetra Studio. */
export const STUDIO_AGENT_PACKAGE = 'vetra-cli'
/** Default agent prefix for a freshly-provisioned studio (manifest agent.id). */
export const STUDIO_AGENT_PREFIX = 'vetra-agent'
/** Studio agents only support XL/XXL; v1 provisions XL. */
export const STUDIO_AGENT_SIZE: CloudResourceSize = 'VETRA_AGENT_XL'
/** Manifest serviceCommand for vetra-cli. */
export const STUDIO_SERVICE_COMMAND = 'vetra'
export const STUDIO_REGISTRY = 'https://registry.dev.vetra.io'
export const STUDIO_BASE_DOMAIN = 'vetra.io'
export const STUDIO_ENV_LABEL = 'Vetra Studio'
/**
 * The vetra-cli manifest declares three required Anthropic secrets. We collect
 * one key and write it to all three names so the agent boots regardless of
 * which it reads.
 */
export const STUDIO_ANTHROPIC_SECRET_NAMES = [
  'ANTHROPIC_API_KEY',
  'VETRA_ANTHROPIC_API_KEY',
  'VETRA_CLI_ANTHROPIC_API_KEY',
] as const
```

- [ ] **Step 2: Commit** — `git add` + `git commit -m "feat(studio): add studio constants"`

---

### Task 2: Allowlist helper

**Files:**
- Create: `modules/cloud/studio/allowlist.ts`
- Test: `modules/cloud/__tests__/studio-allowlist.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { parseAllowlist, isStudioAllowed } from '@/modules/cloud/studio/allowlist'

describe('parseAllowlist', () => {
  it('splits, trims, lowercases, drops empties', () => {
    expect(parseAllowlist('0xAbc, 0xDEF ,, ')).toEqual(['0xabc', '0xdef'])
  })
  it('returns [] for undefined/empty', () => {
    expect(parseAllowlist(undefined)).toEqual([])
    expect(parseAllowlist('')).toEqual([])
  })
})

describe('isStudioAllowed', () => {
  const list = ['0xabc', '0xdef']
  it('true when address is in the list (case-insensitive)', () => {
    expect(isStudioAllowed('0xABC', list)).toBe(true)
  })
  it('false when address missing or not listed', () => {
    expect(isStudioAllowed(null, list)).toBe(false)
    expect(isStudioAllowed('0x999', list)).toBe(false)
  })
  it('false when the allowlist is empty (closed by default)', () => {
    expect(isStudioAllowed('0xabc', [])).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL** (module not found)

- [ ] **Step 3: Implement**

```ts
// Default allowlist mirrors the staging ADMINS set so the feature is usable
// out of the box for admins; NEXT_PUBLIC_STUDIO_ALLOWLIST extends/overrides it.
const DEFAULT_ALLOWLIST = [
  '0x1ad3d72e54fb0eb46e87f82f77b284fc8a66b16c',
  '0x50379ddb64b77e990bc4a433c9337618c70d2c2a',
]

export function parseAllowlist(raw: string | undefined | null): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

/** Effective allowlist: env var if set, else the built-in admin default. */
export function getStudioAllowlist(): string[] {
  const fromEnv = parseAllowlist(process.env.NEXT_PUBLIC_STUDIO_ALLOWLIST)
  return fromEnv.length > 0 ? fromEnv : DEFAULT_ALLOWLIST
}

export function isStudioAllowed(address: string | null | undefined, allowlist: string[]): boolean {
  if (!address) return false
  if (allowlist.length === 0) return false
  return allowlist.includes(address.toLowerCase())
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): add allowlist helper`

---

### Task 3: Detection helper

**Files:**
- Create: `modules/cloud/studio/find-studio-agent.ts`
- Test: `modules/cloud/__tests__/find-studio-agent.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { findStudioAgent } from '@/modules/cloud/studio/find-studio-agent'
import type { CloudEnvironment, CloudEnvironmentService } from '@/modules/cloud/types'

function svc(partial: Partial<CloudEnvironmentService>): CloudEnvironmentService {
  return {
    type: 'CLINT', prefix: 'vetra-agent', enabled: true, url: null,
    status: 'ACTIVE', version: null, selectedRessource: 'VETRA_AGENT_XL',
    config: { package: { registry: 'r', name: 'vetra-cli', version: null }, env: [], serviceCommand: null, selectedRessource: 'VETRA_AGENT_XL' },
    ...partial,
  }
}
function env(services: CloudEnvironmentService[], id = 'e1'): CloudEnvironment {
  return {
    id, name: 'Vetra Studio', documentType: 'powerhouse/vetra-cloud-environment',
    createdAtUtcIso: '', lastModifiedAtUtcIso: '', revision: 1,
    state: { owner: null, label: 'Vetra Studio', genericSubdomain: 'sub', genericBaseDomain: 'vetra.io',
      customDomain: null, defaultPackageRegistry: null, services, packages: [], status: 'READY' },
  }
}

describe('findStudioAgent', () => {
  it('returns the env + service when a vetra-cli CLINT agent exists', () => {
    const e = env([svc({})])
    const match = findStudioAgent([e])
    expect(match?.env.id).toBe('e1')
    expect(match?.service.prefix).toBe('vetra-agent')
  })
  it('ignores disabled agents', () => {
    expect(findStudioAgent([env([svc({ enabled: false })])])).toBeNull()
  })
  it('ignores non-vetra-cli CLINT agents', () => {
    expect(findStudioAgent([env([svc({ config: { package: { registry: 'r', name: 'ph-pirate-cli', version: null }, env: [], serviceCommand: null, selectedRessource: 'VETRA_AGENT_S' } })])])).toBeNull()
  })
  it('ignores non-CLINT services', () => {
    expect(findStudioAgent([env([svc({ type: 'CONNECT', config: null })])])).toBeNull()
  })
  it('returns null for empty input', () => {
    expect(findStudioAgent([])).toBeNull()
  })
  it('returns the first matching env across multiple', () => {
    const match = findStudioAgent([env([], 'e0'), env([svc({})], 'e1')])
    expect(match?.env.id).toBe('e1')
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```ts
import type { CloudEnvironment, CloudEnvironmentService } from '@/modules/cloud/types'
import { STUDIO_AGENT_PACKAGE } from './constants'

export type StudioAgentMatch = {
  env: CloudEnvironment
  service: CloudEnvironmentService
}

/** First enabled CLINT service whose package is the studio package, with its env. */
export function findStudioAgent(envs: CloudEnvironment[]): StudioAgentMatch | null {
  for (const env of envs) {
    const service = env.state.services.find(
      (s) =>
        s.type === 'CLINT' &&
        s.enabled &&
        s.config?.package?.name === STUDIO_AGENT_PACKAGE,
    )
    if (service) return { env, service }
  }
  return null
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): add vetra-cli agent detection`

---

### Task 4: Tenant id + embed URL + readiness helpers

**Files:**
- Create: `modules/cloud/studio/studio-tenant.ts`
- Create: `modules/cloud/studio/studio-embed-url.ts`
- Create: `modules/cloud/studio/studio-readiness.ts`
- Test: `modules/cloud/__tests__/studio-helpers.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { deriveTenantId } from '@/modules/cloud/studio/studio-tenant'
import { buildStudioEmbedUrl } from '@/modules/cloud/studio/studio-embed-url'
import { hasStudioWebsiteEndpoint } from '@/modules/cloud/studio/studio-readiness'
import type { ClintRuntimeEndpointsForPrefix } from '@/modules/cloud/types'

describe('deriveTenantId', () => {
  it('joins subdomain with the first 8 hex chars of the doc id', () => {
    expect(deriveTenantId('warm-newt-75', 'aa726a95-1234-5678-9abc-def012345678')).toBe('warm-newt-75-aa726a95')
  })
})

describe('buildStudioEmbedUrl', () => {
  it('builds the agent root url', () => {
    expect(buildStudioEmbedUrl({ prefix: 'vetra-agent', genericSubdomain: 'warm-newt-75', genericBaseDomain: 'vetra.io' }))
      .toBe('https://vetra-agent.warm-newt-75.vetra.io/')
  })
  it('appends ?user when a did is given', () => {
    expect(buildStudioEmbedUrl({ prefix: 'vetra-agent', genericSubdomain: 'sub', genericBaseDomain: 'vetra.io', userDid: 'did:ethr:0xabc' }))
      .toBe('https://vetra-agent.sub.vetra.io/?user=did%3Aethr%3A0xabc')
  })
  it('falls back to vetra.io base when missing', () => {
    expect(buildStudioEmbedUrl({ prefix: 'vetra-agent', genericSubdomain: 'sub', genericBaseDomain: null }))
      .toBe('https://vetra-agent.sub.vetra.io/')
  })
})

describe('hasStudioWebsiteEndpoint', () => {
  const group = (eps: { type: string; status: string }[]): ClintRuntimeEndpointsForPrefix => ({
    prefix: 'vetra-agent',
    endpoints: eps.map((e, i) => ({ id: `/${i}`, type: e.type as never, port: '1', status: e.status as never, lastSeen: '' })),
  })
  it('true when an enabled website endpoint exists', () => {
    expect(hasStudioWebsiteEndpoint(group([{ type: 'website', status: 'enabled' }]))).toBe(true)
  })
  it('false when only api endpoints exist', () => {
    expect(hasStudioWebsiteEndpoint(group([{ type: 'api-graphql', status: 'enabled' }]))).toBe(false)
  })
  it('false for undefined group', () => {
    expect(hasStudioWebsiteEndpoint(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement the three files**

`studio-tenant.ts`:
```ts
/** Mirrors the gitops processor: `<subdomain>-<first 8 hex of doc id>`. */
export function deriveTenantId(subdomain: string, documentId: string): string {
  const shortId = documentId.replace(/-/g, '').slice(0, 8)
  return `${subdomain}-${shortId}`
}
```

`studio-embed-url.ts`:
```ts
import { STUDIO_BASE_DOMAIN } from './constants'

export function buildStudioEmbedUrl(input: {
  prefix: string
  genericSubdomain: string | null
  genericBaseDomain: string | null
  userDid?: string | null
}): string {
  const sub = input.genericSubdomain || '<subdomain>'
  const base = input.genericBaseDomain || STUDIO_BASE_DOMAIN
  const root = `https://${input.prefix}.${sub}.${base}/`
  return input.userDid ? `${root}?user=${encodeURIComponent(input.userDid)}` : root
}
```

`studio-readiness.ts`:
```ts
import type { ClintRuntimeEndpointsForPrefix } from '@/modules/cloud/types'

/** The studio is embeddable once its agent announces an enabled website route. */
export function hasStudioWebsiteEndpoint(
  group: ClintRuntimeEndpointsForPrefix | undefined,
): boolean {
  if (!group) return false
  return group.endpoints.some((e) => e.type === 'website' && e.status === 'enabled')
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): add tenant-id, embed-url, readiness helpers`

---

### Task 5: Create-studio-environment hook

**Files:**
- Create: `modules/cloud/studio/use-create-studio-environment.ts`
- Test: `modules/cloud/__tests__/use-create-studio-environment.test.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/modules/cloud/hooks/use-can-sign', () => ({ useCanSign: vi.fn() }))
vi.mock('@/modules/cloud/controller', () => ({ createNewEnvironmentController: vi.fn() }))
vi.mock('@/modules/cloud/config/apply', () => ({ applyConfigChanges: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@powerhousedao/reactor-browser', () => ({ useRenown: vi.fn(() => ({})) }))
vi.mock('@/modules/cloud/subdomain', () => ({ generateSubdomain: vi.fn(() => 'warm-newt-75') }))

import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { applyConfigChanges } from '@/modules/cloud/config/apply'
import { useCreateStudioEnvironment } from '@/modules/cloud/studio/use-create-studio-environment'

describe('useCreateStudioEnvironment', () => {
  beforeEach(() => vi.clearAllMocks())

  it('throws without a signer', async () => {
    vi.mocked(useCanSign).mockReturnValue({ canSign: false, signer: null, loading: false })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current({ anthropicApiKey: 'sk' })).rejects.toThrow(/logged in/i)
  })

  it('creates env, writes 3 secrets, approves, returns ids', async () => {
    const setOwner = vi.fn(), setLabel = vi.fn(), initialize = vi.fn(), addPackage = vi.fn(),
      enableService = vi.fn(), approveChanges = vi.fn()
    const push = vi.fn().mockResolvedValue({ remoteDocument: { id: 'aa726a95-1111-2222-3333-444455556666' } })
    const ctrl = { setOwner, setLabel, initialize, addPackage, enableService, approveChanges, push }
    vi.mocked(createNewEnvironmentController).mockReturnValue(ctrl as never)
    vi.mocked(useCanSign).mockReturnValue({
      canSign: true, loading: false,
      signer: { user: { address: '0xMe' } } as never,
    })

    const { result } = renderHook(() => useCreateStudioEnvironment())
    let res: { documentId: string; subdomain: string; tenantId: string } | undefined
    await act(async () => { res = await result.current({ anthropicApiKey: 'sk-test' }) })

    expect(setOwner).toHaveBeenCalledWith({ address: '0xMe' })
    expect(addPackage).toHaveBeenCalledWith({ packageName: 'vetra-cli', version: undefined })
    expect(enableService).toHaveBeenCalledOnce()
    expect(enableService.mock.calls[0][0]).toMatchObject({ type: 'CLINT', prefix: 'vetra-agent' })
    // Secrets written to the derived tenant for all three names.
    expect(applyConfigChanges).toHaveBeenCalledOnce()
    const [tenantId, changes] = vi.mocked(applyConfigChanges).mock.calls[0]
    expect(tenantId).toBe('warm-newt-75-aa726a95')
    expect(changes.map((c) => c.name).sort()).toEqual(
      ['ANTHROPIC_API_KEY', 'VETRA_ANTHROPIC_API_KEY', 'VETRA_CLI_ANTHROPIC_API_KEY'].sort(),
    )
    expect(changes.every((c) => c.kind === 'setSecret' && c.value === 'sk-test')).toBe(true)
    expect(approveChanges).toHaveBeenCalledOnce()
    expect(push).toHaveBeenCalledTimes(2)
    expect(res).toEqual({
      documentId: 'aa726a95-1111-2222-3333-444455556666',
      subdomain: 'warm-newt-75',
      tenantId: 'warm-newt-75-aa726a95',
    })
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement**

```ts
'use client'

import { useCallback } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { DRIVE_ID } from '@/modules/cloud/client'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { applyConfigChanges, type ConfigChange } from '@/modules/cloud/config/apply'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { deriveTenantId } from './studio-tenant'
import {
  STUDIO_AGENT_PACKAGE,
  STUDIO_AGENT_PREFIX,
  STUDIO_AGENT_SIZE,
  STUDIO_ANTHROPIC_SECRET_NAMES,
  STUDIO_BASE_DOMAIN,
  STUDIO_ENV_LABEL,
  STUDIO_REGISTRY,
  STUDIO_SERVICE_COMMAND,
} from './constants'

export type CreateStudioResult = { documentId: string; subdomain: string; tenantId: string }

/**
 * Provisions a dedicated Vetra Studio environment: a single vetra-cli CLINT
 * agent (XL). Writes the Anthropic key to the tenant secret store under all
 * three names the manifest requires, then approves so the deploy rolls.
 */
export function useCreateStudioEnvironment() {
  const { signer } = useCanSign()
  const renown = useRenown()
  return useCallback(
    async (input: { anthropicApiKey: string }): Promise<CreateStudioResult> => {
      if (!signer) throw new Error('You must be logged in with Renown to create a studio')
      const ownerAddress = signer.user?.address
      if (!ownerAddress) throw new Error('Signer has no user address — cannot claim ownership')

      const subdomain = generateSubdomain(crypto.randomUUID())
      const controller = createNewEnvironmentController({ parentIdentifier: DRIVE_ID, signer })
      controller.setOwner({ address: ownerAddress })
      controller.setLabel({ label: STUDIO_ENV_LABEL })
      controller.initialize({
        genericSubdomain: subdomain,
        genericBaseDomain: STUDIO_BASE_DOMAIN,
        defaultPackageRegistry: STUDIO_REGISTRY,
      })
      controller.addPackage({ packageName: STUDIO_AGENT_PACKAGE, version: undefined })
      controller.enableService({
        type: 'CLINT',
        prefix: STUDIO_AGENT_PREFIX,
        clintConfig: {
          package: { registry: STUDIO_REGISTRY, name: STUDIO_AGENT_PACKAGE, version: null },
          env: [],
          serviceCommand: STUDIO_SERVICE_COMMAND,
          selectedRessource: STUDIO_AGENT_SIZE,
        },
        selectedRessource: STUDIO_AGENT_SIZE,
      })
      const result = await controller.push()
      const documentId = result.remoteDocument.id
      const tenantId = deriveTenantId(subdomain, documentId)

      const changes: ConfigChange[] = STUDIO_ANTHROPIC_SECRET_NAMES.map((name) => ({
        kind: 'setSecret',
        name,
        value: input.anthropicApiKey,
      }))
      await applyConfigChanges(tenantId, changes, renown)

      controller.approveChanges({})
      await controller.push()

      return { documentId, subdomain, tenantId }
    },
    [signer, renown],
  )
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): add create-studio-environment hook`

---

### Task 6: State hook `useStudioEnvironment`

**Files:**
- Create: `modules/cloud/studio/use-studio-environment.ts`

(No standalone unit test — it composes other hooks and async fetches; behavior is covered by the tested pure helpers and by manual verification. The hook stays thin and delegates all logic to the tested helpers.)

- [ ] **Step 1: Implement**

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDid, useRenown, useUser } from '@powerhousedao/reactor-browser'
import { fetchEnvironment, getAuthToken } from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { useClintRuntimeEndpoints } from '@/modules/cloud/hooks/use-clint-runtime-endpoints'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { findStudioAgent } from './find-studio-agent'
import { buildStudioEmbedUrl } from './studio-embed-url'
import { hasStudioWebsiteEndpoint } from './studio-readiness'
import { getStudioAllowlist, isStudioAllowed } from './allowlist'
import { STUDIO_AGENT_PREFIX } from './constants'
import { useCreateStudioEnvironment } from './use-create-studio-environment'

export type StudioStatus =
  | 'loading'
  | 'unauthenticated'
  | 'not-allowed'
  | 'none'
  | 'creating'
  | 'booting'
  | 'ready'
  | 'error'

export type StudioEnvironmentState = {
  status: StudioStatus
  embedUrl: string | null
  error: string | null
  create: (anthropicApiKey: string) => Promise<void>
  retry: () => void
}

type Located = { documentId: string; subdomain: string; prefix: string } | null

export function useStudioEnvironment(): StudioEnvironmentState {
  const user = useUser()
  const did = useDid()
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { viewer } = useViewer()
  const address = viewer?.address ?? null
  const environments = useEnvironments('MINE', address)

  const [located, setLocated] = useState<Located>(null)
  const [scanned, setScanned] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCreateStudioEnvironment()

  // Scan the user's environments' full details for a vetra-cli agent.
  const summaryIds = environments.map((e) => e.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!user) return
      try {
        const token = await getAuthToken(renownRef.current)
        const details: CloudEnvironment[] = []
        for (const summary of environments) {
          const full = await fetchEnvironment(summary.id, token)
          if (full) details.push(full)
        }
        const match = findStudioAgent(details)
        if (!cancelled) {
          if (match) {
            setLocated({
              documentId: match.env.id,
              subdomain: match.env.state.genericSubdomain ?? '',
              prefix: match.service.prefix,
            })
          }
          setScanned(true)
        }
      } catch {
        if (!cancelled) setScanned(true)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, summaryIds])

  // Runtime endpoints for the located studio drive the booting → ready flip.
  const { byPrefix } = useClintRuntimeEndpoints(located?.subdomain ?? null, located?.documentId ?? '')
  const ready = located ? hasStudioWebsiteEndpoint(byPrefix[located.prefix]) : false

  const handleCreate = useCallback(
    async (anthropicApiKey: string) => {
      setError(null)
      setCreating(true)
      try {
        const res = await create({ anthropicApiKey })
        // Jump straight to booting on the new env, before the list refreshes.
        setLocated({ documentId: res.documentId, subdomain: res.subdomain, prefix: STUDIO_AGENT_PREFIX })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create studio')
      } finally {
        setCreating(false)
      }
    },
    [create],
  )

  const retry = useCallback(() => setError(null), [])

  const embedUrl = located
    ? buildStudioEmbedUrl({
        prefix: located.prefix,
        genericSubdomain: located.subdomain,
        genericBaseDomain: null,
        userDid: did,
      })
    : null

  let status: StudioStatus
  if (!user) status = 'unauthenticated'
  else if (error) status = 'error'
  else if (creating) status = 'creating'
  else if (located) status = ready ? 'ready' : 'booting'
  else if (!isStudioAllowed(address, getStudioAllowlist())) status = address ? 'not-allowed' : 'loading'
  else if (!scanned) status = 'loading'
  else status = 'none'

  return { status, embedUrl: status === 'ready' ? embedUrl : null, error, create: handleCreate, retry }
}
```

- [ ] **Step 2: Type-check** — `npm run tsc` (expect no new errors). Fix any signature drift (e.g. `useDid` returning `string | undefined`).
- [ ] **Step 3: Commit** — `feat(studio): add studio environment state hook`

---

### Task 7: UI components

**Files:**
- Create: `modules/cloud/studio/components/studio-create-form.tsx`
- Create: `modules/cloud/studio/components/studio-boot-screen.tsx`
- Create: `modules/cloud/studio/components/studio-frame.tsx`
- Test: `modules/cloud/__tests__/studio-frame.test.tsx`

- [ ] **Step 1: Write the failing test (studio-frame)**

```tsx
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { StudioFrame } from '@/modules/cloud/studio/components/studio-frame'

describe('StudioFrame', () => {
  it('renders an iframe with the embed url and a new-tab link', () => {
    const url = 'https://vetra-agent.warm-newt-75.vetra.io/?user=did%3Aethr%3A0xabc'
    const { container } = render(<StudioFrame embedUrl={url} />)
    const iframe = container.querySelector('iframe')
    expect(iframe?.getAttribute('src')).toBe(url)
    const link = container.querySelector('a[target="_blank"]')
    expect(link?.getAttribute('href')).toBe(url)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement components**

`studio-frame.tsx`:
```tsx
'use client'

import { ExternalLink } from 'lucide-react'

export function StudioFrame({ embedUrl }: { embedUrl: string }) {
  return (
    <div className="flex h-[calc(100vh-0px)] flex-col">
      <div className="flex items-center justify-end border-b border-gray-800 bg-gray-950 px-3 py-1.5">
        <a
          href={embedUrl}
          target="_blank"
          rel="noreferrer"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <ExternalLink className="h-3 w-3" /> Open in new tab
        </a>
      </div>
      <iframe
        src={embedUrl}
        title="Vetra Studio"
        className="min-h-0 flex-1 border-0"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  )
}
```

`studio-boot-screen.tsx`:
```tsx
'use client'

import { Loader2 } from 'lucide-react'

export function StudioBootScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      <p className="text-sm font-medium">{title}</p>
      {detail && <p className="text-muted-foreground max-w-sm text-xs">{detail}</p>}
    </div>
  )
}
```

`studio-create-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { AsyncButton } from '@/modules/cloud/components/async-button'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'

export function StudioCreateForm({
  onCreate,
  error,
}: {
  onCreate: (apiKey: string) => Promise<void>
  error: string | null
}) {
  const [apiKey, setApiKey] = useState('')
  return (
    <div className="mx-auto mt-16 max-w-md space-y-4">
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Set up your Vetra Studio</h1>
        <p className="text-muted-foreground text-sm">
          Studio runs as a dedicated agent in your cloud. Provide an Anthropic API key to start it.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="anthropic-key">Anthropic API key</Label>
        <Input
          id="anthropic-key"
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-ant-…"
          autoComplete="off"
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <AsyncButton
        onClickAsync={async () => {
          if (!apiKey.trim()) throw new Error('An Anthropic API key is required')
          await onCreate(apiKey.trim())
        }}
        disabled={!apiKey.trim()}
        pendingLabel="Creating studio…"
      >
        Create studio
      </AsyncButton>
    </div>
  )
}
```

- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): add studio UI components`

---

### Task 8: Client switcher + route

**Files:**
- Create: `modules/cloud/studio/studio-client.tsx`
- Create: `app/studio/page.tsx`

- [ ] **Step 1: Implement client switcher**

`studio-client.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { useStudioEnvironment } from './use-studio-environment'
import { StudioBootScreen } from './components/studio-boot-screen'
import { StudioCreateForm } from './components/studio-create-form'
import { StudioFrame } from './components/studio-frame'

export function StudioClient() {
  const { status, embedUrl, error, create } = useStudioEnvironment()
  const [confirming, setConfirming] = useState(false)

  switch (status) {
    case 'unauthenticated':
      return <CloudLanding />
    case 'not-allowed':
      return (
        <StudioBootScreen
          title="Vetra Studio is in limited preview"
          detail="Your account doesn't have access yet. Reach out to the team to be added to the preview."
        />
      )
    case 'loading':
      return <StudioBootScreen title="Loading your studio…" />
    case 'none':
      return confirming ? (
        <StudioCreateForm onCreate={create} error={error} />
      ) : (
        <div className="mx-auto mt-16 max-w-md space-y-4 text-center">
          <h1 className="text-lg font-semibold">Vetra Studio</h1>
          <p className="text-muted-foreground text-sm">
            You don&apos;t have a studio yet. Create one to start building.
          </p>
          <button
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
            onClick={() => setConfirming(true)}
          >
            Create your studio
          </button>
        </div>
      )
    case 'creating':
      return <StudioBootScreen title="Creating your studio…" detail="Provisioning the environment and agent." />
    case 'booting':
      return (
        <StudioBootScreen
          title="Starting Vetra Studio…"
          detail="The agent is booting. This can take a few minutes on first start."
        />
      )
    case 'ready':
      return embedUrl ? <StudioFrame embedUrl={embedUrl} /> : <StudioBootScreen title="Opening studio…" />
    case 'error':
      return (
        <div className="mx-auto mt-16 max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="text-destructive text-sm">{error}</p>
          {/* On create errors the form is the fastest recovery path. */}
          <StudioCreateForm onCreate={create} error={error} />
        </div>
      )
  }
}
```

`app/studio/page.tsx`:
```tsx
import { StudioClient } from '@/modules/cloud/studio/studio-client'

export default function StudioPage() {
  return <StudioClient />
}
```

- [ ] **Step 2: Type-check + lint** — `npm run tsc && npm run lint`
- [ ] **Step 3: Commit** — `feat(studio): add /studio route and client switcher`

---

### Task 9: Full verification

- [ ] **Step 1: Run the whole unit suite** — `npx vitest run --config vitest.unit.config.ts`. Expect the new studio tests to pass and no regressions beyond pre-existing failures.
- [ ] **Step 2: `npm run tsc`** — no new type errors.
- [ ] **Step 3: `npm run lint`** — clean.
- [ ] **Step 4: `npm run build`** — confirm the route compiles under Next.js.
- [ ] **Step 5: Commit** any fixes — `chore(studio): verification fixes`.

---

## Notes / deploy follow-ups (not code in this repo)

- Set `NEXT_PUBLIC_STUDIO_ALLOWLIST` on the vetra-to deployment (gitops `powerhouse-k8s-hosting`) to control studio access. Until then it defaults to the staging admin addresses.
- Validate Renown-can-sign-while-framed once deployed; the new-tab fallback in `StudioFrame` covers the case where it can't.
