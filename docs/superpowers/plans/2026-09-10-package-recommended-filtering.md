# Package Recommended Filtering — Implementation Plan

> Execute with superpowers:executing-plans. Steps use `- [ ]`.
> Spec: `tasks/prd-package-filtering.md` (issue powerhouse-inc/powerhouse#2651).

**Goal:** Server-side `PACKAGES_RECOMMENDED` allowlist → "Powerhouse Recommended"
badge on cards/detail + recommended-only default view on `/packages` with a
shareable `?show=recommended|all` toggle.

**Architecture:** `PACKAGES_RECOMMENDED` (server-only env var, comma-separated
npm names) → `app/packages/lib/recommended.ts` parses it into a `Set` per
request → page filters registry entries **by `pkg.name` before manifest
mapping** (so category/publisher filter options reflect the visible set) →
nuqs `show` param (default `recommended` when the allowlist is non-empty,
`all` otherwise) → plain `<Link>` toggle above the grid. Badge rendered from
`isRecommended()` on `PackageCard` and the `[id]` hero. Optional
`recommended=true` param on `/api/registry/packages` (FR-6, not wired to any
client yet).

## Global Constraints

- Server-only env var: **no `NEXT_PUBLIC_` prefix**, never injected into
  `window.__ENV` (PRD US-003).
- Unset/empty `PACKAGES_RECOMMENDED` ⇒ today's behavior exactly: all packages,
  no badge, no toggle. No regression path.
- Match allowlist against the **registry entry name** (`pkg.name`),
  case-insensitively. Never `manifest.name`: 7 live entries have an empty
  manifest name (e.g. `@powerhousedao/ph-dexter`), and registry names can be
  non-lowercase (`Retrospective-toolkit`).
- Soft gate per PRD non-goals: non-recommended packages remain reachable via
  `?show=all` and direct `/packages/[id]` URLs. No Verdaccio changes, no
  change to the cloud add-package install flow.
- Filter is applied before `fuse.setCollection` so search runs on the visible
  set (PRD technical considerations).
- Verify each task: `pnpm tsc` clean. Final task: lint, `format:check`,
  browser verification via `playwright-cli`.

---

### Task 1: env plumbing + `recommended.ts` accessor

**Files:** `modules/shared/config/env-schema.ts`, `.env.example`,
`app/packages/lib/recommended.ts` (new),
`app/packages/lib/__tests__/recommended.test.ts` (new)

- [ ] `env-schema.ts`: add
      `PACKAGES_RECOMMENDED: z.string().optional()` with a comment:
      server-only allowlist of npm package names (comma-separated) that
      receive the "Powerhouse Recommended" badge and the recommended-only
      default view; unset = no curation.
- [ ] `.env.example`: document it (commented, with format example
      `# PACKAGES_RECOMMENDED=@scope/pkg-a,@scope/pkg-b`).
- [ ] `recommended.ts`:

```ts
/**
 * Vetra-curated allowlist for the package library.
 * `PACKAGES_RECOMMENDED` is a comma-separated list of npm package names
 * (e.g. "@scope/pkg-a,@scope/pkg-b"). Server-only: no NEXT_PUBLIC_ prefix,
 * never reaches window.__ENV. Unset/empty = no curation (all packages shown,
 * no badges, no toggle).
 */
export function recommendedNames(): Set<string> {
  return new Set(
    (process.env.PACKAGES_RECOMMENDED ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isRecommended(name: string): boolean {
  return recommendedNames().has(name.toLowerCase())
}
```

- [ ] Test `recommended.test.ts`: unset → empty set; `"a, b ,"` trims and
      drops empties; case-insensitive match; scoped names. Run → PASS.
- [ ] `pnpm tsc` clean. Commit: `feat(packages): PACKAGES_RECOMMENDED allowlist accessor`

### Task 2: `show` param + recommended-only default on the page

**Files:** `app/packages/lib/search-params.ts`, `app/packages/page.tsx`

- [ ] `search-params.ts`: add
      `show: parseAsStringLiteral(['recommended', 'all'])`.
- [ ] `page.tsx`: after the registry fetch:
      `const rec = recommendedNames()`;
      `const effectiveShow = rec.size > 0 ? (show ?? 'recommended') : 'all'`;
      if `effectiveShow === 'recommended'`, filter `packages` by
      `rec.has(p.name.toLowerCase())` **before** the manifest mapping so
      `categoryOptions` / `publisherNameOptions` are derived from the visible
      set only.
- [ ] Toggle between the page header and the grid (visible in both desktop
      and mobile): render only when `rec.size > 0`. A `<Link>` — when
      recommended is active: "Show all packages" → current URL with
      `show=all`; when all is active: "Show recommended only" → `show=recommended`
      (swap the param while preserving any active `search`/`categories`/
      `publisherNames` params). No client component needed.
- [ ] Empty state: when `searchResult.length === 0` and
      `effectiveShow === 'recommended'`, add a "Show all packages" link to
      the existing no-match block (PRD design considerations).
- [ ] `pnpm tsc` clean. Commit:
      `feat(packages): recommended-only default view with show toggle`

### Task 3: "Powerhouse Recommended" badge

**Files:** `app/packages/components/package-card.tsx`,
`app/packages/components/package-list.tsx`, `app/packages/[id]/page.tsx`

- [ ] `package-card.tsx`: new optional prop `recommended?: boolean`. When
      true, prepend to the bottom badge row:
      `<Badge size="xs"><Star className="size-3" /> Powerhouse Recommended</Badge>`
      (`lucide-react` `Star`; `default` variant per Badge docs — the
      "highlighted tag" use case).
- [ ] `package-list.tsx`: pass `recommended={isRecommended(manifest's registry name)}`
      through (the list receives `{ manifest, searchWords }` items — extend
      the item shape with the flag computed in `page.tsx`, keeping the card
      a pure presentational component).
- [ ] `[id]/page.tsx`: hero badge row (next to the version / dist-tag
      badges, lines ~222-231): same badge when `isRecommended(pkg.name)`.
- [ ] `pnpm tsc`, lint, `format:check` clean. Commit:
      `feat(packages): Powerhouse Recommended badge on cards and detail page`

### Task 4: `/api/registry/packages` `recommended` param (FR-6, optional)

**Files:** `app/api/registry/packages/route.ts`

- [ ] Accept `recommended=true`; when set, filter the projected list against
      `recommendedNames()` (lowercase compare). No client consumes it yet —
      the cloud add-package modal (`use-registry-search.ts`) stays unchanged.
- [ ] Verify with `curl -s 'http://localhost:3000/api/registry/packages?registry=…&recommended=true'`
      against the dev registry with the env var set.
- [ ] Commit: `feat(api): recommended filter on /api/registry/packages`

### Task 5: deploy config + PR

- [ ] Team picks the initial curated list (PRD open question 3). Candidates
      from the current dev registry (60 rendered of 69 entries; 9 have null
      manifests and never render): `@powerhousedao/billing`,
      `@powerhousedao/contributor-billing`,
      `@powerhousedao/gnosispay-account-analytics`,
      `@powerhousedao/builder-profile`, `@arbitrum/arbgrants`,
      `@memo/builder-profile`, …
- [ ] `powerhouse-k8s-hosting`: add `PACKAGES_RECOMMENDED` to the vetra
      deployment env (staging first, then prod). Commit + push (ArgoCD syncs;
      frontend redeploys — the env is read at request time, so a redeploy is
      the only step).
- [ ] vetra.to: PR `feat/package-recommended-filter` → `staging`.
- [ ] Browser verification (`playwright-cli`) on staging with the env set:
      default view shows only allowlisted cards, each with the badge; toggle
      to all shows the full grid; URL param is shareable; filters still work
      in both views; detail page shows the badge; then with the env unset:
      no toggle, no badges, all packages (no regression).

---

## Risk note: scam packages (issue #2651)

The PRD deliberately uses a **soft gate**: a bad actor's package stays
visible under `?show=all` and at direct `/packages/[id]` URLs. Containment in
the meantime:

- Publishing to the Verdaccio registry is auth-gated; the fast remedy for a
  scam package is unpublishing/removing it at the registry (or simply never
  adding it to the allowlist — it will not appear in the default view).
- If a scam slips through, the hard-gate escalation is a one-line change:
  drop the `?show=all` toggle (or filter the registry read itself to the
  allowlist). Kept deliberately out of this PRD per its non-goals; revisit if
  untrusted publishers start appearing in the registry.
- Related registry hygiene seen during investigation (out of scope, worth a
  separate issue): 9 null-manifest entries (`@powerhousedao/invoice`,
  `@powerhousedao/ph-clint`, `Retrospective-toolkit`, `notes`, `qa-test-16`, …)
  and duplicate names (`ph-pirate-cli` present both scoped and unscoped).
