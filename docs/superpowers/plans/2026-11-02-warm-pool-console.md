# Warm Pool (publisher console) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A publisher sets "Warm environments" on a DEDICATED template, sees the estimated monthly cost, and sees the pool's state and warm hours on the template card.

**Architecture:** Two additions to the `vetraPublisher` client in `modules/publisher`: `warmPoolSize` on `setTemplateDetails`/templates, and a new `warmPool(appId, templateId)` query. The backend computes the per-environment estimate; the console only multiplies.

**Tech Stack:** Next.js, React, TypeScript, React Query, Vitest + happy-dom, pnpm 11.

**Spec:** `vetra-cloud-package/docs/superpowers/specs/2026-11-02-app-warm-pool-design.md` §3.8 (read it). Backend API from the vetra-cloud-package plan, Tasks 3 and 10.

## Global Constraints

- Field label "Warm environments", range 0–10, integer; hint exactly: "Kept running and ready to hand out. You pay for them while they wait."
- Field only for DEDICATED templates (the Size block, `template-details-form.tsx:113-175`).
- Contract note under the field (spec §3.9), exactly: "Warm environments start before anyone owns them. Your app must start without an owner and create nothing for a person until it is claimed."
- Estimate copy: `≈ €{n × estimatePerEnvironmentEur}/month (estimate)`; at 0: no estimate line.
- Card copy: `{warming + available} warm, {available} ready` and `{warmHoursThisMonth rounded to 1 decimal} warm hours this month`; nothing on the card when `size` is 0 and there are no warm hours.
- Mirror server input types exactly (`types.ts:112-113`); empty input means null ("unchanged" is an omitted key — follow `templateDetailsInput`).
- Commands: one file `pnpm test:unit <path>`; `pnpm test:unit`; `pnpm tsc`; `pnpm lint`; `pnpm format:check`.

## Review Focus

1. A publisher types "3" then clears the field: an empty field means 0 (the size has a meaning at 0, unlike other optional fields), so saving sends `warmPoolSize: 0` and dirty-checking treats `""` as `"0"`. → test in Task 2.
2. The backend refuses the size (`WARM_POOL_TOO_LARGE`, `WARM_POOL_NOT_DEDICATED`): the toast shows the server's message, the form keeps the typed value. → test in Task 2.
3. `warmPool` query fails or the backend is older (field unknown): the card and form still render; the estimate line is hidden. → test in Task 3.
4. Template switched to SHARED in the form while size > 0: the field disappears with the Size block and the save carries `warmPoolSize: 0` so the backend does not refuse. → test in Task 2.

---

### Task 1: Client types, GraphQL and hooks

**Files:**
- Modify: `modules/publisher/types.ts:37-50,115-124`, `modules/publisher/graphql.ts:214-226,298-306,422-425`, `modules/publisher/hooks/keys.ts:6-7`, `modules/publisher/hooks/use-publisher.ts`, `modules/publisher/hooks/use-publisher-mutations.ts:44,56-61`
- Modify: `modules/publisher/__tests__/fixtures/licensing-contract.graphql` (add `PublisherTemplate.warmPoolSize: Int!`, `SetTemplateDetailsInput.warmPoolSize: Int`, `type WarmPool {...}` and `warmPool(appId: String!, templateId: String!): WarmPool!` exactly as the backend plan's Task 10)
- Test: `modules/publisher/__tests__/queries.test.ts`, `mutations.test.ts`, `contract-schema.test.ts`

**Interfaces:**
- Produces: `PublisherTemplate.warmPoolSize: number`; `SetTemplateDetailsInput.warmPoolSize?: number | null`; `type WarmPool = { size: number; warming: number; available: number; claimedThisMonth: number; warmHoursThisMonth: number; warmHoursLastMonth: number; estimatePerEnvironmentEur: number }`; `fetchWarmPool(appId, templateId, token, fetchImpl?) : Promise<WarmPool>` built with `read<T>`; hook `useWarmPool(appId: string, templateId: string, enabled: boolean)` (`useAuthedQuery`, key `['publisher','warmPool',appId,templateId,did]`, `refetchInterval: 30_000`, `retry: retryPublisher`); `setTemplateDetails` mutation invalidates `'warmPool'` too.
- [ ] **Step 1: Write the failing tests**: `fetchWarmPool` sends `query ($appId: String!, $templateId: String!) { vetraPublisher { warmPool(appId: $appId, templateId: $templateId) { size warming available claimedThisMonth warmHoursThisMonth warmHoursLastMonth estimatePerEnvironmentEur } } }` and returns the parsed object; `setTemplateDetails` passes `warmPoolSize`; `contract-schema.test.ts` validates both against the updated fixture.
- [ ] **Step 2: Run** `pnpm test:unit modules/publisher/__tests__`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** again, `pnpm tsc`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(publisher): client for a template's warm pool`.

### Task 2: "Warm environments" field with the estimate

**Files:**
- Modify: `modules/publisher/lib/template.ts:68-115` (`TemplateForm.warmPoolSize: string`, `templateToForm`, `templateDetailsInput`, `isTemplateFormDirty`), `modules/publisher/components/templates/template-details-form.tsx:113-175`
- Test: `modules/publisher/__tests__/template-details-form.test.tsx`, `modules/publisher/__tests__/template.test.ts` (lib)

**Interfaces:**
- Consumes: `useWarmPool` (Task 1) for `estimatePerEnvironmentEur`.
- Produces: form value `warmPoolSize` ("0"–"10"); `templateDetailsInput` sends `warmPoolSize: Number(form.warmPoolSize || "0")` when mode is DEDICATED, and `0` when the form's mode is SHARED and the template had a size > 0.
- [ ] **Step 1: Write the failing tests**: the field renders only for DEDICATED, with the exact label, hint and contract note; typing 3 with `estimatePerEnvironmentEur: 80` shows `≈ €240/month (estimate)`; 0 shows no estimate; saving sends `warmPoolSize: 3`; clearing then saving sends `0` and `""` equals `"0"` for dirtiness (Review Focus 1); a mutation rejected with `WARM_POOL_TOO_LARGE` shows the server message and keeps the value (Review Focus 2); switching to SHARED with size 2 saves `warmPoolSize: 0` (Review Focus 4); values outside 0–10 are not submittable (input `min=0 max=10 step=1`, submit disabled).
- [ ] **Step 2: Run** the two files. Expected: FAIL.
- [ ] **Step 3: Implement** next to the Size field, using the existing field components of that form.
- [ ] **Step 4: Run** the files and `pnpm tsc && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(publisher): set a template's warm environments, with the cost`.

### Task 3: Pool state on the template card

**Files:**
- Modify: `modules/publisher/components/templates/template-card.tsx:55-66`, `modules/publisher/lib/format.ts:30-33` (add `warmPoolText(pool: WarmPool): string[]`)
- Test: `modules/publisher/__tests__/template-card.test.tsx` (create if absent, following `template-details-form.test.tsx`'s mocks), `modules/publisher/__tests__/format.test.ts`

**Interfaces:**
- Consumes: `useWarmPool` (Task 1), only when `template.mode === 'DEDICATED'`.
- Produces: `warmPoolText(pool)` → `["3 warm, 2 ready", "12.5 warm hours this month"]`; `[]` when `size === 0 && warmHoursThisMonth === 0`.
- [ ] **Step 1: Write the failing tests**: `warmPoolText` for `{warming:1, available:2, warmHoursThisMonth:12.46}` → the two strings above; zero case → `[]`; the card shows them in the stats row beside `envCountText`; a failing `useWarmPool` renders the card without them (Review Focus 3).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `pnpm test:unit && pnpm tsc && pnpm lint && pnpm format:check`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(publisher): show a template's warm pool and its hours`.

### Task 4: Verify and deploy (after the backend is on staging)

- [ ] **Step 1:** Whole-branch review; fix Critical/Important.
- [ ] **Step 2:** PR to `main` (CI: lint, format, tsc, unit). Expected: green.
- [ ] **Step 3: Staging.** Merge into `staging` (push → image `staging-<sha7>` → `tenants/staging`). On the staging console, against the staging backend: set a DEDICATED template to 1, see the estimate, save; the card shows "1 warm, 0 ready" then "1 warm, 1 ready".
- [ ] **Step 4: Production** (after the backend is on production): merge the PR to `main` (→ `tenants/vetra`). Smoke: the field renders on Sektar's template; the card loads.
