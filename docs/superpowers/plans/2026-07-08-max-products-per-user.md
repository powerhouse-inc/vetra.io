# Max Products Per User — Implementation Plan

> Execute with superpowers:executing-plans. Steps use `- [ ]`.

**Goal:** Client-side cap on studios/products a user can create, via
`NEXT_PUBLIC_MAX_STUDIOS_PER_USER` (prod=3, unset=unlimited).

**Architecture:** Runtime env var (mirrors `NEXT_PUBLIC_STUDIO_REGISTRY`) →
`maxStudiosPerUser()` accessor → `useStudioProducts` derives `limit`/`atLimit`
→ `NewProductCard` disables the create affordance at limit. Prod value set in
`powerhouse-k8s-hosting`.

## Global Constraints

- Client-side only (no backend enforcement).
- `0` / unset / non-numeric / negative → **no limit**.
- Count `products.length` across all states (ready/booting/sleeping).
- No admin exemption.

---

### Task 1: env var plumbing + accessor

**Files:** `modules/shared/config/env-schema.ts`, `app/layout.tsx`,
`.env.example`, `modules/cloud/switchboard-url.ts`,
`modules/cloud/__tests__/studio-limit.test.ts` (new)

- [ ] `env-schema.ts`: add `NEXT_PUBLIC_MAX_STUDIOS_PER_USER: z.string().optional()`.
- [ ] `app/layout.tsx` `__ENV`: add
      `NEXT_PUBLIC_MAX_STUDIOS_PER_USER: process.env.MAX_STUDIOS_PER_USER || process.env.NEXT_PUBLIC_MAX_STUDIOS_PER_USER || ''`.
- [ ] `.env.example`: document the var (commented, unset = unlimited).
- [ ] `switchboard-url.ts`: add accessor:

```ts
/**
 * Max studios/products a user may create. Runtime __ENV via
 * NEXT_PUBLIC_MAX_STUDIOS_PER_USER (prod=3). 0 / unset / invalid = no limit.
 */
export function maxStudiosPerUser(): number {
  const raw = readEnv('NEXT_PUBLIC_MAX_STUDIOS_PER_USER')
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}
```

- [ ] Test `studio-limit.test.ts` (mock `window.__ENV`): `""`→0, `"3"`→3,
      `"0"`→0, `"-2"`→0, `"abc"`→0. Run unit config → PASS.
- [ ] Commit: `feat(studio): NEXT_PUBLIC_MAX_STUDIOS_PER_USER accessor`

### Task 2: gate in `useStudioProducts`

**Files:** `modules/cloud/studio/use-studio-products.ts`

- [ ] Import `maxStudiosPerUser`. Compute `const limit = maxStudiosPerUser()`
      and `const atLimit = limit > 0 && products.length >= limit`.
- [ ] Add `limit: number` and `atLimit: boolean` to `StudioProductsState` and
      the returned object.
- [ ] Guard `createProduct`: first line
      `if (atLimit) throw new Error(\`You've reached the maximum of ${limit} products\`)`.
- [ ] `npm run tsc` clean. Commit: `feat(studio): expose limit/atLimit + guard createProduct`

### Task 3: UI — disable create at limit

**Files:** `modules/cloud/studio/components/new-product-card.tsx`,
`modules/cloud/studio/components/studio-products-grid.tsx`,
`modules/cloud/studio/components/studio-groups-view.tsx`,
`modules/cloud/__tests__/new-product-card.test.tsx` (new)

- [ ] `NewProductCard`: add optional props `atLimit?: boolean; limit?: number`.
      When `atLimit`, render a disabled tile (respecting `variant`) with copy
      `Limit reached — {limit} of {limit} products` and no click handler / dialog.
- [ ] `studio-products-grid.tsx`: read `atLimit`, `limit` from `useStudioProducts`;
      pass to the in-grid `<NewProductCard>`.
- [ ] `studio-groups-view.tsx`: read `atLimit`, `limit` (already on the hook via
      spread); pass to the bottom `<NewProductCard variant="row">`.
- [ ] Test `new-product-card.test.tsx`: `atLimit` → disabled + message, no
      dialog on click; below limit → normal CTA. Run unit config → PASS.
- [ ] `npm run tsc`, lint, `format:check` clean. Commit:
      `feat(studio): show limit-reached state on the create card`

### Task 4: prod config + PR

- [ ] `powerhouse-k8s-hosting` `tenants/vetra/powerhouse-values.yaml` vetra.io
      `env`: add `NEXT_PUBLIC_MAX_STUDIOS_PER_USER: "3"` (with a comment). Commit +
      push to `main` (ArgoCD syncs; frontend redeploys).
- [ ] vetra.io: PR `feat-max-products-per-user` → `staging`.
