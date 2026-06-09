# `/studio` Page — Design

**Date:** 2026-06-09
**Status:** Approved (design); pending implementation plan

## Summary

A new top-level route `/studio` that gives a logged-in user a Vetra Studio
environment with one click. It detects whether the user already has a Vetra
Studio agent; if so it embeds the agent's Connect studio UI in an iframe; if
not, it provisions a dedicated environment containing a single `vetra-cli`
CLINT agent, shows a live boot spinner, and embeds the studio once it is ready.

## Context (verified facts)

- **Studio agent = the `vetra-cli` package** (`registry.dev.vetra.io`, latest
  `0.0.1-dev.8`). Its `powerhouse.manifest.json` declares:
  - `type: "clint-project"`, `features.agent.id: "vetra-agent"`, name "Vetra Agent"
  - `features.powerhouse: { support: "Connect", package: "vetra-app" }` and
    `proxyEnabled: true` — the agent proxies its own Switchboard **and** serves
    the Vetra Studio Connect UI.
  - `supportedResources: ["vetra-agent-xl", "vetra-agent-xxl"]` (XL/XXL only).
  - `config` requires secrets `ANTHROPIC_API_KEY`, `VETRA_ANTHROPIC_API_KEY`,
    `VETRA_CLI_ANTHROPIC_API_KEY`.
- A live reference (`warm-newt-75-aa726a95` namespace) confirms a healthy studio
  environment is a **single CLINT deployment** — one pod, one service, one
  ingress at `vetra-agent.<subdomain>.vetra.io`, with **no** separate
  CONNECT / SWITCHBOARD / Postgres services. The agent is self-contained.
- The agent's `/_proxy/routes` exposes a root route
  `{ prefix: "/", source: "service:vetra-studio" }` — this is the embeddable
  studio UI, served at `https://<prefix>.<subdomain>.vetra.io/`.
- The studio host returns **no** `X-Frame-Options` and **no** CSP
  `frame-ancestors`, so it can be embedded in an iframe from `vetra.to`.

## Decisions

1. **Studio agent**: `vetra-cli` CLINT package; embed its root `/` route.
2. **Detection**: a user "has a studio" iff one of their environments (scope
   `MINE`) contains a CLINT service whose package name is `vetra-cli`.
3. **Provisioning**: if none exists, create a **dedicated** environment with a
   single `vetra-cli` CLINT agent — prefix `vetra-agent` (the manifest's
   `agent.id`), size **XL**, restricted to an **allowlist**.
4. **API key**: prompt the user for their Anthropic API key before
   provisioning; store it as the agent's required secrets.
5. **Embed**: cross-origin **iframe** of
   `https://vetra-agent.<subdomain>.vetra.io/?user=<did>`, with an
   always-present **"Open in new tab"** fallback.
6. **v1 scope**: one studio per user. The longer-term product direction is one
   environment per *product* (a user creates products, each gets its own
   instance); the data model and helpers should not preclude that, but v1
   ships a single per-user studio.

## Architecture

### State machine

A single hook `useStudioEnvironment()` resolves the page to exactly one state;
`studio-client.tsx` renders per state.

| State | Condition | UI |
|---|---|---|
| `unauthenticated` | no Renown session | Login / connect prompt |
| `not-allowed` | logged in, not on allowlist | "Studio is in limited preview" |
| `none` | allowlisted, no `vetra-cli` env | "Create your studio" CTA |
| `collecting-key` | user clicked create | Anthropic key form |
| `creating` | provisioning (push + approveChanges) | Spinner: "Setting up…" |
| `booting` | env exists, agent not ready / no website endpoint yet | Spinner with live status/phase |
| `ready` | agent pod ready **and** website runtime endpoint present | iframe + new-tab link |
| `error` | create failed / boot timeout / CrashLoop | Error + retry + link to env detail / logs |

**"Ready to embed"** = the agent pod is ready **AND** a `clintRuntimeEndpoints`
website entry (the `/` route) exists. Reuses `useClintRuntimeEndpoints` and
`deriveClintAgentStatus`.

### Components & files

New route under `app/studio/`; supporting logic under `modules/cloud/studio/`.

- `app/studio/page.tsx` — route shell.
- `app/studio/studio-client.tsx` — client component; switches on state.
- `modules/cloud/studio/use-studio-environment.ts` — state hook composing
  `useEnvironments`, environment detail, `useClintRuntimeEndpoints`, and the
  viewer/allowlist check.
- `modules/cloud/studio/find-studio-agent.ts` — **pure** detection helper
  (input: environments + their services; output: the matching studio
  environment/agent or null). Independently testable.
- `modules/cloud/studio/create-studio-environment.ts` — orchestrates the
  document-model controller:
  `setOwner → setLabel("Vetra Studio") → initialize →
  addPackage(vetra-cli@latest) →
  enableService(CLINT, "vetra-agent", clintConfig{ size: XL, env: key }) →
  push → approveChanges`.
  Reuses the existing controller and the agent-config (`clintConfig`) builder
  shared with `add-agent-modal`.
- `modules/cloud/studio/studio-embed-url.ts` — builds
  `https://<prefix>.<subdomain>.vetra.io/?user=<did>`.
- UI components:
  - `studio-gate.tsx` — auth + allowlist gating.
  - `studio-create-form.tsx` — Anthropic key input.
  - `studio-boot-screen.tsx` — spinner with live status text.
  - `studio-frame.tsx` — iframe + "Open in new tab" fallback.

### Allowlist

`NEXT_PUBLIC_STUDIO_ALLOWLIST` — comma-separated, lowercased addresses,
mirroring the existing `ADMINS` pattern. This is a **frontend UX gate only**
for v1: environment creation is already open to any authenticated user, so the
allowlist limits who sees the create flow, not a hard security boundary. A real
backend gate can be added later if needed.

## Data flow

1. Page loads → `useStudioEnvironment()`:
   - No Renown session → `unauthenticated`.
   - Session but address not in allowlist → `not-allowed`.
   - Fetch `myEnvironments(MINE)`; for each, resolve services and run
     `find-studio-agent`.
   - Match found → resolve embed-readiness (pod ready + website endpoint):
     ready → `ready`; otherwise → `booting`.
   - No match → `none`.
2. From `none`, user clicks "Create" → `collecting-key` (key form).
3. On submit → `creating`: run `create-studio-environment`. On success the
   environment now exists → transition to `booting`.
4. `booting` polls environment status + pods + `clintRuntimeEndpoints` (reusing
   existing 10s polling/subscription patterns) until embed-ready → `ready`.
5. `ready` renders `studio-frame` with `studio-embed-url`.

## Error handling

- **Create/push/approve failure** → `error` with retry.
- **Boot timeout (~10 min)** → "taking longer than expected" with a link to
  `/cloud/<id>` and its logs.
- **Agent CrashLoopBackOff** (e.g. bad/missing API key — observed in-cluster)
  → surface the failure and link to the agent's config/logs.

## Open risk (validate during implementation)

- **Renown sign-in while framed**: studio Connect authenticates via Renown,
  which may redirect to `renown.id` (could refuse framing) or require wallet
  interaction that misbehaves inside a cross-origin iframe. **First
  implementation step**: validate whether a framed studio can authenticate via
  `?user=<did>` and sign. The always-present "Open in new tab" fallback
  de-risks this regardless of the outcome.
- **Cross-origin storage partitioning (CHIPS)**: the framed studio gets
  storage partitioned by the `vetra.to` top-level origin, isolated from a
  directly-opened studio tab. Acceptable for v1; documented for awareness.

## Testing

- **Unit (vitest):**
  - `find-studio-agent` across environment/service shapes (no envs, env without
    CLINT, CLINT with non-`vetra-cli` package, multiple matches).
  - `studio-embed-url` (host composition, `?user` propagation, trailing slash).
  - State-machine transitions in `use-studio-environment` (where extractable as
    a pure reducer).
- **Component (testing-library):**
  - Gate renders the correct state for unauthenticated / not-allowed / none.
  - Boot screen renders a spinner and live status.
  - `studio-frame` renders an iframe with the correct `src` and a working
    "Open in new tab" link.

## Future (out of scope for v1)

- Per-product studio instances (user creates products; each gets its own env).
- Backend-enforced access control for studio provisioning.
- Same-origin reverse-proxy embed (eliminates storage/auth partitioning) if the
  cross-origin iframe proves limiting.
