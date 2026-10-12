# Console Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the public Vetra home and Cloud pages with the approved "C · Console" direction, add a public `/studio` page, and retire Packages and Builders from the public site.

**Architecture:** A new `modules/landing/` module holds the console look (scoped CSS tokens, fonts, small presentational primitives) and the three page compositions. `/`, `/cloud` and `/studio` render those compositions inside a `dark` + `console` scope; the global navbar and footer switch to the same scope on those routes. Pricing is a pure lib (`capacity tiers`) consumed by a client `CapacityPicker`. `/packages` and `/builders` are redirected via `next.config.ts` (temporary, code kept).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4 (`@theme inline` tokens), `next/font/google` (Geist, JetBrains Mono), Vitest + Testing Library (happy-dom).

**Spec:** `docs/superpowers/specs/2026-10-12-console-landing/` — `HomeConsole.dc.html`, `CloudConsole.dc.html`, `Studio.dc.html` (content; restyle to console look), `Sitemap.dc.html`. Copy, section order and visuals come from these files.

## Global Constraints

- Console palette: bg `#08090A`, surface `#0E1113`, raised `#161B1E`, line `#1C2024`, line-strong `#23292E`, ink `#E4E8E6`, muted `#9AA5A1`, faint `#6F7A77`, signal `#3BE38A`, warn `#F2C14E`. Brand mark stays `#04C161`.
- Fonts: Geist (sans) and JetBrains Mono (mono), only inside the console scope; rest of the app keeps Inter.
- Never claim Vetra Cloud itself is open source. Only the Powerhouse platform and Studio-generated packages are open; self-hosting is the exit.
- Pricing: €40 / month per 2 vCPU · 4 GB RAM · 80 GB NVMe, linear. Tiers shown: 2/4/80 €40, 4/8/160 €80, 8/16/320 €160, 16/32/640 €320. Size depends on solution + installed packages.
- Studio is "early access · pre-alpha"; Cloud is "beta · invite only". Studio runs on Anthropic Claude (licence key or bring your own).
- No placeholder text (`[PRICE]`, `[N]`, `[TAG]`, …) may ship; drop or rewrite any spec element that needs data we don't have (activity ticker, per-service estimate numbers, roadmap, certification/region lines).
- CTA targets: early access → `/studio#access`; redeem → `/redeem`; console → `/user`; environments → `/user/environments`; walkthrough → `https://calendar.app.google/nmxvyJStMgN6pLzx6`; docs → `https://academy.vetra.io/`; waitlist form action = `WAITLIST_ACTION` from `modules/studio-license/components/no-licence-panel.tsx`; install command `curl -fsSL https://get.vetra.io | sh`.
- Deploy snippet uses `powerhouse-inc/vetra-deploy-action@v1` with `app-id` and `permissions: id-token: write`.
- Respect `prefers-reduced-motion` for caret/bar animations. Pages must work at 360 px width (no horizontal page scroll; wide tables scroll in their own box).
- Commits: small, plain messages, NO Co-Authored-By / AI trailer.

## Review Focus

- Placeholder leakage: a bracketed token like `[N]` rendering on a live page — test each page's text has no `/\[[A-Z][A-Z ]*\]/`.
- Light-theme visitors: navbar/footer must not render light chrome over the dark console pages — test `isConsoleRoute` and that the scope class is applied.
- Old deep links `/packages/<name>` and `/builders/<team>` must land somewhere sensible, not 404 — test the redirect table.
- Capacity picker keyboard/AT use: buttons expose `aria-pressed` and the price updates on activation — test clicking.
- Logged-out `/user/studio` must show the Studio landing, not the old Cloud landing — covered by Task 5 swap.

---

### Task 1: Console theme, fonts and primitives

**Files:**

- Modify: `app/globals.css` (add console tokens + `@theme inline` color mappings + keyframes)
- Create: `modules/landing/fonts.ts`
- Create: `modules/landing/components/console-scope.tsx`, `prompt-line.tsx`, `install-chip.tsx`, `window-frame.tsx`, `section-heading.tsx`
- Create: `modules/landing/lib/routes.ts`
- Test: `modules/landing/__tests__/routes.test.ts`, `modules/landing/__tests__/install-chip.test.tsx`
- Modify: `.prettierignore` (ignore `docs/superpowers/specs/**/*.dc.html`)

**Interfaces:**

- Produces: `isConsoleRoute(pathname: string): boolean` (true for `/`, `/cloud`, `/studio`); `ConsoleScope({children, className?})` server-safe wrapper applying `dark console font vars bg-console-bg text-console-ink`; `PromptLine({children})`; `InstallChip()`; `WindowFrame({title, children, label})`; `SectionHeading({eyebrow?, title, lead?})`; Tailwind colors `console-bg|surface|raised|line|line-strong|ink|muted|faint|signal|warn`, font utilities `font-console-sans`, `font-console-mono`.

- [ ] Step 1: write `routes.test.ts` asserting `isConsoleRoute('/')`, `('/cloud')`, `('/studio')` true and `('/user')`, `('/cloud/x')`, `('/studio/waking')` false. Run `npx vitest run --config vitest.unit.config.ts modules/landing` → FAIL.
- [ ] Step 2: implement `routes.ts` (`const CONSOLE_ROUTES = new Set(['/', '/cloud', '/studio'])`). Run → PASS.
- [ ] Step 3: write `install-chip.test.tsx` (renders `curl -fsSL https://get.vetra.io | sh` and a copy button). Implement `InstallChip` using `CopyButton` from `@/modules/apps/components/copy-button`. PASS.
- [ ] Step 4: add tokens to `globals.css` under `.console { --console-bg: #08090a; … }`, map in `@theme inline` as `--color-console-*`, add `--font-console-sans: var(--font-geist)`, `--font-console-mono: var(--font-jetbrains)`; add `@keyframes console-caret`, `console-grow` and `.console-caret`, `.console-bar` utilities with reduced-motion off-switch; console grid background utility `.console-grid`.
- [ ] Step 5: `fonts.ts` exports `consoleFontVars` = `${geist.variable} ${jetbrains.variable}` from `next/font/google` `Geist` / `JetBrains_Mono`; `ConsoleScope` composes them.
- [ ] Step 6: `npm run tsc` clean; commit `feat(landing): console theme tokens, fonts and primitives`.

### Task 2: Capacity pricing + picker

**Files:**

- Create: `modules/landing/lib/pricing.ts`, `modules/landing/components/capacity-picker.tsx`
- Test: `modules/landing/__tests__/pricing.test.ts`, `modules/landing/__tests__/capacity-picker.test.tsx`

**Interfaces:**

- Produces: `type CapacityTier = { units: number; vcpu: number; memoryGb: number; nvmeGb: number; eurPerMonth: number; fit: string }`; `UNIT = { vcpu: 2, memoryGb: 4, nvmeGb: 80, eurPerMonth: 40 }`; `tierFor(units: number): CapacityTier`; `CAPACITY_TIERS: CapacityTier[]` (units 1,2,4,8); `CapacityPicker({defaultIndex?: number})` client component.

- [ ] Step 1: tests — `tierFor(1)` = 2/4/80/€40, `tierFor(2)` = 4/8/160/€80, `CAPACITY_TIERS.map(t => t.eurPerMonth)` = `[40, 80, 160, 320]`; `tierFor(0)` throws. Run → FAIL.
- [ ] Step 2: implement linear `tierFor`, tiers with fits "A workspace and a few packages", "Several packages and an agent", "Document processing add-ons", "Heavy processing and 3D data". PASS.
- [ ] Step 3: picker test — default shows `€80`, button "4 vCPU" `aria-pressed=true`; clicking "8 vCPU" shows `€160`, `16 GB`, `320 GB` and flips `aria-pressed`. FAIL → implement (buttons in a `role="group"` labelled "Choose capacity", `useState` index, `formatEur`). PASS.
- [ ] Step 4: commit `feat(landing): linear capacity pricing and picker`.

### Task 3: Home page (console)

**Files:**

- Create: `modules/landing/home/home-page.tsx` and section files `home-hero.tsx`, `home-product-window.tsx`, `home-capabilities.tsx`, `home-repo-deploy.tsx`, `home-final-cta.tsx`
- Modify: `app/(home)/page.tsx` (render `<ConsoleScope><HomePage/></ConsoleScope>`, keep signed-in redirect, new metadata)
- Delete: all of `modules/home/components/*` (none used elsewhere — verified by grep)
- Test: `modules/landing/__tests__/home-page.test.tsx`

Content from `HomeConsole.dc.html`: hero (prompt line `~/vetra $ what-is`, H1 "An agent that builds Powerhouse apps. A cloud that hosts them.", sub, CTAs Get early access / InstallChip), product window (Studio session left, Cloud environment right; `role="img"` with label), capabilities grid with honest labels (`studio`, `environments`, `registry`, `git push`, `database`, `backups`), repo-deploy section with real action snippet, final prompt CTA (`join --early-access`) with Get early access / Redeem a code / Join Discord (`https://discord.gg/Py28EMafEr`). Drop the activity ticker.

- [ ] Step 1: test renders H1 text, links to `/studio#access` and `/redeem`, contains `vetra-deploy-action@v1`, and `document.body.textContent` has no `/\[[A-Z][A-Z ]*\]/` and no "open source end to end". FAIL.
- [ ] Step 2: implement sections; page. PASS.
- [ ] Step 3: delete old home components; `npm run tsc`; commit `feat(home): console landing page`.

### Task 4: Cloud page (console)

**Files:**

- Create: `modules/landing/cloud/cloud-page.tsx` + sections `cloud-hero.tsx`, `cloud-environment-window.tsx`, `cloud-lifecycle.tsx`, `cloud-capabilities.tsx`, `cloud-addons.tsx`, `cloud-pricing.tsx`, `cloud-security.tsx`, `cloud-exit.tsx`, `cloud-final-cta.tsx`
- Modify: `modules/cloud/components/cloud-landing.tsx` → `export { CloudPage as CloudLanding }`-style re-export kept for the `/cloud` route only; `app/cloud/page.tsx` renders inside `ConsoleScope` with metadata
- Delete: `cloud-landing-hero.tsx`, `cloud-landing-features.tsx`, `cloud-landing-cta.tsx`, `cloud-landing-faq.tsx` (and `book-meeting-modal.tsx` if unused after)
- Test: `modules/landing/__tests__/cloud-page.test.tsx`

Content from `CloudConsole.dc.html`. Rewrites: estimate block lists the components that need capacity (no numbers) and ends with "recommended: 4 vCPU · 8 GB · 160 GB — €80 / month" as an example; security "not yet" = "No formal certifications yet", "No uptime SLA yet — we publish status instead"; exit block = install command + "Restore your backup — see the self-hosting guide" link to academy; add-on states as text badges ("included" / "optional") instead of fake toggles.

- [ ] Step 1: test H1 "Managed hosting for Powerhouse apps.", pricing heading, `CapacityPicker` present (`€80`), walkthrough link, no placeholders, no "open source" claim about the cloud ("Built only from open parts" absent). FAIL.
- [ ] Step 2: implement. PASS. Commit `feat(cloud): console cloud landing with capacity pricing`.

### Task 5: Studio page

**Files:**

- Create: `modules/landing/studio/studio-page.tsx` + sections `studio-hero.tsx`, `studio-session-window.tsx`, `studio-flow.tsx`, `studio-outputs.tsx`, `studio-hibernation.tsx`, `studio-control.tsx`, `studio-status.tsx`, `studio-access.tsx` (id `access`, waitlist form + redeem + run locally)
- Create: `app/studio/page.tsx`
- Modify: `modules/cloud/studio/components/studio-groups-view.tsx`, `studio-products-grid.tsx` — unauthenticated gate renders `<ConsoleScope><StudioPage/></ConsoleScope>`
- Test: `modules/landing/__tests__/studio-page.test.tsx`

Content from `Studio.dc.html`, console-styled. Status panel: "Works today" and "Still rough" only (drop "Next").

- [ ] Step 1: test H1, "pre-alpha" badge, `#access` section with an email input labelled for the waitlist posting to the Mailchimp action, "Anthropic" mention, no placeholders. FAIL.
- [ ] Step 2: implement; export `WAITLIST_ACTION` from `no-licence-panel.tsx` and import it (no duplication). PASS. Commit `feat(studio): public studio landing page`.

### Task 6: Navigation, footer, redirects

**Files:**

- Modify: `modules/shared/components/navbar/navbar-config.tsx` (public: Studio `/studio`, Cloud `/cloud`, Docs external; remove Builders from `/vetra` config), `navbar.tsx` (add `dark` + console bg on console routes)
- Create: `modules/shared/components/footer/footer-scope.tsx` (client, wraps footer with `dark` on console routes); Modify `app/layout.tsx` to wrap `<Footer/>`
- Modify: `modules/shared/components/footer/footer.tsx` (Product: Studio, Cloud; drop Packages/Builders)
- Create: `modules/shared/config/redirects.ts` exporting `LEGACY_REDIRECTS`; Modify `next.config.ts` `redirects()`
- Modify: `app/not-found.tsx` (link to `/` or `/cloud` instead of `/packages`), `app/profile/components/teams-tab.tsx` (remove Browse builders link)
- Test: extend `navbar-config.test.ts`; create `modules/shared/config/__tests__/redirects.test.ts`

Redirects (all `permanent: false`): `/packages` → `/user/packages`; `/packages/:id*` → `/user/packages/:id*` only if that route exists (it does not for ids → send to `/user/packages`); `/builders` and `/builders/:path*` → `/`.

- [ ] Step 1: tests — public labels equal `['Studio', 'Cloud', 'Docs']`; no item href `/packages` or `/builders` in public or `/vetra` lists; redirect table maps `/builders/foo` and `/packages/bar` sources. FAIL.
- [ ] Step 2: implement. PASS. Commit `feat(nav): studio/cloud/docs nav, retire packages and builders`.

### Task 7: Verification gate

- [ ] `npm run tsc && npm run lint && npm run format:check && npm run test:unit` all green.
- [ ] `npm run build` succeeds.
- [ ] Start the app, screenshot `/`, `/cloud`, `/studio` at 1440 and 390 px with Playwright; check no horizontal scroll and dark chrome.
- [ ] Whole-branch review by a fresh reviewer subagent; fix findings; final commit.
