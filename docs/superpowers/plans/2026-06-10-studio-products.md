# `/studio` Products Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `/studio` into a Products grid — list the user's vetra-cli studio environments as cards (title/tagline/description from each agent's BrandSheet), open any product (embed at `/studio/[envId]`), and create a new product (provision a new studio instance).

**Architecture:** Generalize detection to return all studio envs; per-env fetch BrandSheet metadata + runtime status from the agent switchboard (Renown bearer). `/studio` renders a grid; `/studio/[envId]` reuses the existing embed flow scoped to one env. Pure helpers are unit-tested; hooks compose them with stable effect deps.

**Tech Stack:** Next.js App Router, React 19, TypeScript, vitest (happy-dom, `vitest.unit.config.ts`), `@powerhousedao/reactor-browser` (Renown).

**Test command (all tasks):** `npx vitest run --config vitest.unit.config.ts`
**Lint/type:** `./node_modules/.bin/eslint <paths>` and `./node_modules/.bin/tsc`
(Run binaries directly — the pnpm wrapper re-verifies deps in this env.)

## File structure

- `modules/cloud/studio/find-studio-agent.ts` — MODIFY: add `findStudioAgents` (plural); `findStudioAgent` delegates.
- `modules/cloud/studio/studio-readiness.ts` — MODIFY: add `deriveProductStatus`.
- `modules/cloud/studio/fetch-product-brand.ts` — CREATE: `BRAND_QUERY`, `parseBrandSheet`, `fetchProductBrand`, `ProductBrand`.
- `modules/cloud/studio/use-studio-products.ts` — CREATE: products list hook.
- `modules/cloud/studio/use-studio-product-embed.ts` — CREATE: single-env embed hook.
- `modules/cloud/studio/components/studio-product-card.tsx` — CREATE.
- `modules/cloud/studio/components/new-product-card.tsx` — CREATE.
- `modules/cloud/studio/components/studio-products-grid.tsx` — CREATE.
- `modules/cloud/studio/studio-embed-client.tsx` — CREATE.
- `app/studio/page.tsx` — MODIFY: render `StudioProductsGrid`.
- `app/studio/[envId]/page.tsx` — CREATE: render `StudioEmbedClient`.
- DELETE (superseded): `modules/cloud/studio/studio-client.tsx`, `modules/cloud/studio/use-studio-environment.ts`.

---

### Task 1: `findStudioAgents` (all matches)

**Files:**
- Modify: `modules/cloud/studio/find-studio-agent.ts`
- Test: `modules/cloud/__tests__/find-studio-agent.test.ts` (add cases)

- [ ] **Step 1: Add failing tests** (append inside the existing `describe`)

```ts
  it('findStudioAgents returns all matching envs', () => {
    const a = env([svc({})], 'a')
    const b = env([svc({})], 'b')
    const none = env([], 'c')
    expect(findStudioAgents([a, none, b]).map((m) => m.env.id)).toEqual(['a', 'b'])
  })
  it('findStudioAgents returns [] when none match', () => {
    expect(findStudioAgents([env([], 'c')])).toEqual([])
  })
```

Add the import: `import { findStudioAgent, findStudioAgents } from '@/modules/cloud/studio/find-studio-agent'`

- [ ] **Step 2: Run — expect FAIL** `npx vitest run --config vitest.unit.config.ts modules/cloud/__tests__/find-studio-agent.test.ts`

- [ ] **Step 3: Implement** — replace the body of `find-studio-agent.ts` below the imports/type:

```ts
function matchStudioService(env: CloudEnvironment): CloudEnvironmentService | undefined {
  const hasStudioPackage = env.state.packages.some((p) => p.name === STUDIO_AGENT_PACKAGE)
  return env.state.services.find((s) => {
    if (s.type !== 'CLINT' || !s.enabled) return false
    const pkgName = s.config?.package?.name
    return pkgName ? pkgName === STUDIO_AGENT_PACKAGE : hasStudioPackage
  })
}

/** All of the user's environments that host an enabled vetra-cli studio agent. */
export function findStudioAgents(envs: CloudEnvironment[]): StudioAgentMatch[] {
  const out: StudioAgentMatch[] = []
  for (const env of envs) {
    const service = matchStudioService(env)
    if (service) out.push({ env, service })
  }
  return out
}

/** First studio agent match (back-compat for single-studio callers). */
export function findStudioAgent(envs: CloudEnvironment[]): StudioAgentMatch | null {
  return findStudioAgents(envs)[0] ?? null
}
```

- [ ] **Step 4: Run — expect PASS** (all find-studio-agent tests)
- [ ] **Step 5: Commit** — `feat(studio): add findStudioAgents (all studio envs)`

---

### Task 2: BrandSheet fetch + parser

**Files:**
- Create: `modules/cloud/studio/fetch-product-brand.ts`
- Test: `modules/cloud/__tests__/fetch-product-brand.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, expect, it } from 'vitest'
import { parseBrandSheet, type ProductBrand } from '@/modules/cloud/studio/fetch-product-brand'

const ok = {
  data: {
    BrandSheet: {
      documents: {
        items: [
          { id: '1', name: 'doc', state: { global: { name: 'Concord', maxim: 'Share the burden.', concept: 'Concord coordinates procurement…' } } },
        ],
      },
    },
  },
}

describe('parseBrandSheet', () => {
  it('extracts title/tagline/description from the first item', () => {
    expect(parseBrandSheet(ok)).toEqual<ProductBrand>({
      title: 'Concord',
      tagline: 'Share the burden.',
      description: 'Concord coordinates procurement…',
    })
  })
  it('returns null when there are no items', () => {
    expect(parseBrandSheet({ data: { BrandSheet: { documents: { items: [] } } } })).toBeNull()
  })
  it('returns null for GraphQL errors / malformed payload', () => {
    expect(parseBrandSheet({ errors: [{ message: 'nope' }] })).toBeNull()
    expect(parseBrandSheet(null)).toBeNull()
    expect(parseBrandSheet({ data: {} })).toBeNull()
  })
  it('tolerates missing maxim/concept (null), keeps title', () => {
    const r = parseBrandSheet({ data: { BrandSheet: { documents: { items: [{ state: { global: { name: 'X' } } }] } } } })
    expect(r).toEqual<ProductBrand>({ title: 'X', tagline: null, description: null })
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (module not found)

- [ ] **Step 3: Implement** `fetch-product-brand.ts`

```ts
import { STUDIO_BASE_DOMAIN } from './constants'

export type ProductBrand = {
  title: string
  tagline: string | null
  description: string | null
}

/** BrandSheet name (title), maxim (tagline), concept (description). */
export const BRAND_QUERY =
  'query { BrandSheet { documents { items { id name state { global { name maxim concept } } } } } }'

type BrandItem = { state?: { global?: { name?: string; maxim?: string; concept?: string } } }

export function parseBrandSheet(json: unknown): ProductBrand | null {
  if (typeof json !== 'object' || json === null) return null
  const data = (json as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return null
  const items = (data as { BrandSheet?: { documents?: { items?: unknown } } }).BrandSheet?.documents
    ?.items
  if (!Array.isArray(items) || items.length === 0) return null
  const global = (items[0] as BrandItem).state?.global
  if (!global || typeof global.name !== 'string') return null
  return {
    title: global.name,
    tagline: global.maxim ?? null,
    description: global.concept ?? null,
  }
}

/**
 * Fetch a product's brand metadata from its agent switchboard. Auth-gated:
 * pass the caller's Renown bearer token. Returns null on any failure (agent
 * down/booting, no BrandSheet, network) so callers fall back to the env label.
 */
export async function fetchProductBrand(input: {
  subdomain: string
  prefix: string
  baseDomain?: string | null
  token: string | null
}): Promise<ProductBrand | null> {
  const base = input.baseDomain || STUDIO_BASE_DOMAIN
  const url = `https://${input.prefix}.${input.subdomain}.${base}/switchboard/graphql`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(input.token ? { authorization: `Bearer ${input.token}` } : {}),
      },
      body: JSON.stringify({ query: BRAND_QUERY }),
    })
    if (!res.ok) return null
    return parseBrandSheet((await res.json()) as unknown)
  } catch {
    return null
  }
}
```

- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): fetch + parse product BrandSheet metadata`

---

### Task 3: `deriveProductStatus`

**Files:**
- Modify: `modules/cloud/studio/studio-readiness.ts`
- Test: `modules/cloud/__tests__/studio-helpers.test.ts` (add cases)

- [ ] **Step 1: Add failing test** (append a describe block)

```ts
import { deriveProductStatus } from '@/modules/cloud/studio/studio-readiness'

describe('deriveProductStatus', () => {
  const group = (eps: { type: string; status: string }[]): ClintRuntimeEndpointsForPrefix => ({
    prefix: 'vetra-agent',
    endpoints: eps.map((e, i) => ({ id: `/${i}`, type: e.type as never, port: '1', status: e.status as never, lastSeen: '' })),
  })
  it('ready when a website endpoint is enabled', () => {
    expect(deriveProductStatus(group([{ type: 'website', status: 'enabled' }]))).toBe('ready')
  })
  it('booting otherwise', () => {
    expect(deriveProductStatus(undefined)).toBe('booting')
    expect(deriveProductStatus(group([{ type: 'api-graphql', status: 'enabled' }]))).toBe('booting')
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** — append to `studio-readiness.ts`:

```ts
export type ProductStatus = 'ready' | 'booting'

/** A product is 'ready' once its agent announces an enabled website endpoint. */
export function deriveProductStatus(
  group: ClintRuntimeEndpointsForPrefix | undefined,
): ProductStatus {
  return hasStudioWebsiteEndpoint(group) ? 'ready' : 'booting'
}
```

- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): add deriveProductStatus`

---

### Task 4: Products list hook `useStudioProducts`

**Files:**
- Create: `modules/cloud/studio/use-studio-products.ts`

(No standalone unit test — composes tested helpers + async fetches; verified via component tests + tsc. Keep it thin.)

- [ ] **Step 1: Implement**

```ts
'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDid, useRenown, useUser } from '@powerhousedao/reactor-browser'
import { fetchClintRuntimeEndpointsByEnv, fetchEnvironment, getAuthToken } from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { findStudioAgents } from './find-studio-agent'
import { fetchProductBrand, type ProductBrand } from './fetch-product-brand'
import { deriveProductStatus, type ProductStatus } from './studio-readiness'
import { getStudioAllowlist, isStudioAllowed } from './allowlist'
import { useCreateStudioEnvironment } from './use-create-studio-environment'

export type StudioGate = 'loading' | 'unauthenticated' | 'not-allowed' | 'ready'

export type StudioProduct = {
  envId: string
  subdomain: string
  prefix: string
  label: string
  brand: ProductBrand | null
  status: ProductStatus
}

export type StudioProductsState = {
  gate: StudioGate
  products: StudioProduct[]
  isScanning: boolean
  creating: boolean
  createError: string | null
  /** Provision a new product env; resolves to the new env id for navigation. */
  createProduct: (anthropicApiKey: string) => Promise<string>
  did: string | undefined
}

export function useStudioProducts(): StudioProductsState {
  const user = useUser()
  const did = useDid()
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { viewer } = useViewer()
  const address = viewer?.address ?? null
  const environments = useEnvironments('MINE', address)

  const isAuthed = !!user
  const userAddress = user?.address ?? null

  const [products, setProducts] = useState<StudioProduct[]>([])
  const [isScanning, setIsScanning] = useState(true)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const create = useCreateStudioEnvironment()

  const summaryIds = environments.map((e) => e.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isAuthed) return
      try {
        const token = await getAuthToken(renownRef.current)
        const details: CloudEnvironment[] = []
        for (const summary of environments) {
          const full = await fetchEnvironment(summary.id, token)
          if (full) details.push(full)
        }
        const matches = findStudioAgents(details)
        const resolved = await Promise.all(
          matches.map(async ({ env, service }): Promise<StudioProduct> => {
            const subdomain = env.state.genericSubdomain ?? ''
            const [brand, groups] = await Promise.all([
              fetchProductBrand({ subdomain, prefix: service.prefix, token }),
              fetchClintRuntimeEndpointsByEnv(subdomain, env.id, token).catch(() => []),
            ])
            const group = groups.find((g) => g.prefix === service.prefix)
            return {
              envId: env.id,
              subdomain,
              prefix: service.prefix,
              label: env.state.label ?? env.name,
              brand,
              status: deriveProductStatus(group),
            }
          }),
        )
        if (!cancelled) {
          setProducts(resolved)
          setIsScanning(false)
        }
      } catch {
        if (!cancelled) setIsScanning(false)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, userAddress, summaryIds])

  const createProduct = useCallback(
    async (anthropicApiKey: string): Promise<string> => {
      setCreateError(null)
      setCreating(true)
      try {
        const res = await create({ anthropicApiKey })
        return res.documentId
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create product')
        throw err
      } finally {
        setCreating(false)
      }
    },
    [create],
  )

  let gate: StudioGate
  if (!user) gate = 'unauthenticated'
  else if (!isStudioAllowed(address, getStudioAllowlist())) gate = address ? 'not-allowed' : 'loading'
  else gate = 'ready'

  return { gate, products, isScanning, creating, createError, createProduct, did }
}
```

- [ ] **Step 2: Type-check** `./node_modules/.bin/tsc` — fix signature drift (confirm `fetchClintRuntimeEndpointsByEnv(subdomain, documentId, token)` arg order against `modules/cloud/graphql.ts`).
- [ ] **Step 3: Commit** — `feat(studio): add useStudioProducts list hook`

---

### Task 5: Product card

**Files:**
- Create: `modules/cloud/studio/components/studio-product-card.tsx`
- Test: `modules/cloud/__tests__/studio-product-card.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

import { StudioProductCard } from '@/modules/cloud/studio/components/studio-product-card'
import type { StudioProduct } from '@/modules/cloud/studio/use-studio-products'

const base: StudioProduct = {
  envId: 'env1', subdomain: 'sub', prefix: 'vetra-agent', label: 'Vetra Studio',
  brand: { title: 'Concord', tagline: 'Share the burden.', description: 'Coordinates procurement.' },
  status: 'ready',
}

describe('StudioProductCard', () => {
  it('shows brand title/tagline/description and links to the env', () => {
    const { container, getByText } = render(<StudioProductCard product={base} />)
    getByText('Concord'); getByText('Share the burden.'); getByText('Coordinates procurement.')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/studio/env1')
  })
  it('falls back to the env label when no brand, and shows Starting for booting', () => {
    const { getByText } = render(<StudioProductCard product={{ ...base, brand: null, status: 'booting' }} />)
    getByText('Vetra Studio')
    getByText(/starting/i)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** `studio-product-card.tsx`

```tsx
'use client'

import Link from 'next/link'
import { Boxes } from 'lucide-react'
import type { StudioProduct } from '../use-studio-products'

export function StudioProductCard({ product }: { product: StudioProduct }) {
  const title = product.brand?.title?.trim() || product.label || 'Untitled product'
  return (
    <Link
      href={`/studio/${product.envId}`}
      className="border-border hover:border-foreground/30 bg-card flex flex-col rounded-xl border p-5 transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
          <Boxes className="text-muted-foreground h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-semibold">{title}</div>
          {product.brand?.tagline && (
            <div className="text-muted-foreground truncate text-sm">{product.brand.tagline}</div>
          )}
        </div>
      </div>
      {product.brand?.description && (
        <p className="text-muted-foreground mt-3 line-clamp-4 text-sm leading-relaxed">
          {product.brand.description}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <span
          className={
            product.status === 'ready'
              ? 'text-xs font-medium text-green-600'
              : 'text-muted-foreground text-xs font-medium'
          }
        >
          {product.status === 'ready' ? 'Ready' : 'Starting…'}
        </span>
        <span className="text-muted-foreground text-xs">Open →</span>
      </div>
    </Link>
  )
}
```

- [ ] **Step 4: Run — expect PASS**
- [ ] **Step 5: Commit** — `feat(studio): add product card`

---

### Task 6: New-product card (+ create form)

**Files:**
- Create: `modules/cloud/studio/components/new-product-card.tsx`

(No standalone test — exercised via the grid test in Task 7. It wires the existing tested `StudioCreateForm`.)

- [ ] **Step 1: Implement** `new-product-card.tsx`

```tsx
'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { StudioCreateForm } from './studio-create-form'

export function NewProductCard({
  onCreate,
  createError,
}: {
  onCreate: (apiKey: string) => Promise<void>
  createError: string | null
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
      >
        <Plus className="h-7 w-7" />
        <span className="text-sm">Create new product…</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New product</DialogTitle>
          </DialogHeader>
          <StudioCreateForm onCreate={onCreate} error={createError} />
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Type-check + commit** — `./node_modules/.bin/tsc` then `feat(studio): add new-product card`

---

### Task 7: Products grid + route

**Files:**
- Create: `modules/cloud/studio/components/studio-products-grid.tsx`
- Modify: `app/studio/page.tsx`
- Test: `modules/cloud/__tests__/studio-products-grid.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const state = {
  gate: 'ready' as const,
  products: [
    { envId: 'e1', subdomain: 's', prefix: 'vetra-agent', label: 'L', brand: { title: 'Concord', tagline: null, description: null }, status: 'ready' as const },
  ],
  isScanning: false,
  creating: false,
  createError: null,
  createProduct: vi.fn(),
  did: undefined,
}
vi.mock('@/modules/cloud/studio/use-studio-products', () => ({ useStudioProducts: () => state }))

import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'

describe('StudioProductsGrid', () => {
  it('renders a card per product plus the new-product card', () => {
    const { getByText } = render(<StudioProductsGrid />)
    getByText('Concord')
    getByText(/create new product/i)
  })
})
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement** `studio-products-grid.tsx`

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'
import { StudioBootScreen } from './studio-boot-screen'
import { StudioProductCard } from './studio-product-card'
import { NewProductCard } from './new-product-card'
import { useStudioProducts } from '../use-studio-products'

export function StudioProductsGrid() {
  const router = useRouter()
  const { gate, products, isScanning, creating, createError, createProduct } = useStudioProducts()

  if (gate === 'unauthenticated') return <CloudLanding />
  if (gate === 'not-allowed')
    return (
      <StudioBootScreen
        title="Vetra Studio is in limited preview"
        detail="Your account doesn't have access yet. Reach out to the team to be added to the preview."
      />
    )
  if (gate === 'loading') return <StudioBootScreen title="Loading…" />

  const handleCreate = async (apiKey: string) => {
    const envId = await createProduct(apiKey)
    router.push(`/studio/${envId}`)
  }

  return (
    <div className="mx-auto mt-24 max-w-screen-xl px-6 pb-16">
      <h1 className="mb-6 text-2xl font-semibold">Products</h1>
      {isScanning && products.length === 0 ? (
        <StudioBootScreen title="Loading your products…" />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <StudioProductCard key={p.envId} product={p} />
          ))}
          {!creating && <NewProductCard onCreate={handleCreate} createError={createError} />}
          {creating && <StudioBootScreen title="Creating your product…" />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Modify** `app/studio/page.tsx`

```tsx
import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'

export default function StudioPage() {
  return <StudioProductsGrid />
}
```

- [ ] **Step 5: Run test — expect PASS**, then `./node_modules/.bin/tsc`
- [ ] **Step 6: Commit** — `feat(studio): products grid at /studio`

---

### Task 8: Embed route `/studio/[envId]`

**Files:**
- Create: `modules/cloud/studio/use-studio-product-embed.ts`
- Create: `modules/cloud/studio/studio-embed-client.tsx`
- Create: `app/studio/[envId]/page.tsx`

(Hook verified via tsc + the existing `StudioFrame` test; embed client is thin.)

- [ ] **Step 1: Implement** `use-studio-product-embed.ts`

```ts
'use client'

import { useEffect, useRef, useState } from 'react'
import { useDid, useRenown, useUser } from '@powerhousedao/reactor-browser'
import { fetchEnvironment, getAuthToken } from '@/modules/cloud/graphql'
import { useEnvironments, useViewer } from '@/modules/cloud/hooks/use-environment'
import { useClintRuntimeEndpoints } from '@/modules/cloud/hooks/use-clint-runtime-endpoints'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { findStudioAgents } from './find-studio-agent'
import { buildStudioEmbedUrl } from './studio-embed-url'
import { hasStudioWebsiteEndpoint } from './studio-readiness'
import { getStudioAllowlist, isStudioAllowed } from './allowlist'

export type EmbedStatus =
  | 'loading'
  | 'unauthenticated'
  | 'not-allowed'
  | 'not-found'
  | 'booting'
  | 'ready'

export function useStudioProductEmbed(envId: string): {
  status: EmbedStatus
  embedUrl: string | null
} {
  const user = useUser()
  const did = useDid()
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { viewer } = useViewer()
  const address = viewer?.address ?? null
  const environments = useEnvironments('MINE', address)

  const isAuthed = !!user
  const userAddress = user?.address ?? null

  const [located, setLocated] = useState<{ subdomain: string; prefix: string } | null>(null)
  const [scanned, setScanned] = useState(false)

  const summaryIds = environments.map((e) => e.id).join(',')
  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!isAuthed) return
      try {
        const token = await getAuthToken(renownRef.current)
        const details: CloudEnvironment[] = []
        for (const summary of environments) {
          const full = await fetchEnvironment(summary.id, token)
          if (full) details.push(full)
        }
        const match = findStudioAgents(details).find((m) => m.env.id === envId)
        if (!cancelled) {
          if (match)
            setLocated({
              subdomain: match.env.state.genericSubdomain ?? '',
              prefix: match.service.prefix,
            })
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
  }, [isAuthed, userAddress, summaryIds, envId])

  const { byPrefix } = useClintRuntimeEndpoints(located?.subdomain ?? null, envId)
  const ready = located ? hasStudioWebsiteEndpoint(byPrefix[located.prefix]) : false

  let status: EmbedStatus
  if (!user) status = 'unauthenticated'
  else if (!isStudioAllowed(address, getStudioAllowlist())) status = address ? 'not-allowed' : 'loading'
  else if (located) status = ready ? 'ready' : 'booting'
  else if (!scanned) status = 'loading'
  else status = 'not-found'

  const embedUrl =
    status === 'ready' && located
      ? buildStudioEmbedUrl({
          prefix: located.prefix,
          genericSubdomain: located.subdomain,
          genericBaseDomain: null,
          userDid: did,
        })
      : null

  return { status, embedUrl }
}
```

- [ ] **Step 2: Implement** `studio-embed-client.tsx`

```tsx
'use client'

import Link from 'next/link'
import { StudioBootScreen } from './components/studio-boot-screen'
import { StudioFrame } from './components/studio-frame'
import { useStudioProductEmbed } from './use-studio-product-embed'
import { CloudLanding } from '@/modules/cloud/components/cloud-landing'

export function StudioEmbedClient({ envId }: { envId: string }) {
  const { status, embedUrl } = useStudioProductEmbed(envId)

  switch (status) {
    case 'unauthenticated':
      return <CloudLanding />
    case 'not-allowed':
      return (
        <StudioBootScreen
          title="Vetra Studio is in limited preview"
          detail="Your account doesn't have access yet."
        />
      )
    case 'loading':
      return <StudioBootScreen title="Loading product…" />
    case 'not-found':
      return (
        <div className="mx-auto mt-24 max-w-md space-y-3 text-center">
          <h1 className="text-lg font-semibold">Product not found</h1>
          <Link href="/studio" className="text-primary text-sm underline-offset-2 hover:underline">
            Back to products
          </Link>
        </div>
      )
    case 'booting':
      return (
        <StudioBootScreen
          title="Starting Vetra Studio…"
          detail="The agent is booting. This can take a few minutes on first start."
        />
      )
    case 'ready':
      return embedUrl ? <StudioFrame embedUrl={embedUrl} /> : <StudioBootScreen title="Opening…" />
  }
}
```

- [ ] **Step 3: Implement** `app/studio/[envId]/page.tsx`

```tsx
import { StudioEmbedClient } from '@/modules/cloud/studio/studio-embed-client'

export default async function StudioProductPage({
  params,
}: {
  params: Promise<{ envId: string }>
}) {
  const { envId } = await params
  return <StudioEmbedClient envId={envId} />
}
```

- [ ] **Step 4: Type-check** `./node_modules/.bin/tsc`
- [ ] **Step 5: Commit** — `feat(studio): embed route /studio/[envId]`

---

### Task 9: Remove superseded single-studio files + verify

**Files:**
- Delete: `modules/cloud/studio/studio-client.tsx`
- Delete: `modules/cloud/studio/use-studio-environment.ts`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "studio-client\|use-studio-environment" app modules | grep -v __tests__`
Expected: no results (page.tsx now imports the grid). If any remain, update them first.

- [ ] **Step 2: Delete the files**

```bash
git rm modules/cloud/studio/studio-client.tsx modules/cloud/studio/use-studio-environment.ts
```

- [ ] **Step 3: Full verification**

```bash
./node_modules/.bin/tsc
./node_modules/.bin/eslint modules/cloud/studio app/studio
./node_modules/.bin/prettier --check "modules/cloud/studio/**/*.{ts,tsx}" "app/studio/**/*.tsx"
npx vitest run --config vitest.unit.config.ts
```
Expected: tsc 0 errors; eslint 0 errors; prettier clean; new studio tests pass (only the known pre-existing `agent-card` / `use-create-environment` failures remain).

- [ ] **Step 4: Commit** — `refactor(studio): drop single-studio client/hook superseded by products grid`

---

## Notes / verification during implementation

- **BrandSheet endpoint:** confirm `https://<prefix>.<sub>.vetra.io/switchboard/graphql` returns the BrandSheet when authenticated (the type-namespaced `documents` query). If it returns empty even authenticated, fall back to the drive-scoped read path discovered during design; `parseBrandSheet` is endpoint-agnostic.
- **`fetchClintRuntimeEndpointsByEnv` signature:** verify arg order/optional token in `modules/cloud/graphql.ts` and adjust the call in `useStudioProducts` if needed.
- Layout: the grid uses `mt-24` to clear the fixed `h-16` navbar (same reason `StudioFrame` uses `mt-16`); embed reuses `StudioFrame` which already offsets.
