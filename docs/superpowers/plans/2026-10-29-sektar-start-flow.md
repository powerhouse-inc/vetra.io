# Sektar start flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From sektar.vetra.io a visitor can open Sektar free in the browser, download the desktop app, or (with an invite code) get their own cloud Sektar host on Vetra.

**Architecture:** Release tags of the Sektar repo build the `cli` host image (artifact `host`, channel LATEST) and desktop installers. Vetra's licensing provisions one dedicated environment per redeemed code from a Sektar template; a FUSION service whose artifact is `host` is rendered in host mode with the holder as `ADMINS`. The site wires the three cards and redeems codes with the visitor's Renown bearer, then finds the environment through the directory.

**Tech Stack:** Node (vetra-deploy-action, `node --test`), TypeScript + vitest + Kysely (vetra-cloud-package), Next.js (site), GitHub Actions + Tauri (desktop), Helm values (hosting).

**Spec:** `docs/superpowers/specs/2026-10-29-sektar-start-flow-design.md`

## Global Constraints

- Sektar App id `43622402-be06-435a-bbfa-bb649b0d6244`, Harbor project `app-sektar`.
- Free URL: `https://calm-bat-b4qzzqbb-connect.vetra.io/`.
- Download URL: `https://github.com/powerhouse-inc/sektar/releases/latest`.
- Host artifact name: `host`; host env: `PH_HOST=cli`, `ADMINS=<holder address>`.
- Master key file: `$PH_USER_DATA_DIR/workflows-master-key`, 64 hex chars, mode 600.
- Main pushes of Sektar must not build or deploy the image (Wouter's env untouched).
- Never commit or push the user's staged `docs/vetra-access-codes-subgraph.md` deletion; no AI attribution in commits.
- Cloud-package releases go staging pin first, then the `vetra` pin.

## Review Focus

- A cloud Sektar restarted or updated keeps the same master key (key file on `/data`, not regenerated when present).
- A non-host FUSION template (artifact `app`) renders exactly as before (no PH_HOST, no ADMINS).
- A floor update of a host env re-adds missing `PH_HOST`/`ADMINS` without dropping env the holder set.
- Redeeming an already-used or wrong code on the site shows the server's message and does not hang waiting.
- An image from a project that is neither the env's App's nor allowlisted stays refused for licensed envs of other apps.

---

### Task 1: vetra-deploy-action builds FUSION images on release tags

**Files:**
- Modify: `src/index.js` (move the fusion build before the release early return; channel stays `channelForClassification`)
- Test: `test/fusion-apps.test.js` or new `test/release-images.test.js`

**Interfaces:** Produces: on `refs/tags/v*`, FUSION_IMAGE artifacts recorded with channel `LATEST`, image tag `sha-<sha12>`, no `/deploy` call.

- [ ] **Step 1:** Extract the image loop into `buildFusionImages({ fusionApps, vetraUrl, appsToken, appId, sha, sha12, runId, channel }) -> Promise<string|null>` (returns the first image ref) in `src/images-step.js`; test with injected `build`/`record` fakes: release classification records each image with `channel: 'LATEST'`.
- [ ] **Step 2:** In `main()`, call it before the `classification.kind === 'release'` return; the release branch returns after it without deploying.
- [ ] **Step 3:** `npm test` → all pass.
- [ ] **Step 4:** PR, merge, tag `v1.0.6`, move `v1`.

### Task 2: Sektar host image and release workflows

**Files:**
- Modify: `hosts/cli/docker-entrypoint.sh`, `hosts/cli/Dockerfile`, `.github/workflows/vetra.yml`, `hosts/cli/README.md`
- Create: `.github/workflows/desktop.yml`

- [ ] **Step 1:** Entrypoint: if `PH_WORKFLOWS_SECRETS_MASTER_KEY` is empty, read `$PH_USER_DATA_DIR/workflows-master-key`, creating it first (`node -e` crypto randomBytes(32) hex, umask 077) when absent; export it. Explicit env wins.
- [ ] **Step 2:** Dockerfile runtime `ENV AUTH_ENABLED=true REQUIRE_AUTHENTICATED_CALLER=true RESOLVE_CALLER_IDENTITY=true`.
- [ ] **Step 3:** Verify locally: run the image twice on one volume without the key env; second start reuses the same file (same content), Connect answers 200, `POST /graphql` answers JSON.
- [ ] **Step 4:** `vetra.yml`: `fusion-dockerfile: ${{ startsWith(github.ref, 'refs/tags/v') && 'hosts/cli/Dockerfile' || '' }}`, `fusion-image-name: host`.
- [ ] **Step 5:** `desktop.yml` on `push: tags: ['v*']` + `workflow_dispatch`: matrix `macos-latest`, `windows-latest`, `ubuntu-22.04`; setup pnpm 12.10.1/node 24, `dtolnay/rust-toolchain@stable`, Linux deps (`libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf`), `pnpm install --frozen-lockfile`, `npx ph-cli run desktop build` with `FEATURE_UNIFORM_RUNNERS_ENABLED=1`, upload `hosts/desktop/tauri-shell/target/release/bundle/**` to the release via `softprops/action-gh-release@v2`.
- [ ] **Step 6:** README "On Vetra": key handling, release tags.
- [ ] **Step 7:** Commit on PR #2 (push over SSH: workflow scope), merge after Task 1 is released.

### Task 3: vetra-cloud-package host templates and licensed image access

**Files:**
- Modify: `subgraphs/vetra-licensing/template.ts` (`NormalisedTemplate.services[].host?: string`, `validateTemplate`, `fusionActions(s, owner)`, `renderCreateActions`, `floorFusionActions(…, owner)`, `renderFloorUpdateActions`)
- Modify: `processors/vetra-cloud-environment/app-image-project.ts` (licensed env branch)
- Test: `subgraphs/vetra-licensing/__tests__/template.test.ts`, `processors/vetra-cloud-environment/app-image-project.test.ts`

**Interfaces:** Produces `hostEnv(owner: string): { name: string; value: string; isSecret: false }[]` = `[{PH_HOST,"cli"},{ADMINS,owner}]`.

- [ ] **Step 1 (tests):** `renderCreateActions` with a FUSION service `artifactName: "host"` → SET_FUSION_CONFIG env `[PH_HOST=cli, ADMINS=<owner>]`; with `artifactName: "app"` → env `[]` (unchanged). `renderFloorUpdateActions` on a host env missing PH_HOST/ADMINS but with `{FOO=1}` → env keeps FOO and adds both; on a complete env → no SET_FUSION_CONFIG.
- [ ] **Step 2:** Implement; `templateHash` unchanged (artifactName already hashed).
- [ ] **Step 3 (tests):** resolver returns `app.harbor_project` for a document with a `license_environments` row (`environment_id`, `app_id`) of an App whose `harbor_project` is set; returns null for a row of another app id that does not exist; app-linked behaviour unchanged.
- [ ] **Step 4:** Implement: when `state.app` is absent, look up `license_environments` by `environment_id` (licensing namespace DB passed into `createAppImageProjectResolver(appsDb, licensingDb?)`), then `apps.harbor_project`; any failure → null. Wire in the processor factory.
- [ ] **Step 5:** `npx vitest run` full suite, `tsc`; PR, merge, wait for publish, pin staging, check boot, pin prod.

### Task 4: Site wires free, download and redeem

**Files:**
- Modify: `lib/config.ts` (`FREE_URL`, `DOWNLOAD_URL`), `components/site-controller.tsx`, `lib/environments.ts` (`redeemCloud(code, bearer): Promise<void>`), `Dockerfile`, `.env.example`, `README.md`

- [ ] **Step 1:** Free card button (the disabled "At launch" one in the get-started section): enable, label "Open in your browser", navigate to `FREE_URL`.
- [ ] **Step 2:** Local card: add a "Download" link to `DOWNLOAD_URL` next to its button.
- [ ] **Step 3:** In the "where" step with kind `vetra`: when the directory returned none, show an invite-code input + "Start my cloud Sektar"; `redeemCloud` POSTs `mutation($i: RedeemInviteCodeInput!){ vetraSubscriptions { redeemInviteCode(input:$i){ __typename } } }` to `https://switchboard.vetra.io/graphql` with `{ code, label: "Sektar" }`; GraphQL errors surface their message.
- [ ] **Step 4:** After redeem, poll `fromDirectory` every 10 s up to 10 min, then `answers(url)` every 10 s; on success `go()` to it; on timeout say it is still starting and keep the code-less path.
- [ ] **Step 5:** typecheck, lint, build, bundle check; PR, merge (deploys).

### Task 5: Release and set up Sektar cloud (operations)

- [ ] **Step 1:** Tag Sektar `v1.0.0` on main after PR #2 merges; watch `vetra.yml` (image `host` on LATEST) and `desktop.yml` (release assets).
- [ ] **Step 2:** With the admin wallet (publisher API): `addTemplate {appId, name:"Sektar cloud", mode:"DEDICATED"}`, `addTemplateService {type:"FUSION", prefix:"sektar", artifactName:"host", artifactChannel:"LATEST"}`, `addTerm {kind:"sektar-cloud", label:"Sektar cloud", templateId}`, `publishTerm`, `createInviteCode {kind:"sektar-cloud", maxUses:1}`.
- [ ] **Step 3:** End to end with the admin wallet as holder: redeem a code via the API, watch the env provision, host pod Running, Connect 200, directory lists it with its host URL. Then mint a code for Frank.
- [ ] **Step 4:** Browser check of all three cards on sektar.vetra.io.
