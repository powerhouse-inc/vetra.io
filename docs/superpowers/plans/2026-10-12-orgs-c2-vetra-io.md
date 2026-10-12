# Renown Organisations C2 — vetra.io Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a signed-in builder work as themselves or as one of their Renown organisations on vetra.io: an org context switcher in the navbar, app and environment lists that follow the context, "New app" / "New environment" created in the context, a "Transfer to organisation" link to renown.id, support/security contact fields on the app profile, org badges on app and environment pages, and an operator sync before signed environment actions.

**Architecture:** A new `modules/orgs` module reads Renown directly (`<renown switchboard>/graphql/renown-orgs`: `organizationsByMember(address)` with the Renown bearer, `organization(id)` public) and keeps the chosen org in `localStorage["vetra.activeOrg"]` behind a `useSyncExternalStore` store; `useActiveOrg()` validates the stored id against the viewer's memberships. Every list and create flow reads `useActiveOrg().orgId` and passes it to the Vetra switchboard fields C1 added (`myApps(orgId)`, `vetraPublisher.myApps(orgId)`, `myEnvironments(scope: ORG, orgId)`, `createApp(input.orgId)`, `setEnvironmentOrg`, `syncEnvironmentOrg`). Access decisions stay server-side; the UI only chooses what to ask for.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, shadcn/Radix (`modules/shared/components/ui`), TanStack Query via `useAuthedQuery`, `@powerhousedao/reactor-browser` (Renown hooks), sonner, lucide-react, vitest + happy-dom + Testing Library, Playwright (licensing journeys).

**Spec:** `/home/f/projects/renown-package-orgs/docs/superpowers/specs/2026-10-12-renown-organisations-design.md` §6 (vetra.io bullet) with §3.2 (roles), §3.7 (transfers, contacts), §9. Server side: `/home/f/projects/vetra-cloud-package-orgs/docs/superpowers/plans/2026-10-12-orgs-c1-cloud-package.md` (Rulings 7, 10, 13, 14 and the GraphQL each task "Produces"). Renown API: the "Appendix — API contract" of `/home/f/projects/renown-package-orgs/docs/superpowers/plans/2026-10-12-orgs-a1-core.md` (`organizationsByMember`, `organization`, `OrgSummary`, roles) and A3 Ruling 9 (contacts). Executors read the spec, the C1 plan and that appendix.

**Precondition:** C1 is deployed on the Vetra staging switchboard and renown-package A1–A3 on Renown staging. Production promotion (Task 8 Step 4) only after C1 is on the prod tenant.

## Rulings

1. **Context store.** `localStorage["vetra.activeOrg"]` holds an org id or nothing (= personal). Reads and writes are wrapped in try/catch (private mode → always personal). The store notifies same-tab subscribers and listens to `storage` events (other tabs follow).
2. **Validation.** `resolveActiveOrgId(stored, orgs, failed)`: no stored id → personal; memberships loaded → the stored id only if the viewer is an ACTIVE member, else personal and the key is cleared; still loading → the stored id (no flicker; the server refuses non-members anyway); lookup failed → personal (lists keep working without Renown). A different wallet on the same browser therefore never inherits another wallet's org.
3. **Memberships.** `organizationsByMember(address: <viewer>)` is sent with the Renown bearer so hidden memberships appear; on HTTP 401/403 it retries once without the bearer (public memberships only). Archived and taken-down orgs are dropped; sorted by name.
4. **Which lists follow the context.** `/user` (apps + licensing-only apps + environments), `/user/environments`, and the environment picker of the new-app wizard. Studio products, subscriptions, packages, publisher template pickers and "add to cloud" stay personal (they pass no org). A list in org context shows every org env/app (no MINE/UNCLAIMED split; the admin "All" toggle stays personal-only).
5. **Creating in the context.** New app: `createApp` input carries `orgId` only when an org is active (older servers never see the field). New environment: created as today (signed, personal), then `setEnvironmentOrg(envId, orgId)`, retried on `ENV_NOT_FOUND` (the read model lags the push) up to 6 times, 1 s apart; if it still fails the env exists as personal and the form says so ("Created as a personal environment; moving it to <org> failed: …"). Studio environments are never created in an org.
6. **Sync before signed actions.** `loadEnvironmentController` calls `syncEnvironmentOrg(documentId)` first, best effort (errors and older servers are ignored), so an org publisher is an operator before the first push. The environment page also queries it (`useEnvironmentOrg`) for the org badge.
7. **Transfers live on renown.id.** Vetra never transfers. App settings show an "Organisation" card: personal app → "Transfer to an organisation" linking to `renownAppTransferUrl(appDid)`; org app → the org badge plus "Manage on Renown" (`renownOrgManageUrl(orgId, "apps")`). Both URLs come from one helper file (`modules/orgs/lib/links.ts`) so B's final routes are a one-line change. Ownership changes appear in Vetra on the next list load (C1 Ruling 11).
8. **Contacts.** `supportContact` / `securityContact`: optional, ≤ 200 characters, an email address (a leading `mailto:` is stripped) or an `https://` URL; `""` clears. Validated client-side with the same rule as Renown (A3 Ruling 9) and sent through `vetraPublisher.updateAppProfile`; read from `appProfile`.
9. **Badges.** `<OrgBadge orgId>` resolves `organization(id) { id handle name avatar verifiedDomains }` (public, cached 5 min), shows avatar + name + a check when a domain is verified, links to `<renown>/@<handle>`, and renders nothing for an unknown org. It appears in the app header (next to the status pill), in app settings, and in the environment header (next to the status badge).
10. **Copy.** Plain language: "Working in", "Personal", "Create an organisation", "Transfer to an organisation", "This app belongs to <org>". Org names are user content: rendered as text, truncated with `truncate`, never as HTML.

## Global Constraints

- Worktree `/home/f/projects/vetra.io-orgs`, branch `feat/organisations` (from `origin/main`; `origin/main` and `origin/staging` trees are identical). The finished branch lands on **both** `staging` and `main`: staging first, main on the user's go (Task 8).
- Conventional commits; **no `Co-Authored-By` trailer and no "Generated with" footer** in commits or PR bodies.
- Hand-written GraphQL only; field and argument names exactly as in the C1 plan and the A1 appendix. No new dependencies or UI libraries.
- Use the `@/` path alias as the codebase does; kebab-case files; `type` imports.
- Queries embed the viewer DID in their keys (`modules/cloud/query/keys.ts` rule); org-scoped keys also embed the org id.
- Layout works at 375 px: the switcher lives in the existing account dropdown, long org names truncate.
- Gates per task (`CLAUDE.md` + prior plans): `pnpm tsc 2>&1 | tail -5`, `pnpm lint 2>&1 | tail -5`, `pnpm test:unit -- <touched test files> 2>&1 | grep -E "Test Files|Tests |FAIL"`. Before Task 8: `pnpm test:unit`, `pnpm test:e2e:licensing 2>&1 | tail -15`, `pnpm build 2>&1 | tail -5`.

## Review Focus

1. **A stored org the viewer no longer belongs to** (removed, or another wallet on the same browser). Expected: once memberships load the context falls back to personal and the key is cleared; no list shows another org's data. Pinned in Task 1 ("falls back to personal once the memberships say so").
2. **Renown unreachable.** Expected: the switcher shows only "Personal", personal lists work, nothing crashes. Pinned in Task 1 ("lookup failed → personal") and Task 7 (journey with Renown offline).
3. **Creating an environment in an org while the read model lags.** Expected: the hand-over retries on `ENV_NOT_FOUND`; a final failure leaves a usable personal env and a clear message. Pinned in Task 4 ("retries ENV_NOT_FOUND, then gives up with the env id").
4. **An older switchboard without `syncEnvironmentOrg`** (or one that refuses it). Expected: the environment page and signed actions behave as before. Pinned in Task 4 ("loads even when the sync fails").
5. **Contact values with `mailto:`, surrounding spaces, `http://` or 201 characters.** Expected: `mailto:` stripped and trimmed; `http://` and over-long values refused before sending. Pinned in Task 6.

---

## File Structure

| Path | Responsibility |
| --- | --- |
| `modules/orgs/types.ts` | `OrgRole`, `OrgSummary`, `MyOrg` |
| `modules/orgs/graphql.ts` | `renownOrgsEndpoint`, `fetchMyOrganizations`, `fetchOrganizationSummary` |
| `modules/orgs/active-org.ts` | localStorage store, `resolveActiveOrgId` |
| `modules/orgs/hooks/use-orgs.ts` | `orgKeys`, `useMyOrgs`, `useActiveOrg`, `useOrgSummary` |
| `modules/orgs/lib/links.ts` | renown.id URLs (org page, manage, create, app transfer) |
| `modules/orgs/components/org-switcher.tsx`, `org-badge.tsx` | switcher menu section, badge |
| `modules/orgs/__tests__/*` | unit tests |
| `modules/shared/components/navbar/components/navbar-right-side.tsx` | mount the switcher |
| `modules/apps/{graphql,types}.ts`, `hooks/{keys,use-apps}.ts`, `components/{new-app-wizard,app-settings,app-detail}.tsx`, `app/user/apps-home.tsx` | app lists and creation in context, transfer link, badge |
| `modules/publisher/{graphql.ts,hooks/keys.ts,hooks/use-publisher.ts}` | `vetraPublisher.myApps(orgId)` |
| `modules/cloud/{graphql,client,controller,types}.ts`, `modules/cloud/org-sync.ts`, `hooks/{use-environment,use-create-environment}.ts`, `query/keys.ts`, `app/user/environments/{cloud-projects,cloud-dashboard,new-project-form}.tsx`, `app/user/environments/[project]/page.tsx` | env lists, hand-over, sync, badge |
| `modules/apps/lib/app-profile/{api,form}.ts`, `components/profile/profile-tab.tsx`, `modules/publisher/types.ts` | contacts |
| `tests/licensing/fixtures/{cloud-mock,data,renown-orgs}.ts`, `tests/licensing/org-context.spec.ts` | journeys |

Setup for every task: `cd /home/f/projects/vetra.io-orgs && git switch feat/organisations && pnpm install --frozen-lockfile 2>&1 | tail -2`. Baseline: `pnpm test:unit 2>&1 | grep -E "Test Files|Tests "` passing.

---

### Task 1: `modules/orgs` — Renown client, context store, hooks, links

**Files:**
- Create: `modules/orgs/types.ts`, `modules/orgs/graphql.ts`, `modules/orgs/active-org.ts`, `modules/orgs/hooks/use-orgs.ts`, `modules/orgs/lib/links.ts`
- Test: `modules/orgs/__tests__/orgs-graphql.test.ts`, `modules/orgs/__tests__/active-org.test.ts`

**Interfaces:**
- Consumes: `renownSwitchboardOrigin()`, `renownWebUrl()`, `renownMediaUrl()` from `@/modules/apps/lib/app-profile/renown`; `useAuthedQuery` from `@/modules/cloud/query/use-authed-query`; `useDid`, `useRenownAuthAsync` from `@powerhousedao/reactor-browser`.
- Produces: `type OrgRole = 'OWNER' | 'ADMIN' | 'PUBLISHER' | 'MEMBER'`; `type OrgSummary = { id: string; did: string; handle: string; name: string; avatar: string | null; verifiedDomains: string[] }`; `type MyOrg = OrgSummary & { role: OrgRole }`; `renownOrgsEndpoint(): string`; `fetchMyOrganizations(address: string, token: string | null, fetchImpl?: typeof fetch): Promise<MyOrg[]>`; `fetchOrganizationSummary(id: string, fetchImpl?: typeof fetch): Promise<OrgSummary | null>`; `ACTIVE_ORG_KEY = 'vetra.activeOrg'`; `readActiveOrg(): string | null`; `writeActiveOrg(id: string | null): void`; `subscribeActiveOrg(cb: () => void): () => void`; `resolveActiveOrgId(stored: string | null, orgs: MyOrg[] | undefined, failed: boolean): string | null`; `orgKeys`; `useMyOrgs()`; `useActiveOrg(): { orgId: string | null; org: MyOrg | null; orgs: MyOrg[]; isLoading: boolean; setActiveOrg(id: string | null): void }`; `useOrgSummary(orgId: string | null | undefined)`; `renownOrgPageUrl(handle)`, `renownOrgManageUrl(orgId, section)`, `renownCreateOrgUrl()`, `renownAppTransferUrl(appDid)`, `orgAvatarUrl(org)`.

- [ ] **Step 1: Write the failing tests**

`modules/orgs/__tests__/orgs-graphql.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'
import { fetchMyOrganizations, fetchOrganizationSummary, renownOrgsEndpoint } from '../graphql'

const ME = '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266'
const org = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  did: `did:web:www.renown.id:org:${id}`,
  handle: name.toLowerCase(),
  name,
  avatar: null,
  verifiedDomains: [],
  archived: false,
  takenDown: false,
  ...extra,
})
const ok = (data: unknown) =>
  new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('Renown organisations client', () => {
  it('targets renown-orgs on the Renown switchboard', () => {
    expect(renownOrgsEndpoint()).toBe('https://switchboard.renown.vetra.io/graphql/renown-orgs')
  })

  it('lists the viewer’s memberships with the bearer, without archived or taken-down orgs, by name', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: RequestInit) =>
      ok({
        organizationsByMember: [
          { role: 'MEMBER', org: org('o2', 'Zeta') },
          { role: 'ADMIN', org: org('o1', 'Acme') },
          { role: 'OWNER', org: org('o3', 'Gone', { archived: true }) },
          { role: 'OWNER', org: org('o4', 'Down', { takenDown: true }) },
        ],
      }),
    )
    const orgs = await fetchMyOrganizations(ME, 'tok', fetchImpl as unknown as typeof fetch)
    expect(orgs.map((o) => [o.name, o.role])).toStrictEqual([
      ['Acme', 'ADMIN'],
      ['Zeta', 'MEMBER'],
    ])
    const [, init] = fetchImpl.mock.calls[0]
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string).variables).toStrictEqual({ address: ME })
  })

  it('retries without the bearer when Renown refuses it', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('no', { status: 401 }))
      .mockResolvedValueOnce(ok({ organizationsByMember: [{ role: 'MEMBER', org: org('o1', 'Acme') }] }))
    const orgs = await fetchMyOrganizations(ME, 'tok', fetchImpl as unknown as typeof fetch)
    expect(orgs).toHaveLength(1)
    const second = fetchImpl.mock.calls[1][1] as RequestInit
    expect((second.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('throws on GraphQL errors and answers null for an unknown org', async () => {
    const failing = vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'boom' }] }), { status: 200 }))
    await expect(fetchMyOrganizations(ME, null, failing as unknown as typeof fetch)).rejects.toThrow('boom')
    const empty = vi.fn(async () => ok({ organization: null }))
    expect(await fetchOrganizationSummary('nope', empty as unknown as typeof fetch)).toBeNull()
  })
})
```

`modules/orgs/__tests__/active-org.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ACTIVE_ORG_KEY, readActiveOrg, resolveActiveOrgId, subscribeActiveOrg, writeActiveOrg } from '../active-org'
import type { MyOrg } from '../types'

const acme: MyOrg = { id: 'o1', did: 'did:web:x:org:o1', handle: 'acme', name: 'Acme', avatar: null, verifiedDomains: [], role: 'PUBLISHER' }

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('active org store', () => {
  it('reads, writes and clears the stored org and notifies subscribers', () => {
    const cb = vi.fn()
    const off = subscribeActiveOrg(cb)
    writeActiveOrg('o1')
    expect(window.localStorage.getItem(ACTIVE_ORG_KEY)).toBe('o1')
    expect(readActiveOrg()).toBe('o1')
    writeActiveOrg(null)
    expect(readActiveOrg()).toBeNull()
    expect(cb).toHaveBeenCalledTimes(2)
    off()
    writeActiveOrg('o2')
    expect(cb).toHaveBeenCalledTimes(2)
  })

  it('treats unusable storage as personal', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readActiveOrg()).toBeNull()
    expect(() => writeActiveOrg('o1')).not.toThrow()
  })
})

describe('resolveActiveOrgId', () => {
  it('keeps the stored org while memberships load', () => {
    expect(resolveActiveOrgId('o1', undefined, false)).toBe('o1')
  })
  it('falls back to personal once the memberships say so', () => {
    expect(resolveActiveOrgId('o1', [acme], false)).toBe('o1')
    expect(resolveActiveOrgId('o9', [acme], false)).toBeNull()
  })
  it('lookup failed → personal; nothing stored → personal', () => {
    expect(resolveActiveOrgId('o1', undefined, true)).toBeNull()
    expect(resolveActiveOrgId(null, [acme], false)).toBeNull()
  })
})
```

Run: `pnpm test:unit -- modules/orgs 2>&1 | grep -E "Test Files|Tests |FAIL"` → FAIL (modules missing).

- [ ] **Step 2: Implement types, client, store, links**

`modules/orgs/types.ts`:

```ts
export type OrgRole = 'OWNER' | 'ADMIN' | 'PUBLISHER' | 'MEMBER'

/** A Renown organisation as Vetra shows it (renown-orgs `Organization`, trimmed). */
export type OrgSummary = {
  id: string
  did: string
  handle: string
  name: string
  /** attachment://v1:<sha256>; served at <renown>/media/<id>/avatar */
  avatar: string | null
  verifiedDomains: string[]
}

export type MyOrg = OrgSummary & { role: OrgRole }
```

`modules/orgs/graphql.ts`:

```ts
import { renownSwitchboardOrigin } from '@/modules/apps/lib/app-profile/renown'
import type { MyOrg, OrgRole, OrgSummary } from './types'

/** renown-orgs GraphQL on the Renown switchboard. */
export function renownOrgsEndpoint(): string {
  return `${renownSwitchboardOrigin()}/graphql/renown-orgs`
}

const SUMMARY = 'id did handle name avatar verifiedDomains'

type Body<T> = { data?: T | null; errors?: { message?: string }[] }

async function orgsGql<T>(
  query: string,
  variables: Record<string, unknown>,
  token: string | null,
  fetchImpl: typeof fetch,
): Promise<{ status: number; body: Body<T> | null }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetchImpl(renownOrgsEndpoint(), {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  return { status: res.status, body: (await res.json().catch(() => null)) as Body<T> | null }
}

function dataOrThrow<T>({ status, body }: { status: number; body: Body<T> | null }): T {
  const message = body?.errors?.[0]?.message
  if (message) throw new Error(message)
  if (status >= 400 || !body?.data) throw new Error(`Renown answered ${status}`)
  return body.data
}

type Affiliation = { role: OrgRole; org: OrgSummary & { archived: boolean; takenDown: boolean } }

/** The viewer's ACTIVE memberships (hidden ones too when Renown accepts the bearer). */
export async function fetchMyOrganizations(
  address: string,
  token: string | null,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<MyOrg[]> {
  const query = `query VetraMyOrgs($address: String!) { organizationsByMember(address: $address) { role org { ${SUMMARY} archived takenDown } } }`
  let answer = await orgsGql<{ organizationsByMember: Affiliation[] }>(query, { address }, token, fetchImpl)
  if (token && (answer.status === 401 || answer.status === 403)) {
    answer = await orgsGql(query, { address }, null, fetchImpl)
  }
  return dataOrThrow(answer)
    .organizationsByMember.filter((a) => !a.org.archived && !a.org.takenDown)
    .map(({ role, org: { archived: _a, takenDown: _t, ...org } }) => ({ ...org, role }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function fetchOrganizationSummary(
  id: string,
  fetchImpl: typeof fetch = (input, init) => fetch(input, init),
): Promise<OrgSummary | null> {
  const query = `query VetraOrg($id: String!) { organization(id: $id) { ${SUMMARY} } }`
  return dataOrThrow(await orgsGql<{ organization: OrgSummary | null }>(query, { id }, null, fetchImpl)).organization
}
```

`modules/orgs/active-org.ts`:

```ts
import type { MyOrg } from './types'

export const ACTIVE_ORG_KEY = 'vetra.activeOrg'
const listeners = new Set<() => void>()

export function readActiveOrg(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACTIVE_ORG_KEY) || null
  } catch {
    return null
  }
}

export function writeActiveOrg(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(ACTIVE_ORG_KEY, id)
    else window.localStorage.removeItem(ACTIVE_ORG_KEY)
  } catch {
    // Private mode / blocked storage: the context simply is not remembered.
  }
  for (const cb of listeners) cb()
}

export function subscribeActiveOrg(cb: () => void): () => void {
  listeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACTIVE_ORG_KEY) cb()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(cb)
    window.removeEventListener('storage', onStorage)
  }
}

/** Rulings 2: the stored org only while it is (or may still be) one of the viewer's. */
export function resolveActiveOrgId(
  stored: string | null,
  orgs: MyOrg[] | undefined,
  failed: boolean,
): string | null {
  if (!stored) return null
  if (orgs) return orgs.some((o) => o.id === stored) ? stored : null
  return failed ? null : stored
}
```

`modules/orgs/lib/links.ts`:

```ts
import { renownMediaUrl, renownWebUrl } from '@/modules/apps/lib/app-profile/renown'
import type { OrgSummary } from '../types'

export const renownOrgPageUrl = (handle: string) => `${renownWebUrl()}/@${encodeURIComponent(handle)}`
export const renownOrgManageUrl = (orgId: string, section: 'members' | 'apps' | 'settings' = 'members') =>
  `${renownWebUrl()}/org/${encodeURIComponent(orgId)}/manage/${section}`
export const renownCreateOrgUrl = () => `${renownWebUrl()}/org/new`
/** Where the current publisher starts a person → organisation transfer (renown.id owns the flow). */
export const renownAppTransferUrl = (appDid: string) => `${renownWebUrl()}/app/${encodeURIComponent(appDid)}#transfer`
export const orgAvatarUrl = (org: Pick<OrgSummary, 'id' | 'avatar'>) =>
  org.avatar ? renownMediaUrl(org.id, 'avatar', org.avatar) : null
```

- [ ] **Step 3: Implement the hooks**

`modules/orgs/hooks/use-orgs.ts`:

```ts
'use client'

import { useDid, useRenownAuthAsync } from '@powerhousedao/reactor-browser'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useSyncExternalStore } from 'react'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { readActiveOrg, resolveActiveOrgId, subscribeActiveOrg, writeActiveOrg } from '../active-org'
import { fetchMyOrganizations, fetchOrganizationSummary } from '../graphql'
import type { MyOrg, OrgSummary } from '../types'

export const orgKeys = {
  mine: (did: string | undefined) => ['orgs', 'mine', did ?? null] as const,
  summary: (id: string) => ['orgs', 'summary', id] as const,
}

export function useMyOrgs() {
  const did = useDid()
  const auth = useRenownAuthAsync()
  const address = auth.state === 'authenticated' ? (auth.address?.toLowerCase() ?? null) : null
  return useAuthedQuery<MyOrg[]>(
    orgKeys.mine(did),
    (token) => (address ? fetchMyOrganizations(address, token) : Promise.resolve([])),
    { enabled: !!address, staleTime: 60_000, retry: 1 },
  )
}

export type ActiveOrg = {
  orgId: string | null
  org: MyOrg | null
  orgs: MyOrg[]
  isLoading: boolean
  setActiveOrg: (id: string | null) => void
}

export function useActiveOrg(): ActiveOrg {
  const stored = useSyncExternalStore(subscribeActiveOrg, readActiveOrg, () => null)
  const mine = useMyOrgs()
  const loaded = mine.data
  const failed = mine.isError && !loaded
  const orgId = resolveActiveOrgId(stored, loaded, failed)
  useEffect(() => {
    // A stored org the viewer is not (or no longer) in is forgotten.
    if (stored && loaded && orgId === null) writeActiveOrg(null)
  }, [stored, loaded, orgId])
  return {
    orgId,
    org: orgId ? (loaded?.find((o) => o.id === orgId) ?? null) : null,
    orgs: loaded ?? [],
    isLoading: mine.isLoading,
    setActiveOrg: writeActiveOrg,
  }
}

export function useOrgSummary(orgId: string | null | undefined) {
  return useQuery<OrgSummary | null>({
    queryKey: orgKeys.summary(orgId ?? ''),
    queryFn: () => fetchOrganizationSummary(orgId!),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  })
}
```

(If `useRenownAuthAsync()` exposes the address under another name in the installed `@powerhousedao/reactor-browser`, use the field the navbar uses: `auth.address ?? auth.displayAddress`.)

- [ ] **Step 4: Run tests, types, lint** — `pnpm test:unit -- modules/orgs 2>&1 | grep -E "Test Files|Tests |FAIL"`, `pnpm tsc 2>&1 | tail -5`, `pnpm lint 2>&1 | tail -5`.

- [ ] **Step 5: Commit**

```bash
git add modules/orgs
git commit -m "feat(orgs): Renown organisations client and active organisation context"
```

---

### Task 2: Org switcher in the navbar and the org badge

**Files:**
- Create: `modules/orgs/components/org-switcher.tsx`, `modules/orgs/components/org-badge.tsx`
- Modify: `modules/shared/components/navbar/components/navbar-right-side.tsx`
- Test: `modules/orgs/__tests__/org-switcher.test.tsx`, `modules/orgs/__tests__/org-badge.test.tsx`

**Interfaces:**
- Consumes: `useActiveOrg`, `useOrgSummary` (Task 1); `renownCreateOrgUrl`, `renownOrgManageUrl`, `renownOrgPageUrl`, `orgAvatarUrl` (Task 1); `DropdownMenuLabel`, `DropdownMenuRadioGroup`, `DropdownMenuRadioItem`, `DropdownMenuItem`, `DropdownMenuSeparator` from `@/modules/shared/components/ui/dropdown-menu`; `Avatar*` from `@/modules/shared/components/ui/avatar`.
- Produces: `<OrgSwitcherMenuSection />` (renders inside an open `DropdownMenuContent`), `<ActiveOrgLabel />` (inline name of the active org, or nothing), `<OrgBadge orgId={string | null | undefined} size?: 'sm' | 'md' />`.

- [ ] **Step 1: Write the failing tests**

`modules/orgs/__tests__/org-switcher.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/modules/shared/components/ui/dropdown-menu'

const setActiveOrg = vi.fn()
let state = {
  orgId: null as string | null,
  org: null as null | { id: string; name: string },
  orgs: [
    { id: 'o1', did: 'd1', handle: 'acme', name: 'Acme Robotics', avatar: null, verifiedDomains: ['acme.example'], role: 'ADMIN' },
    { id: 'o2', did: 'd2', handle: 'zeta', name: 'Zeta', avatar: null, verifiedDomains: [], role: 'MEMBER' },
  ],
  isLoading: false,
  setActiveOrg,
}
vi.mock('../hooks/use-orgs', () => ({ useActiveOrg: () => state }))

import { OrgSwitcherMenuSection } from '../components/org-switcher'

function open() {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <OrgSwitcherMenuSection />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
}

afterEach(() => {
  cleanup()
  setActiveOrg.mockClear()
})

describe('OrgSwitcherMenuSection', () => {
  it('offers Personal and every organisation, with Personal checked by default', () => {
    open()
    expect(screen.getByText('Working in')).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: /Personal/ }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('menuitemradio', { name: /Acme Robotics/ })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: /Zeta/ })).toBeTruthy()
  })

  it('switches the context', () => {
    open()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Acme Robotics/ }))
    expect(setActiveOrg).toHaveBeenCalledWith('o1')
  })

  it('links to creating an organisation and, in an org, to managing it on Renown', () => {
    state = { ...state, orgId: 'o1', org: state.orgs[0] }
    open()
    expect(screen.getByRole('menuitem', { name: /Create an organisation/ }).getAttribute('href')).toBe('https://www.renown.id/org/new')
    expect(screen.getByRole('menuitem', { name: /Manage Acme Robotics/ }).getAttribute('href')).toBe(
      'https://www.renown.id/org/o1/manage/members',
    )
  })
})
```

`modules/orgs/__tests__/org-badge.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let summary: unknown = { data: { id: 'o1', did: 'd', handle: 'acme', name: 'Acme', avatar: null, verifiedDomains: ['acme.example'] } }
vi.mock('../hooks/use-orgs', () => ({ useOrgSummary: () => summary }))

import { OrgBadge } from '../components/org-badge'

afterEach(cleanup)

describe('OrgBadge', () => {
  it('links the organisation by handle and marks a verified domain', () => {
    render(<OrgBadge orgId="o1" />)
    const link = screen.getByRole('link', { name: /Acme/ })
    expect(link.getAttribute('href')).toBe('https://www.renown.id/@acme')
    expect(screen.getByLabelText('Verified: acme.example')).toBeTruthy()
  })

  it('renders nothing without an org or for an unknown one', () => {
    const { container } = render(<OrgBadge orgId={null} />)
    expect(container.innerHTML).toBe('')
    summary = { data: null }
    const second = render(<OrgBadge orgId="nope" />)
    expect(second.container.innerHTML).toBe('')
  })
})
```

Run: `pnpm test:unit -- modules/orgs 2>&1 | grep -E "Tests |FAIL"` → FAIL.

- [ ] **Step 2: Implement the components**

`modules/orgs/components/org-switcher.tsx`:

```tsx
'use client'

import { Building2, ExternalLink, Plus, User } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from '@/modules/shared/components/ui/dropdown-menu'
import { useActiveOrg } from '../hooks/use-orgs'
import { renownCreateOrgUrl, renownOrgManageUrl } from '../lib/links'

const PERSONAL = 'personal'
const item = 'cursor-pointer rounded-md px-3 py-2 text-sm font-medium'

/** "Working in" section of the account menu: Personal + the viewer's organisations. */
export function OrgSwitcherMenuSection() {
  const { orgId, org, orgs, setActiveOrg } = useActiveOrg()
  return (
    <>
      <DropdownMenuLabel className="text-muted-foreground px-3 pt-2 pb-1 text-xs font-medium">
        Working in
      </DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={orgId ?? PERSONAL}
        onValueChange={(v) => setActiveOrg(v === PERSONAL ? null : v)}
      >
        <DropdownMenuRadioItem value={PERSONAL} className={item}>
          <User className="h-4 w-4" />
          Personal
        </DropdownMenuRadioItem>
        {orgs.map((o) => (
          <DropdownMenuRadioItem key={o.id} value={o.id} className={item}>
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="min-w-0 truncate">{o.name}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      {org && (
        <DropdownMenuItem asChild className={item}>
          <a href={renownOrgManageUrl(org.id)} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            <span className="min-w-0 truncate">Manage {org.name}</span>
          </a>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem asChild className={item}>
        <a href={renownCreateOrgUrl()} target="_blank" rel="noreferrer">
          <Plus className="h-4 w-4" />
          Create an organisation
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator className="bg-border/50" />
    </>
  )
}

/** The active organisation's name for the account button; nothing when personal. */
export function ActiveOrgLabel() {
  const { org } = useActiveOrg()
  if (!org) return null
  return <span className="text-muted-foreground max-w-[10rem] truncate text-xs">· {org.name}</span>
}
```

`modules/orgs/components/org-badge.tsx`:

```tsx
'use client'

import { BadgeCheck, Building2 } from 'lucide-react'
import { useOrgSummary } from '../hooks/use-orgs'
import { orgAvatarUrl, renownOrgPageUrl } from '../lib/links'

/** The organisation owning an app or environment, linked to its Renown page. */
export function OrgBadge({ orgId, size = 'sm' }: { orgId: string | null | undefined; size?: 'sm' | 'md' }) {
  const { data: org } = useOrgSummary(orgId)
  if (!orgId || !org) return null
  const avatar = orgAvatarUrl(org)
  const verified = org.verifiedDomains[0]
  return (
    <a
      href={renownOrgPageUrl(org.handle)}
      target="_blank"
      rel="noreferrer"
      className={`bg-muted text-foreground hover:bg-muted/70 inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 font-medium ${size === 'md' ? 'text-sm' : 'text-xs'}`}
    >
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- Renown media redirects to storage.
        <img src={avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
      ) : (
        <Building2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      )}
      <span className="min-w-0 truncate">{org.name}</span>
      {verified && <BadgeCheck className="text-primary h-3.5 w-3.5 shrink-0" aria-label={`Verified: ${verified}`} />}
    </a>
  )
}
```

`navbar-right-side.tsx` (`RenownButton`, authenticated branch): import `OrgSwitcherMenuSection` and `ActiveOrgLabel` from `@/modules/orgs/components/org-switcher`; render `<ActiveOrgLabel />` inside the trigger button after the display name; insert `<OrgSwitcherMenuSection />` directly after the first `<DropdownMenuSeparator className="bg-border/50" />` (below the account label, above "Apps"). The mobile menu reuses `RenownButton`, so it gets the switcher too.

- [ ] **Step 3: Run tests, types, lint** — `pnpm test:unit -- modules/orgs modules/shared/components/navbar 2>&1 | grep -E "Test Files|Tests |FAIL"`, `pnpm tsc 2>&1 | tail -5`, `pnpm lint 2>&1 | tail -5`.

- [ ] **Step 4: Commit**

```bash
git add modules/orgs modules/shared/components/navbar
git commit -m "feat(orgs): organisation switcher in the account menu and org badge"
```

---

### Task 3: Apps follow the context; create apps in an organisation

**Files:**
- Modify: `modules/apps/types.ts` (`App.ownerOrgId?`, `CreateAppInput.orgId?`), `modules/apps/graphql.ts` (`fetchMyApps`, `createApp`, `OPTIONAL_APP_FIELDS`), `modules/apps/hooks/keys.ts`, `modules/apps/hooks/use-apps.ts`, `modules/apps/components/new-app-wizard.tsx`, `modules/apps/components/app-detail.tsx`, `app/user/apps-home.tsx`, `modules/shared/state/route-prefetch.ts`
- Modify: `modules/publisher/graphql.ts` (`fetchPublisherApps(token, fetchImpl?, orgId?)`), `modules/publisher/hooks/keys.ts`, `modules/publisher/hooks/use-publisher.ts` (`usePublisherApps(orgId?)`, `useAppPublisher(appId, orgId?)`)
- Test: `modules/apps/__tests__/graphql.test.ts`, `app/user/__tests__/apps-home.test.tsx`, `modules/apps/__tests__/app-detail-tabs.test.tsx` (mocks only)

**Interfaces:**
- Consumes: `useActiveOrg` (Task 1), `OrgBadge` (Task 2); server `myApps(orgId: String)`, `App.ownerOrgId`, `CreateAppInput.orgId`, `vetraPublisher.myApps(orgId: String)` (C1 Tasks 6–8).
- Produces: `fetchMyApps(token, fetchImpl?, orgId?: string | null)`; `createApp(input, token)` sends `orgId` only when set; `appsKeys.list(did, orgId?: string | null)`; `publisherKeys.apps(did, orgId?: string | null)`; `fetchPublisherApps(token, fetchImpl?, orgId?)`; `usePublisherApps(orgId?: string | null)`; `useAppPublisher(appId, orgId?: string | null)`.

- [ ] **Step 1: Write the failing tests** — append to `modules/apps/__tests__/graphql.test.ts` (it already stubs `fetch`; follow its helper style):

```ts
describe('organisation apps', () => {
  afterEach(() => vi.unstubAllGlobals())

  function captureBodies(data: unknown) {
    const bodies: { query: string; variables: Record<string, unknown> }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: RequestInit) => {
        bodies.push(JSON.parse(init.body as string))
        return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }),
    )
    return bodies
  }

  it('lists an organisation’s apps with orgId, personal apps without', async () => {
    resetOptionalAppFields()
    const bodies = captureBodies({ myApps: [] })
    await fetchMyApps('tok', undefined, 'o1')
    await fetchMyApps('tok')
    expect(bodies[0].query).toContain('myApps(orgId: $orgId)')
    expect(bodies[0].variables).toStrictEqual({ orgId: 'o1' })
    expect(bodies[1].query).not.toContain('orgId')
  })

  it('creates in an organisation only when one is given', async () => {
    resetOptionalAppFields()
    const bodies = captureBodies({ createApp: { id: 'a1' } })
    await createApp({ name: 'Shop', installationId: '1', repositoryId: '2', orgId: 'o1' }, 'tok')
    await createApp({ name: 'Shop', installationId: '1', repositoryId: '2', orgId: null }, 'tok')
    expect(bodies[0].variables.input).toMatchObject({ orgId: 'o1' })
    expect(bodies[1].variables.input).not.toHaveProperty('orgId')
  })
})
```

In `app/user/__tests__/apps-home.test.tsx` add `vi.mock('@/modules/orgs/hooks/use-orgs', () => ({ useActiveOrg: () => ({ orgId: activeOrg?.id ?? null, org: activeOrg, orgs: [], isLoading: false, setActiveOrg: vi.fn() }) }))` with `let activeOrg: { id: string; name: string } | null = null` and a test:

```tsx
  it('names the organisation it is showing', () => {
    activeOrg = { id: 'o1', name: 'Acme' }
    apps = [{ id: 'a1', name: 'Shop' }]
    render(<AppsHome />)
    expect(screen.getByText(/Apps of/)).toBeTruthy()
    expect(screen.getByText(/New app in Acme/)).toBeTruthy()
    activeOrg = null
  })
```

In `modules/apps/__tests__/app-detail-tabs.test.tsx` add `vi.mock('@/modules/orgs/components/org-badge', () => ({ OrgBadge: () => null }))`.

Run: `pnpm test:unit -- modules/apps app/user 2>&1 | grep -E "Tests |FAIL"` → FAIL.

- [ ] **Step 2: Implement the data layer**

`modules/apps/types.ts`: `App` gains `/** Renown organisation owning the app; absent on older backends, null when personal. */ ownerOrgId?: string | null`; `CreateAppInput` gains `/** Create the app for this organisation. */ orgId?: string | null`.
`modules/apps/graphql.ts`:
- `OPTIONAL_APP_FIELDS = ['identityExpiresAt', 'ownerOrgId'] as const`.
- `fetchMyApps(token, fetchImpl?, orgId?: string | null)`: with `orgId` run `` `query ($orgId: String) { myApps(orgId: $orgId) { ${fields} } }` `` with `{ orgId }`; without, the existing query.
- `createApp(input, token)`: send `const { orgId, ...rest } = input; const sent = orgId ? { ...rest, orgId } : rest;` as `input`.
`modules/apps/hooks/keys.ts`: `list: (did: string | undefined, orgId: string | null = null) => ['apps', 'list', did ?? null, orgId] as const`.
`modules/apps/hooks/use-apps.ts`:
- `useMyApps()`: `const { orgId } = useActiveOrg()`; key `appsKeys.list(did, orgId)`; fetcher `(token) => fetchMyApps(token, undefined, orgId)`.
- `useCacheApp`: write into `appsKeys.list(did, app.ownerOrgId ?? null)`.
- Delete/invalidate calls that used `appsKeys.list(did)`: use the prefix `['apps', 'list']` (`qc.invalidateQueries({ queryKey: ['apps', 'list'] })`, and `qc.setQueriesData<App[]>({ queryKey: ['apps', 'list'] }, (old) => old?.filter(...))` for the delete).
`modules/shared/state/route-prefetch.ts`: pass `readActiveOrg()` (from `@/modules/orgs/active-org`) as the org id for the apps list (and, in Task 4, for environments).
`modules/publisher/hooks/keys.ts`: `apps: (did: string, orgId: string | null = null) => ['publisher', 'apps', did, orgId] as const`.
`modules/publisher/graphql.ts`: `fetchPublisherApps(token, fetchImpl?, orgId?: string | null)`; with `orgId`, both `read` calls use declaration `'($orgId: String)'`, call `` `myApps(orgId: $orgId) { ${…} }` `` and variables `{ orgId }`.
`modules/publisher/hooks/use-publisher.ts`: `usePublisherApps(orgId: string | null = null)` keys and fetches with it; `useAppPublisher(appId: string, orgId: string | null = null)` uses `usePublisherApps(orgId)`.

- [ ] **Step 3: Wire the UI**

`app/user/apps-home.tsx` (`AppsSection`): `const { orgId, org } = useActiveOrg()`; `const published = usePublisherApps(orgId)`; above the grid render `{org && <p className="text-muted-foreground text-sm">Apps of <span className="text-foreground font-medium">{org.name}</span></p>}`; `NewAppTile` label becomes `{org ? `New app in ${org.name}` : 'New app'}` (pass `org` as a prop, `truncate`).
`modules/apps/components/new-app-wizard.tsx` (configure step): `const { orgId, org } = useActiveOrg()`; `useEnvironments('MINE', viewer?.address ?? null, { orgId })` (Task 4 adds the option; until then keep the call and add the third argument in Task 4); include `orgId` in the `createApp.mutate({...})` input; show above the form `{org && <p className="text-sm">This app will belong to <strong className="font-medium">{org.name}</strong>.</p>}`. A `FORBIDDEN` from `createApp` in org context shows "You need the publisher role with access to all apps of {org.name} to create apps there." (extend `describeCreateAppError(err, repoFullName, orgName?)`).
`modules/apps/components/app-detail.tsx`: `useAppPublisher(appId, app?.ownerOrgId ?? null)`; in the header row next to `<StatusPill …/>` add `<OrgBadge orgId={app.ownerOrgId} />`.

- [ ] **Step 4: Run tests, types, lint** — `pnpm test:unit -- modules/apps modules/publisher app/user 2>&1 | grep -E "Test Files|Tests |FAIL"`, `pnpm tsc 2>&1 | tail -5`, `pnpm lint 2>&1 | tail -5`.

- [ ] **Step 5: Commit**

```bash
git add modules/apps modules/publisher modules/shared/state app/user
git commit -m "feat(orgs): app lists follow the organisation context; create apps in an organisation"
```

---

### Task 4: Environments follow the context; hand-over; sync before signed actions; env badge

**Files:**
- Create: `modules/cloud/org-sync.ts`, `modules/cloud/hooks/use-environment-org.ts`, `modules/cloud/__tests__/org-environments.test.ts`
- Modify: `modules/cloud/graphql.ts`, `modules/cloud/client.ts` (export `resolveAuthToken`), `modules/cloud/controller.ts`, `modules/cloud/types.ts` (`CloudEnvironment.ownerOrgId?`), `modules/cloud/query/keys.ts`, `modules/cloud/hooks/use-environment.ts`, `modules/cloud/hooks/use-create-environment.ts`, `app/user/environments/cloud-projects.tsx`, `app/user/environments/cloud-dashboard.tsx`, `app/user/environments/new-project-form.tsx`, `app/user/environments/[project]/page.tsx`, `modules/apps/components/new-app-wizard.tsx`

**Interfaces:**
- Consumes: `useActiveOrg` (Task 1), `OrgBadge` (Task 2); server `myEnvironments(scope: ORG, orgId)`, `VetraCloudEnvironmentSummary.ownerOrgId`, `syncEnvironmentOrg`, `setEnvironmentOrg` (C1 Tasks 4–5).
- Produces: `type ListScope = 'MINE' | 'ALL' | 'ORG'`; `EnvironmentSummary.ownerOrgId?: string | null`; `fetchMyEnvironments(scope, token?, orgId?: string | null)`; `type EnvironmentOrgAccess = { environmentId: string; ownerOrgId: string | null; canOperate: boolean; canView: boolean }`; `syncEnvironmentOrg(environmentId: string, token: string | null): Promise<EnvironmentOrgAccess>`; `setEnvironmentOrg(environmentId: string, orgId: string, token: string | null): Promise<EnvironmentOrgAccess>`; `org-sync.ts`: `withOrgSync<T>(documentId: string, load: () => Promise<T>, deps?: { sync; token }): Promise<T>`, `handOverToOrg(environmentId, orgId, token, opts?: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> }): Promise<void>`, `class EnvironmentHandOverError extends Error { environmentId: string }`; `queryKeys.environments(scope, did, orgId?)`; `queryKeys.environmentOrg(envId, did)`; `useEnvironments(viewScope?, viewerAddress?, options?: { orgId?: string | null })`; `useEnvironmentOrg(documentId)`; `CreateEnvironmentInput.orgId?: string | null`.

- [ ] **Step 1: Write the failing tests**

`modules/cloud/__tests__/org-environments.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchMyEnvironments, setEnvironmentOrg, syncEnvironmentOrg } from '@/modules/cloud/graphql'
import { EnvironmentHandOverError, handOverToOrg, withOrgSync } from '@/modules/cloud/org-sync'

afterEach(() => vi.unstubAllGlobals())

function stub(answers: Array<{ data?: unknown; errors?: { message: string }[] }>) {
  const bodies: { query: string; variables: Record<string, unknown> }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(init.body as string))
      const next = answers.shift() ?? { data: null }
      return new Response(JSON.stringify(next), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }),
  )
  return bodies
}

describe('organisation environments', () => {
  it('lists an organisation’s environments with scope ORG and orgId', async () => {
    const bodies = stub([{ data: { myEnvironments: [{ id: 'e1', ownerOrgId: 'o1' }] } }])
    const envs = await fetchMyEnvironments('ORG', 'tok', 'o1')
    expect(envs).toStrictEqual([{ id: 'e1', ownerOrgId: 'o1' }])
    expect(bodies[0].variables).toStrictEqual({ scope: 'ORG', orgId: 'o1' })
    expect(bodies[0].query).toContain('myEnvironments(scope: $scope, orgId: $orgId)')
  })

  it('syncs and hands over through the observability mutations', async () => {
    const access = { environmentId: 'e1', ownerOrgId: 'o1', canOperate: true, canView: true }
    const bodies = stub([{ data: { syncEnvironmentOrg: access } }, { data: { setEnvironmentOrg: access } }])
    expect(await syncEnvironmentOrg('e1', 'tok')).toStrictEqual(access)
    expect(await setEnvironmentOrg('e1', 'o1', 'tok')).toStrictEqual(access)
    expect(bodies[1].variables).toStrictEqual({ environmentId: 'e1', orgId: 'o1' })
  })

  it('retries ENV_NOT_FOUND, then gives up with the env id', async () => {
    const sleep = vi.fn(async () => undefined)
    stub([{ errors: [{ message: 'ENV_NOT_FOUND' }] }, { data: { setEnvironmentOrg: { environmentId: 'e1', ownerOrgId: 'o1', canOperate: true, canView: true } } }])
    await handOverToOrg('e1', 'o1', 'tok', { sleep })
    expect(sleep).toHaveBeenCalledTimes(1)

    stub(Array.from({ length: 3 }, () => ({ errors: [{ message: 'ENV_NOT_FOUND' }] })))
    await expect(handOverToOrg('e1', 'o1', 'tok', { attempts: 3, sleep })).rejects.toBeInstanceOf(EnvironmentHandOverError)

    stub([{ errors: [{ message: 'FORBIDDEN' }] }])
    await expect(handOverToOrg('e1', 'o1', 'tok', { sleep })).rejects.toMatchObject({ environmentId: 'e1', message: expect.stringContaining('FORBIDDEN') })
  })

  it('loads even when the sync fails', async () => {
    const order: string[] = []
    const result = await withOrgSync(
      'e1',
      async () => {
        order.push('load')
        return 'doc'
      },
      {
        sync: async () => {
          order.push('sync')
          throw new Error('Cannot query field "syncEnvironmentOrg"')
        },
        token: async () => 'tok',
      },
    )
    expect(result).toBe('doc')
    expect(order).toStrictEqual(['sync', 'load'])
  })
})
```

Run: `pnpm test:unit -- modules/cloud/__tests__/org-environments.test.ts 2>&1 | grep -E "Tests |FAIL"` → FAIL.

- [ ] **Step 2: Implement the data layer**

`modules/cloud/graphql.ts`:
- `export type ListScope = 'MINE' | 'ALL' | 'ORG'`; `EnvironmentSummary` gains `/** Renown organisation owning the env; null/absent when personal. */ ownerOrgId?: string | null`.
- `const MY_ENVIRONMENTS_APP_FIELDS = \`appId appRole prNumber ownerOrgId\`` (the existing fallback drops them together on older servers; C2 ships after C1, Ruling in the C1 plan).
- `fetchMyEnvironments(scope = 'MINE', token?, orgId?: string | null)`: in `run`, when `scope === 'ORG'` use `` `query ($scope: ListScope!, $orgId: String) { myEnvironments(scope: $scope, orgId: $orgId) { ${fields} } }` `` with `{ scope, orgId }`, otherwise the existing query.
- Append:

```ts
export type EnvironmentOrgAccess = {
  environmentId: string
  ownerOrgId: string | null
  canOperate: boolean
  canView: boolean
}
const ORG_ACCESS_FIELDS = 'environmentId ownerOrgId canOperate canView'

/** Refresh the caller's operator entry / read grant on an org env (C1 Ruling 8). */
export async function syncEnvironmentOrg(environmentId: string, token: string | null): Promise<EnvironmentOrgAccess> {
  const data = await gql<{ syncEnvironmentOrg: EnvironmentOrgAccess }>(
    `mutation ($environmentId: String!) { syncEnvironmentOrg(environmentId: $environmentId) { ${ORG_ACCESS_FIELDS} } }`,
    { environmentId },
    token,
  )
  return data.syncEnvironmentOrg
}

/** Hand a personal environment to an organisation (C1 Ruling 7). */
export async function setEnvironmentOrg(
  environmentId: string,
  orgId: string,
  token: string | null,
): Promise<EnvironmentOrgAccess> {
  const data = await gql<{ setEnvironmentOrg: EnvironmentOrgAccess }>(
    `mutation ($environmentId: String!, $orgId: String!) { setEnvironmentOrg(environmentId: $environmentId, orgId: $orgId) { ${ORG_ACCESS_FIELDS} } }`,
    { environmentId, orgId },
    token,
  )
  return data.setEnvironmentOrg
}
```

(`gql` already throws `Error(<first GraphQL error message>)`; the server's errors are plain messages like `ENV_NOT_FOUND`.)

`modules/cloud/client.ts`: rename `resolveToken` to `export async function resolveAuthToken()` and use it in `withAuth`.
`modules/cloud/org-sync.ts`:

```ts
import { resolveAuthToken } from './client'
import { setEnvironmentOrg, syncEnvironmentOrg } from './graphql'

/** Best-effort operator sync, then the load (Rulings 6). */
export async function withOrgSync<T>(
  documentId: string,
  load: () => Promise<T>,
  deps: {
    sync: (id: string, token: string | null) => Promise<unknown>
    token: () => Promise<string | null>
  } = { sync: syncEnvironmentOrg, token: resolveAuthToken },
): Promise<T> {
  try {
    await deps.sync(documentId, await deps.token())
  } catch {
    // Older switchboards, personal envs and Renown outages: load as before.
  }
  return load()
}

export class EnvironmentHandOverError extends Error {
  override name = 'EnvironmentHandOverError'
  constructor(
    readonly environmentId: string,
    message: string,
  ) {
    super(message)
  }
}

/** setEnvironmentOrg, retried while the read model has not caught up with the new env. */
export async function handOverToOrg(
  environmentId: string,
  orgId: string,
  token: string | null,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<void> {
  const attempts = opts.attempts ?? 6
  const delayMs = opts.delayMs ?? 1000
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  for (let i = 1; ; i++) {
    try {
      await setEnvironmentOrg(environmentId, orgId, token)
      return
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!/ENV_NOT_FOUND/.test(message) || i >= attempts) {
        throw new EnvironmentHandOverError(environmentId, message)
      }
      await sleep(delayMs)
    }
  }
}
```

`modules/cloud/controller.ts`: `loadEnvironmentController(options)` returns `withOrgSync(options.documentId, () => RemoteDocumentController.pull(…same args…))`.
`modules/cloud/types.ts`: `CloudEnvironment` gains `ownerOrgId?: string | null`.
`modules/cloud/query/keys.ts`: `environments: (scope: string, did: string | undefined, orgId: string | null = null) => ['environments', scope, did ?? null, orgId] as const`; `environmentOrg: (envId: string, did: string | undefined) => ['environment-org', envId, did ?? null] as const`.
`modules/cloud/hooks/use-environment.ts`:
- `myEnvironmentsQuery(did, scope = 'MINE', orgId: string | null = null)` → key `queryKeys.environments(scope, did, orgId)`, fetch `fetchMyEnvironments(scope, token, orgId)`.
- `summaryToCloudEnvironment` sets `ownerOrgId: summary.ownerOrgId ?? null`.
- `useEnvironments(viewScope = 'MINE', viewerAddress = null, options: { orgId?: string | null } = {})`: `const orgId = options.orgId ?? null; const backendScope: ListScope = orgId ? 'ORG' : viewScope === 'ALL' ? 'ALL' : 'MINE'`; query `myEnvironmentsQuery(did, backendScope, orgId)`; in the memo, `orgId ? data.map(summaryToCloudEnvironment) : filterByScope(data, viewScope, viewerAddress).map(summaryToCloudEnvironment)` (keep the existing empty-data handling).
`modules/cloud/hooks/use-environment-org.ts`:

```ts
'use client'

import { useDid } from '@powerhousedao/reactor-browser'
import { syncEnvironmentOrg, type EnvironmentOrgAccess } from '../graphql'
import { queryKeys } from '../query/keys'
import { useAuthedQuery } from '../query/use-authed-query'

/** The env's organisation and the viewer's access (also refreshes their operator entry). */
export function useEnvironmentOrg(documentId: string | null) {
  const did = useDid()
  return useAuthedQuery<EnvironmentOrgAccess | null>(
    queryKeys.environmentOrg(documentId ?? '', did),
    async (token) => (documentId ? syncEnvironmentOrg(documentId, token).catch(() => null) : null),
    { enabled: !!documentId && !!did, staleTime: 30_000 },
  )
}
```

`modules/cloud/hooks/use-create-environment.ts`: `CreateEnvironmentInput.orgId?: string | null`; after `controller.push()`:

```ts
      const documentId = result.remoteDocument.id
      if (input.orgId) await handOverToOrg(documentId, input.orgId, await resolveAuthToken())
      return { documentId }
```

- [ ] **Step 3: Wire the UI**

`app/user/environments/cloud-projects.tsx` (`CloudEnvironments`): `const { orgId, org } = useActiveOrg()`; `useEnvironments(scope, viewer?.address ?? null, { orgId })`; hide the admin scope toggle when `orgId` is set; the empty state in org context reads "No environments in {org.name} yet."
`app/user/environments/cloud-dashboard.tsx`: `useEnvironments('MINE', null, { orgId })` with `orgId` from `useActiveOrg()`; heading `{org ? `${org.name} environments` : 'Your Environments'}`.
`app/user/environments/new-project-form.tsx`: `const { orgId, org } = useActiveOrg()`; pass `orgId` to `createEnv({...})`; in the `catch`, `if (err instanceof EnvironmentHandOverError) { onCreated?.(err.environmentId); setError(`Created as a personal environment; moving it to ${org?.name ?? 'the organisation'} failed: ${err.message}`) }`; show `{org && <p className="text-muted-foreground text-sm">It will belong to {org.name}.</p>}` above the submit button (create mode only).
`modules/apps/components/new-app-wizard.tsx`: the existing-environment picker uses `useEnvironments('MINE', viewer?.address ?? null, { orgId })`.
`app/user/environments/[project]/page.tsx` (`EnvironmentDetail`): `const orgAccess = useEnvironmentOrg(documentId)`; next to `<StatusBadge …/>` render `<OrgBadge orgId={orgAccess.data?.ownerOrgId} />`.

Any existing unit test that renders these components without a `QueryClientProvider` for the new hooks mocks them: `vi.mock('@/modules/orgs/hooks/use-orgs', () => ({ useActiveOrg: () => ({ orgId: null, org: null, orgs: [], isLoading: false, setActiveOrg: vi.fn() }) }))` and `vi.mock('@/modules/cloud/hooks/use-environment-org', () => ({ useEnvironmentOrg: () => ({ data: null }) }))` (find them with `grep -rln "cloud-projects\|new-project-form\|environments/\[project\]" app modules --include=*.test.tsx`).

- [ ] **Step 4: Run tests, types, lint** — `pnpm test:unit -- modules/cloud modules/apps app/user 2>&1 | grep -E "Test Files|Tests |FAIL"`, `pnpm tsc 2>&1 | tail -5`, `pnpm lint 2>&1 | tail -5`.

- [ ] **Step 5: Commit**

```bash
git add modules/cloud modules/apps app/user
git commit -m "feat(orgs): environments follow the organisation context; hand-over and operator sync"
```

---

### Task 5: "Transfer to an organisation" in app settings

**Files:**
- Modify: `modules/apps/components/app-settings.tsx`
- Test: `modules/apps/__tests__/app-settings-org.test.tsx`

**Interfaces:**
- Consumes: `OrgBadge` (Task 2); `renownAppTransferUrl`, `renownOrgManageUrl` (Task 1); `App.ownerOrgId` (Task 3).
- Produces: `OrganisationCard({ app }: { app: App })` exported from `app-settings.tsx`, rendered between `IdentityCard` and `DangerZone`.

- [ ] **Step 1: Write the failing test**

`modules/apps/__tests__/app-settings-org.test.tsx`:

```tsx
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { App } from '../types'

vi.mock('@/modules/orgs/components/org-badge', () => ({ OrgBadge: ({ orgId }: { orgId: string }) => <span>badge:{orgId}</span> }))
import { OrganisationCard } from '../components/app-settings'

const app = (over: Partial<App> = {}) => ({ id: 'a1', name: 'Shop', identityDid: 'did:key:zShop', ownerOrgId: null, ...over }) as App

afterEach(cleanup)

describe('OrganisationCard', () => {
  it('offers the Renown transfer for a personal app', () => {
    render(<OrganisationCard app={app()} />)
    expect(screen.getByRole('link', { name: /Transfer to an organisation/ }).getAttribute('href')).toBe(
      'https://www.renown.id/app/did%3Akey%3AzShop#transfer',
    )
  })

  it('shows the owning organisation and where to manage it', () => {
    render(<OrganisationCard app={app({ ownerOrgId: 'o1' })} />)
    expect(screen.getByText('badge:o1')).toBeTruthy()
    expect(screen.getByRole('link', { name: /Manage on Renown/ }).getAttribute('href')).toBe(
      'https://www.renown.id/org/o1/manage/apps',
    )
    expect(screen.queryByRole('link', { name: /Transfer to an organisation/ })).toBeNull()
  })
})
```

Run: `pnpm test:unit -- modules/apps/__tests__/app-settings-org.test.tsx 2>&1 | grep -E "Tests |FAIL"` → FAIL.

- [ ] **Step 2: Implement** — in `app-settings.tsx`:

```tsx
/** Who owns the app on Renown, and where ownership changes (renown.id). */
export function OrganisationCard({ app }: { app: App }) {
  if (app.ownerOrgId) {
    return (
      <SettingsCard
        title="Organisation"
        description="This app belongs to an organisation. Its owners move it to someone else on Renown."
      >
        <div className="flex flex-wrap items-center gap-3">
          <OrgBadge orgId={app.ownerOrgId} size="md" />
          <a className="text-primary text-sm font-medium hover:underline" href={renownOrgManageUrl(app.ownerOrgId, 'apps')} target="_blank" rel="noreferrer">
            Manage on Renown
          </a>
        </div>
      </SettingsCard>
    )
  }
  return (
    <SettingsCard
      title="Organisation"
      description="Move this app to one of your organisations. Renown asks the organisation to accept; the app keeps its stats and history. The app needs a Renown profile (Profile tab) first."
    >
      <a className="text-primary inline-flex items-center gap-2 text-sm font-medium hover:underline" href={renownAppTransferUrl(app.identityDid)} target="_blank" rel="noreferrer">
        Transfer to an organisation
      </a>
    </SettingsCard>
  )
}
```

and render `<OrganisationCard app={app} />` in `AppSettings` between `IdentityCard` and `DangerZone`. Imports: `OrgBadge` from `@/modules/orgs/components/org-badge`, `renownAppTransferUrl`, `renownOrgManageUrl` from `@/modules/orgs/lib/links`.

- [ ] **Step 3: Run tests, types, lint; Step 4: Commit**

```bash
git add modules/apps
git commit -m "feat(orgs): link app transfers to Renown from app settings"
```

---

### Task 6: Support and security contacts on the app profile

**Files:**
- Modify: `modules/apps/lib/app-profile/form.ts`, `modules/apps/lib/app-profile/api.ts`, `modules/apps/components/profile/profile-tab.tsx`, `modules/publisher/types.ts` (`UpdateAppProfileInput`)
- Test: `modules/apps/__tests__/app-profile-lib.test.ts`, `modules/apps/__tests__/profile-tab.test.tsx`

**Interfaces:**
- Consumes: C1 `UpdateAppProfileInput.supportContact/securityContact`; Renown `AppProfile.supportContact/securityContact` (A3).
- Produces: `PROFILE_LIMITS.contact = 200`; `normalizeContact(value: string): string`; `isContact(value: string): boolean`; `AppProfileForm.supportContact: string`, `.securityContact: string`; `AppProfileField` adds `'supportContact' | 'securityContact'`; `AppProfileChanges.supportContact?`, `.securityContact?`; `RenownAppProfile.supportContact?: string | null`, `.securityContact?: string | null`.

- [ ] **Step 1: Write the failing tests** — append to `app-profile-lib.test.ts` (import the new names from `../lib/app-profile/form`):

```ts
describe('contacts', () => {
  it('accepts emails and https URLs, strips mailto: and spaces, refuses the rest', () => {
    expect(normalizeContact('  mailto:help@acme.example ')).toBe('help@acme.example')
    expect(isContact('help@acme.example')).toBe(true)
    expect(isContact('https://acme.example/security')).toBe(true)
    expect(isContact('http://acme.example')).toBe(false)
    expect(isContact('not a contact')).toBe(false)
    expect(isContact(`${'x'.repeat(190)}@acme.example`)).toBe(false)
  })

  it('reports problems per field and sends only changed, normalised values ("" clears)', () => {
    const initial = formFromProfile({ ...profile, supportContact: 'help@acme.example', securityContact: null })
    expect(initial.supportContact).toBe('help@acme.example')
    expect(formProblems({ ...initial, securityContact: 'http://x' })).toMatchObject({ securityContact: 'Use an email address or an https:// link.' })
    expect(changedFields(initial, { ...initial, supportContact: '', securityContact: ' mailto:sec@acme.example' })).toStrictEqual({
      supportContact: '',
      securityContact: 'sec@acme.example',
    })
    expect(fieldForServer('supportContact')).toBe('supportContact')
  })
})
```

(`profile` = the file's existing sample `RenownAppProfile`; add one if absent with every field `null` and `links: []`.)

In `profile-tab.test.tsx` add a test that the two inputs labelled "Support contact" and "Security contact" render and that typing `http://x` into "Security contact" shows "Use an email address or an https:// link." after Save.

Run: `pnpm test:unit -- modules/apps 2>&1 | grep -E "Tests |FAIL"` → FAIL.

- [ ] **Step 2: Implement**

`api.ts`: `RenownAppProfile` gains `/** Absent from Renown before organisations (A3). */ supportContact?: string | null` and `securityContact?: string | null`; `FIELDS` gains ` supportContact securityContact`.
`form.ts`:

```ts
// in PROFILE_LIMITS
  contact: 200,

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** As Renown stores it: trimmed, without a mailto: prefix. */
export function normalizeContact(value: string): string {
  return value.trim().replace(/^mailto:/i, '')
}

/** An email address or an https:// URL of at most 200 characters (Renown's rule). */
export function isContact(value: string): boolean {
  const v = normalizeContact(value)
  if (!v || v.length > PROFILE_LIMITS.contact) return false
  if (EMAIL.test(v)) return true
  try {
    return new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}
```

- `AppProfileForm`, `AppProfileChanges` and `AppProfileField` gain the two fields; `formFromProfile` sets `supportContact: profile?.supportContact ?? ''` (same for security).
- `formProblems`: for each of the two fields, `const v = form[key].trim(); if (v && !isContact(v)) out[key] = 'Use an email address or an https:// link.'`.
- `changedFields`: for each of the two fields, `const next = normalizeContact(current[key]); if (next !== normalizeContact(initial[key])) out[key] = next`.
- `fieldForServer`: add `case 'supportContact': case 'securityContact': return field`.
`modules/publisher/types.ts`: `UpdateAppProfileInput` gains `supportContact?: string` and `securityContact?: string`.
`profile-tab.tsx`: after the Description field add a section

```tsx
        <section className="grid gap-4 sm:grid-cols-2" aria-labelledby="profile-contacts-heading">
          <h3 id="profile-contacts-heading" className="text-sm font-medium sm:col-span-2">Contacts</h3>
          <ProfileField id="profile-support" label="Support contact" hint="Email or https:// link" error={errorFor('supportContact')}>
            <Input
              id="profile-support"
              aria-describedby={describedBy('profile-support', errorFor('supportContact'), true)}
              placeholder="help@example.com"
              value={form.supportContact}
              aria-invalid={!!errorFor('supportContact')}
              onChange={(e) => set('supportContact', e.target.value)}
            />
          </ProfileField>
          <ProfileField id="profile-security" label="Security contact" hint="Where to report vulnerabilities" error={errorFor('securityContact')}>
            <Input
              id="profile-security"
              aria-describedby={describedBy('profile-security', errorFor('securityContact'), true)}
              placeholder="https://example.com/.well-known/security.txt"
              value={form.securityContact}
              aria-invalid={!!errorFor('securityContact')}
              onChange={(e) => set('securityContact', e.target.value)}
            />
          </ProfileField>
        </section>
```

(match `ProfileField`'s actual props; `set` is the tab's existing setter).

- [ ] **Step 3: Run tests, types, lint; Step 4: Commit**

```bash
git add modules/apps modules/publisher/types.ts
git commit -m "feat(orgs): support and security contacts on the app profile"
```

---

### Task 7: Licensing journey — organisation context end to end

**Files:**
- Create: `tests/licensing/fixtures/renown-orgs.ts`, `tests/licensing/org-context.spec.ts`
- Modify: `tests/licensing/fixtures/cloud-mock.ts`, `tests/licensing/fixtures/data.ts`

**Interfaces:**
- Consumes: everything above; the existing `routeRenown`, `logIn`, `mockCloud`, `baseState`, `unexpectedCalls` fixtures.
- Produces: `routeRenownOrgs(page, orgs: Array<{ id; name; handle; role }> | 'offline')`; `CloudState.orgApps: Record<string, App[]>`, `CloudState.orgEnvironments: Array<EnvironmentSummary & { ownerOrgId: string }>`, `CloudState.orgCalls: string[]`.

- [ ] **Step 1: Extend the mocks**

`data.ts`: `CloudState` gains `orgApps: Record<string, App[]>`, `orgEnvironments: Array<Record<string, unknown> & { id: string; ownerOrgId: string }>`, `orgCalls: string[]`; `baseState()` sets `orgApps: {}`, `orgEnvironments: []`, `orgCalls: []`.
`cloud-mock.ts` — insert at the **top** of `HANDLERS` (first match wins; these must precede the existing `myApps` / `myEnvironments` handlers):

```ts
  {
    match: /vetraPublisher\s*\{\s*myApps\(orgId:/,
    reply: (v, s) => pub('myApps', (s.orgApps[v.orgId] ?? []).map((a) => ({ id: a.id, name: a.name, status: 'ACTIVE', identityDid: a.identityDid }))),
  },
  { match: /\bmyApps\(orgId:/, reply: (v, s) => ({ myApps: s.orgApps[v.orgId] ?? [] }) },
  {
    match: /\bmyEnvironments\(/,
    reply: (v, s) => ({ myEnvironments: v.scope === 'ORG' ? s.orgEnvironments.filter((e) => e.ownerOrgId === v.orgId) : [] }),
  },
  {
    match: /\bsyncEnvironmentOrg\(/,
    reply: (v, s) => {
      s.orgCalls.push(`sync:${v.environmentId}`)
      const env = s.orgEnvironments.find((e) => e.id === v.environmentId)
      return { syncEnvironmentOrg: { environmentId: v.environmentId, ownerOrgId: env?.ownerOrgId ?? null, canOperate: true, canView: true } }
    },
  },
  {
    match: /\bsetEnvironmentOrg\(/,
    reply: (v, s) => {
      s.orgCalls.push(`set:${v.environmentId}:${v.orgId}`)
      return { setEnvironmentOrg: { environmentId: v.environmentId, ownerOrgId: v.orgId, canOperate: true, canView: true } }
    },
  },
```

and delete the old `{ match: /\bmyEnvironments\(/, reply: () => ({ myEnvironments: [] }) }` (now covered).

`fixtures/renown-orgs.ts`:

```ts
import type { Page } from '@playwright/test'

const ORGS_URL = 'https://switchboard.renown.vetra.io/graphql/renown-orgs'

type Org = { id: string; name: string; handle: string; role: 'OWNER' | 'ADMIN' | 'PUBLISHER' | 'MEMBER' }

/** Renown's renown-orgs answers (register after routeRenown so this route wins). */
export async function routeRenownOrgs(page: Page, orgs: Org[] | 'offline'): Promise<void> {
  await page.route(ORGS_URL, async (route) => {
    if (orgs === 'offline') return route.fulfill({ status: 503, body: 'down' })
    const { query = '', variables = {} } = (route.request().postDataJSON() ?? {}) as {
      query?: string
      variables?: Record<string, string>
    }
    const summary = (o: Org) => ({ id: o.id, did: `did:web:www.renown.id:org:${o.id}`, handle: o.handle, name: o.name, avatar: null, verifiedDomains: [] })
    if (query.includes('organizationsByMember')) {
      return route.fulfill({
        json: { data: { organizationsByMember: orgs.map((o) => ({ role: o.role, org: { ...summary(o), archived: false, takenDown: false } })) } },
      })
    }
    if (query.includes('organization(')) {
      const o = orgs.find((x) => x.id === variables.id)
      return route.fulfill({ json: { data: { organization: o ? summary(o) : null } } })
    }
    return route.fulfill({ json: { data: null, errors: [{ message: 'not mocked' }] } })
  })
}
```

- [ ] **Step 2: Write the journeys**

`tests/licensing/org-context.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test'
import { logIn, routeRenown } from './fixtures/auth'
import { mockCloud, unexpectedCalls } from './fixtures/cloud-mock'
import { app, baseState, ME } from './fixtures/data'
import { routeRenownOrgs } from './fixtures/renown-orgs'

const ACME = { id: 'org-acme', name: 'Acme Robotics', handle: 'acme', role: 'ADMIN' as const }

function orgState() {
  const s = baseState()
  s.orgApps[ACME.id] = [{ ...app('app-robot', 'Robot Control'), ownerOrgId: ACME.id }]
  s.orgEnvironments = [{ id: 'env-acme', name: 'Acme staging', subdomain: 'acme-staging', tenantId: null, customDomain: null, status: 'READY', owner: ME, createdBy: ME, ownerOrgId: ACME.id, packages: [], services: [] }]
  return s
}

async function switchTo(page: Page, name: RegExp) {
  await page.locator('button[aria-haspopup="menu"]:has([data-slot="avatar"])').first().click()
  await page.getByRole('menuitemradio', { name }).click()
}

test.describe('organisation context', () => {
  test.skip(({ isMobile }) => isMobile, 'the account menu with the switcher sits in the desktop navbar')

  test('switching to an organisation shows its apps and environments and survives a reload', async ({ page }) => {
    const s = orgState()
    await routeRenown(page)
    await routeRenownOrgs(page, [ACME])
    await mockCloud(page, s)
    await logIn(page)

    await page.goto('/user')
    await expect(page.getByText('Knowledge Vault')).toBeVisible()
    await switchTo(page, /Acme Robotics/)
    await expect(page.getByText('Robot Control')).toBeVisible()
    await expect(page.getByText('Knowledge Vault')).toHaveCount(0)
    await expect(page.getByText(/Apps of\s+Acme Robotics/)).toBeVisible()

    await page.goto('/user/environments')
    await expect(page.getByText('Acme staging')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Acme staging')).toBeVisible()
    expect(unexpectedCalls(s)).toStrictEqual([])

    await switchTo(page, /Personal/)
    await expect(page.getByText('Acme staging')).toHaveCount(0)
  })

  test('without Renown the switcher offers only Personal and the lists still load', async ({ page }) => {
    const s = orgState()
    await routeRenown(page)
    await routeRenownOrgs(page, 'offline')
    await mockCloud(page, s)
    await logIn(page)
    await page.evaluate(() => window.localStorage.setItem('vetra.activeOrg', 'org-acme'))
    await page.goto('/user')
    await expect(page.getByText('Knowledge Vault')).toBeVisible()
    await page.locator('button[aria-haspopup="menu"]:has([data-slot="avatar"])').first().click()
    await expect(page.getByRole('menuitemradio')).toHaveCount(1)
  })
})
```

(Adjust the copy matchers to the final UI strings of Tasks 3–4 if they differ; keep the assertions' intent.)

- [ ] **Step 3: Run the journeys**

Run: `pnpm test:e2e:licensing -- org-context.spec.ts 2>&1 | tail -15` → both pass on `desktop` (skipped on `mobile`).
Run: `pnpm test:e2e:licensing 2>&1 | tail -15` → every existing journey still passes (the new `myEnvironments` handler answers `[]` for personal scopes as before).

- [ ] **Step 4: Commit**

```bash
git add tests/licensing
git commit -m "test(orgs): licensing journey for the organisation context"
```

---

### Task 8: Final gates and landing on staging, then main

**Files:** none new.

- [ ] **Step 1: Whole-repo gates**

Run: `pnpm tsc 2>&1 | tail -5`, `pnpm lint 2>&1 | tail -5`, `pnpm test:unit 2>&1 | grep -E "Test Files|Tests |FAIL"`, `pnpm test:e2e:licensing 2>&1 | tail -15`, `pnpm build 2>&1 | tail -5`.
Expected: all green.

- [ ] **Step 2: PR to staging**

```bash
git push -u origin feat/organisations
git diff --shortstat origin/staging...feat/organisations   # only this branch's changes
gh pr create --base staging --head feat/organisations \
  --title "feat(orgs): Renown organisations on vetra.io" \
  --body "Org context switcher, org-scoped app and environment lists, create in an organisation, transfer link to renown.id, contact fields, org badges, operator sync before signed actions. Needs vetra-cloud-package C1 on the staging switchboard and renown-package A1–A3 on Renown staging."
```

(No trailers or generated-with lines in the body.) After CI and review, merge; `publish-docker-image.yml` deploys `staging → tenants/staging`.

- [ ] **Step 3: Verify on staging.vetra.io**

With a wallet that is a PUBLISHER of a staging Renown org: switch to it in the account menu; `/user` lists the org's apps; create an environment in the org (it appears under the org within a few seconds, owner badge shown on its page); open it and change a setting (signed push succeeds — the sync made you an operator); add a support contact on an app profile and see it on `renown-staging.vetra.io/app/<did>`; switch back to Personal.

- [ ] **Step 4: Land on main (on the user's go, after C1 is on the prod tenant)**

```bash
git fetch origin
git checkout -B main origin/main
git merge origin/staging --no-edit
pnpm tsc 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3
git push origin main
git diff --shortstat origin/main origin/staging   # expect empty: both branches carry the change
```
