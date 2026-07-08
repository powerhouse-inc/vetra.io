# Max Products Per User — Design

**Date:** 2026-07-08
**Status:** Approved

## Goal

Cap how many studios/products a single user can create, configurable via a
runtime env var. Prod caps at 3; any environment that leaves the var unset is
unlimited (staging/local unaffected).

## Enforcement posture

**Client-side (UI) only**, by explicit decision. A user who calls the
reactor/claim API directly can still exceed the cap — the same posture as
today's env-creation gating (which is client-gated, not backend-enforced).
This is documented, accepted, and out of scope here.

## Env var + plumbing

Mirrors `NEXT_PUBLIC_STUDIO_REGISTRY` exactly:

- **`NEXT_PUBLIC_MAX_STUDIOS_PER_USER`** — integer as a string.
- Declared optional in `modules/shared/config/env-schema.ts`.
- Surfaced to the client via `window.__ENV` in `app/layout.tsx`
  (`process.env.MAX_STUDIOS_PER_USER || process.env.NEXT_PUBLIC_MAX_STUDIOS_PER_USER || ''`).
- Documented in `.env.example`.
- Accessor **`maxStudiosPerUser(): number`** added next to `studioRegistry()` in
  `modules/cloud/switchboard-url.ts` (reuses the local `readEnv`). Parses the
  value; **unset / `0` / negative / non-numeric → `0`, meaning no limit**.

## The gate — single source of truth

`useStudioProducts` (`modules/cloud/studio/use-studio-products.ts`) already
returns `products`. It gains:

- `limit: number` — `0` = unlimited.
- `atLimit: boolean` — `limit > 0 && products.length >= limit`.

Both are added to `StudioProductsState`.

`createProduct` guards at the top: when `atLimit`, it throws
`You've reached the maximum of ${limit} products` (a defense so an in-app
programmatic call is blocked too, not only the button).

**Counting:** `products.length` across all states (ready / booting / sleeping).
The optimistic "booting" placeholder inserted during create also counts, which
naturally prevents a double-submit race.

## UI treatment (both pages)

Both product surfaces read `atLimit`/`limit` from the shared hook so they can't
drift:

- `/user` → `StudioProductsGrid` → `NewProductCard`
- `/user/products` → `StudioGroupsView`

When `atLimit`, the create affordance is replaced by a disabled state with copy
**"Limit reached — {n} of {n} products."** When below the limit (or unlimited),
behaviour is unchanged.

## Config rollout

Add `NEXT_PUBLIC_MAX_STUDIOS_PER_USER: "3"` to the vetra.io app `env` block in
`powerhouse-k8s-hosting` `tenants/vetra/powerhouse-values.yaml`. No admin
exemption — the cap applies to everyone. Staging and other environments omit
the var and stay unlimited.

## Testing

- `maxStudiosPerUser()` parsing: unset → 0, `"3"` → 3, `"0"` → 0, garbage → 0,
  negative → 0.
- Grid + group view render: at limit → create CTA disabled + message; below
  limit → enabled/unchanged.
- `createProduct` guard: throws when called at limit.
