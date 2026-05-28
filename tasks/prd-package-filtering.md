# PRD: Package Filtering — Allowlist & Powerhouse Recommended

## Introduction

The Vetra package library currently displays every package published to the Verdaccio registry, including incomplete, experimental, or low-quality entries. This makes the page noisy and potentially confusing for visitors.

This feature introduces two complementary controls:

1. **Powerhouse Recommended tag** — a server-side curation mechanism. The Vetra team maintains an allowlist (via environment variable) of packages they consider production-ready. These packages receive a visible "Powerhouse Recommended" badge.
2. **Recommended-first UX** — the packages page defaults to showing only recommended packages, with a toggle to reveal everything in the registry.

---

## Goals

- Give the Vetra team control over which packages are surfaced to visitors by default.
- Let visitors opt-in to seeing the full (unfiltered) registry when they want to explore.
- Require zero changes from package authors — curation is entirely server-side.
- Keep the implementation simple enough that updating the curated list is just an env var change and a redeploy.

---

## User Stories

### US-001: Recommended badge on package cards

**Description:** As a visitor, I want to see which packages are Powerhouse-recommended at a glance so I can trust the quality of what I'm installing.

**Acceptance Criteria:**

- [ ] Packages whose name appears in `PACKAGES_RECOMMENDED` show a "Powerhouse Recommended" badge on their card.
- [ ] The badge is visually distinct (e.g., a small icon or label, consistent with the design system).
- [ ] Packages not in the list show no badge and are otherwise unchanged.
- [ ] The badge also appears on the individual package detail page (`/packages/[id]`).
- [ ] Typecheck and lint pass.
- [ ] Verify badge renders correctly in browser.

### US-002: Default "Recommended only" view on the packages page

**Description:** As a visitor landing on the packages page, I want to see only high-quality packages by default so I'm not overwhelmed by incomplete or experimental entries.

**Acceptance Criteria:**

- [ ] On page load (no URL params set), only packages in `PACKAGES_RECOMMENDED` are shown.
- [ ] A clearly labeled toggle (e.g., "Show all packages") is visible above the package grid.
- [ ] Activating the toggle shows all packages in the registry, not just recommended ones.
- [ ] The toggle state is reflected in the URL (e.g., `?show=all`) so the view is shareable/bookmarkable.
- [ ] Category and publisher filters continue to work in both views.
- [ ] If `PACKAGES_RECOMMENDED` is not set or empty, the toggle is hidden and all packages are shown (preserves current behavior).
- [ ] Typecheck and lint pass.
- [ ] Verify toggle behavior in browser.

### US-003: Environment variable to define the recommended list

**Description:** As a Vetra team member, I want to control which packages are recommended via a server-side environment variable so I can update the curated list without a code change.

**Acceptance Criteria:**

- [ ] A new server-side env var `PACKAGES_RECOMMENDED` is introduced (comma-separated package names, e.g. `@scope/pkg-a,@scope/pkg-b`).
- [ ] The var is documented in `.env.example` with an inline comment explaining its purpose and format.
- [ ] When the var is unset or empty, all packages are shown and no badges appear (no regression).
- [ ] The var is not exposed to the browser (`NEXT_PUBLIC_` prefix must not be used).
- [ ] Typecheck and lint pass.

---

## Functional Requirements

- **FR-1:** Introduce server-only env var `PACKAGES_RECOMMENDED` (comma-separated list of npm package names).
- **FR-2:** At server render time, parse `PACKAGES_RECOMMENDED` into a `Set<string>` and pass a `isRecommended(name: string) => boolean` helper to both the packages page and the `/api/registry/packages` route.
- **FR-3:** Package cards and the detail page display a "Powerhouse Recommended" badge when `isRecommended(package.name)` is true.
- **FR-4:** The packages page defaults to filtering for recommended packages only (equivalent to `?show=recommended`).
- **FR-5:** A toggle or button lets visitors switch to `?show=all`, which bypasses the recommended filter while keeping all other active filters.
- **FR-6:** The `/api/registry/packages` route accepts an optional `recommended=true` query param. When set, it filters results to only packages in `PACKAGES_RECOMMENDED`. This keeps the cloud add-package modal consistent if needed in future.
- **FR-7:** When `PACKAGES_RECOMMENDED` is unset or empty, `show=all` is the effective default and no badge or toggle is rendered.

---

## Non-Goals

- Package authors cannot self-tag their packages as recommended — curation is Vetra team only.
- No admin UI for managing the recommended list (env var + redeploy is sufficient for now).
- No "request to be featured" workflow for package publishers.
- The allowlist does not hard-gate packages — all packages remain accessible when the visitor toggles to "Show all".
- No changes to the cloud environment package install flow (add-package modal) unless explicitly scoped in a follow-up.

---

## Design Considerations

- The "Powerhouse Recommended" badge should use an existing design system component (e.g., a `Badge` or `Tag` variant). Suggest a small star or checkmark icon + label.
- The toggle should sit between the page header and the package grid, near the search/filter controls.
- The empty state (no recommended packages configured, or none match current filters) should guide users toward the "Show all" view rather than just showing a blank grid.

---

## Technical Considerations

- **Where to filter:** The packages page (`app/packages/page.tsx`) fetches `PackageInfo[]` server-side. The recommended filter can be applied there before passing data to the Fuse.js search index, so search/category filters still work on top of it.
- **URL state:** The `show` param can be added to the existing `loadSearchParams` utility in `app/packages/lib/search-params.ts` using `nuqs`.
- **API route:** `app/api/registry/packages/route.ts` already handles search filtering; adding a `recommended` param follows the same pattern. This is optional scope — only needed if the cloud add-package modal should also respect the curated list.
- **No Verdaccio changes required** — the filter is entirely within the Next.js layer; nothing changes at the registry level.
- **Cache behavior:** `PACKAGES_RECOMMENDED` is read at request time (server component), so updating the env var and redeploying is sufficient to change the visible set.

---

## Success Metrics

- Visitors landing on `/packages` see only high-quality packages by default, reducing noise.
- Updating the curated list requires only an env var change and a redeploy — no code PR needed.
- The "Show all" toggle is discoverable and used by developers who want to browse the full registry.

---

## Open Questions

1. Should the toggle label be "Show all packages" / "Show recommended only", or a simpler on/off switch labeled "Powerhouse Recommended"?
2. Should the badge appear in the cloud add-package search modal as well, or only on the public packages page?
3. Is there a target number of packages for the initial recommended list, or will it start with whatever is ready at launch?
