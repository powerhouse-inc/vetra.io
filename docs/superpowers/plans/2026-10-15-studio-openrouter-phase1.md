# Studio on OpenRouter, Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Goal / Architecture / Tech Stack / Spec

**Goal.** Every Vetra Studio gets its model through OpenRouter. By default that is a capped, per-Studio OpenRouter key that Vetra provisions from the licence's monthly LLM budget. A Studio without a key no longer hangs in "provisioning": it serves and answers "No model is connected…".

**Architecture.**

- A new `vetra-llm` subgraph in `vetra-cloud-package` is the key broker. It:
  - holds an OpenRouter management key;
  - creates, limits, disables and deletes one key per Studio (`studio:<envId>`);
  - stores the key's hash and transit ciphertext in `studio_llm_keys`;
  - writes `OPENROUTER_API_KEY` and `VETRA_MODEL` into the tenant through `SecretsService`.
- The warm-pool claim and the cold creation path (`provisionStudioLlm`) both call the broker.
- A 15-minute sweeper keeps keys in line with licences and budgets.
- The budget comes from `invite_codes.llm_budget_usd` and follows the licence chain, as `keyCiphertext` does today.
- In `vetra-cli`, a single `llm.ts` factory builds every Mastra model with `@openrouter/ai-sdk-provider`. When there is no key, the agent never makes an LLM call: a "no model" `AgentProvider` answers instead.

**Tech stack.**

- `vetra-cloud-package`: TypeScript, Kysely (PGlite in tests), vitest, oxlint, oxfmt, reactor-api `BaseSubgraph`.
- `vetra-cli`: TypeScript, Mastra 1.41, ph-clint, `@openrouter/ai-sdk-provider@1.5.4` (AI SDK v5 provider spec v2, no `ai` import), jest (ts-jest ESM).
- `vetra.io`: Next.js 16, React 19, React Query, vitest, prettier.

**Spec.** `/home/f/projects/vetra.io-studio/docs/superpowers/specs/2026-10-15-studio-openrouter-design.md`

### Scope notes (decided while planning; read before starting)

1. **Per-conversation cost display moves to Phase 2.**
   - `mapMastraStream` lives in `/home/f/projects/ph-clint/packages/ph-clint/src/integrations/mastra/stream.ts`.
   - The chat session usage lives in `@powerhousedao/clint-common`, a separate repo (`/home/f/projects/ph-clint/packages/clint-common`).
   - Neither is `vetra-cli` source, and this plan never edits `node_modules`.
   - Phase 1 does request `usage: { include: true }` on every model (Task 10), so `usage.cost` already arrives in the final SSE chunk for Phase 2 to read.
2. **The publisher "Monthly LLM budget" UI moves into Phase 1** (Task 13), as the task brief asks. The spec lists it under Phase 2.
3. **The Studio card's "Connect a model" uses a minimal status, `studioLlmStatus`, not `studioLlmUsage`.**
   - `studioLlmStatus` is one DB read of the tenant's secret names (does `OPENROUTER_API_KEY` exist). It makes no OpenRouter call per card, so it is the cheaper choice.
   - `studioLlmUsage` is still built (Task 5 and Task 6) for the Phase 2 meter.
4. **The no-model reply is the spec's exact text.** It names "Studio settings → Model", which ships in Phase 2. That is intentional: the copy stays stable across phases.
5. **Phase 1 still writes the Anthropic secrets during the transition.**
   - Between migration steps 1 and 3, claimed pool Studios still run the old agent, and the old agent reads `VETRA_ANTHROPIC_API_KEY`. So the claim still writes the licence's Anthropic key when one exists, behind `STUDIO_POOL_LEGACY_ANTHROPIC_KEY` (default `true`, set `false` after cut-over).
   - The agent itself stops reading Anthropic keys in Phase 1. Server-side `applyStudioKey`, `setInviteCodeAnthropicKey`, `anthropic_key_ciphertext`, the `@ai-sdk/anthropic` dependency and the `ph-clint-claude-subscription` dependency all stay until Phase 3. vetra.io stops calling the first two.
6. **Orphan cleanup needs `OPENROUTER_WORKSPACE_ID`.**
   - Staging and prod share one OpenRouter organisation (spec §5).
   - `GET /api/v1/keys` returns the default workspace unless `workspace_id` is passed (verified in `https://openrouter.ai/openapi.yaml`). So a staging sweeper without a workspace would see prod's `studio:*` keys as orphans and delete them.
   - Each deployment therefore gets its own workspace, and the orphan rule runs only when `OPENROUTER_WORKSPACE_ID` is set.
7. **OpenBao uses two paths, not one.**
   - The chart's `extraExternalSecret` uses the property name as the env var name (`powerhouse-k8s-hosting/powerhouse-chart/templates/external-secret-switchboard-extra.yaml:20-38`), so one path cannot hold two different `OPENROUTER_MANAGEMENT_KEY` values.
   - Staging reads `powerhouse/shared/openrouter-staging` and prod reads `powerhouse/shared/openrouter`.
8. **Money columns are `double precision`, not `numeric`.** Postgres `numeric` comes back from pg and PGlite as a string (`"20.00"`). That is Review Focus 5.
9. **The key env name.**
   - ph-clint maps a config field `x` to `VETRA_X` (`/home/f/projects/ph-clint/packages/ph-clint/src/core/config.ts:23-25`). The field `openrouterApiKey` therefore reads `VETRA_OPENROUTER_API_KEY`.
   - The broker writes `OPENROUTER_API_KEY` (the spec name), so the agent reads both (Task 10). That is Review Focus 2.
10. **Context limit cost note.** `anthropic/claude-sonnet-4.6` reports `context_length` 1,000,000, so the spec's 80% rule allows 800,000-token prompts. The per-key budget caps spend, but long sessions will cost more than they did under the old 160k ceiling. Flag this to the product owner; the plan implements the spec as written.

11. **Deploy order matters.** vetra.io Task 12 removes the client-side Anthropic write from cold creation. If it ships before the OpenRouter agent is the pool version, every cold-created Studio still runs the old image and sits in its hold loop. Task 14 therefore deploys Task 12 only after the cut-over (Task 14, step 8).
12. **`claude-login` and its commands stay registered** (`vetra-cli/src/cli.ts:41,71`) until Phase 3. The agent no longer reads their session.

## Repos & worktrees

| Repo | Base | Worktree | Branch | Tasks |
| --- | --- | --- | --- | --- |
| `vetra-cloud-package` | `feat/studio-app-flow` @ `5ceda68` (checked out in `/home/f/projects/vetra-cloud-package-studioflow`) | `/home/f/projects/vetra-cloud-package-openrouter` | `feat/studio-openrouter` | 1–9 |
| `vetra-cli` (monorepo, package `vetra-cli/`) | `origin/main` @ `125bf06` | `/home/f/projects/vetra-cli-openrouter` | `feat/studio-openrouter` | 10–11 |
| `vetra.io` | `explore/studio-integration` (contains this plan) | `/home/f/projects/vetra.io-openrouter` | `feat/studio-openrouter` | 12–13 |
| `powerhouse-k8s-hosting` | `main` | `/home/f/projects/powerhouse-k8s-hosting` | human, ops | 14 |

Setup (once):

```bash
git -C /home/f/projects/vetra-cloud-package-studioflow worktree add -b feat/studio-openrouter /home/f/projects/vetra-cloud-package-openrouter feat/studio-app-flow
cd /home/f/projects/vetra-cloud-package-openrouter && pnpm install --frozen-lockfile

git -C /home/f/projects/vetra-cli fetch origin
git -C /home/f/projects/vetra-cli worktree add -b feat/studio-openrouter /home/f/projects/vetra-cli-openrouter origin/main
cd /home/f/projects/vetra-cli-openrouter && pnpm install --frozen-lockfile

git -C /home/f/projects/vetra.io-studio worktree add -b feat/studio-openrouter /home/f/projects/vetra.io-openrouter explore/studio-integration
cd /home/f/projects/vetra.io-openrouter && npm ci
```

All `vetra-cloud-package` paths below are relative to `/home/f/projects/vetra-cloud-package-openrouter`. `vetra-cli` paths (always written with their `vetra-cli/` prefix) are relative to the monorepo root `/home/f/projects/vetra-cli-openrouter`, where the `pnpm --filter vetra-cli ...` commands run, and `vetra.io` paths to `/home/f/projects/vetra.io-openrouter`.

## Global Constraints

- Main model default: `anthropic/claude-sonnet-4.6`. Verified 2026-10-15 with `curl -s https://openrouter.ai/api/v1/models | jq`: context_length 1000000, supports `tools`.
- Memory model default: `anthropic/claude-haiku-4.5`. Verified the same way: context_length 200000, supports `tools`.
- Sub-agent model default: the main model (`VETRA_SUBAGENT_MODEL` unset).
- `limit_reset` for Vetra keys: `"monthly"`. The enum is `daily | weekly | monthly | null`, verified in `https://openrouter.ai/openapi.yaml` (`POST /keys` request schema). It is hardcoded, not configured.
- Key name: `studio:<environmentId>`. Tenant secret: `OPENROUTER_API_KEY`. Tenant var: `VETRA_MODEL`.
- Agent env: `OPENROUTER_API_KEY` (or `VETRA_OPENROUTER_API_KEY`), `VETRA_MODEL`, `VETRA_SUBAGENT_MODEL`, `VETRA_MEMORY_MODEL`, `VETRA_MODEL_FALLBACKS`, `VETRA_LLM_ALLOW_DATA_COLLECTION`.
- Provider preference: `{ data_collection: "deny" }`. `VETRA_LLM_ALLOW_DATA_COLLECTION=true` sends `"allow"`.
- Attribution headers: `HTTP-Referer: https://vetra.io` and `X-OpenRouter-Title: Vetra Studio`. The header name was verified in openapi.yaml `components.parameters.AppDisplayName`.
- Fallbacks: `VETRA_MODEL_FALLBACKS`, a comma list. Only the first 3 are used, sent as `extraBody.models = [primary, ...fallbacks]`.
- Caching: top-level `cache_control: { type: "ephemeral" }` only when the model id starts with `anthropic/`. The automatic top-level breakpoint is documented in openapi.yaml `AnthropicCacheControlDirective`. `wrapAgent`'s `cacheControl` stays off: it sets `providerOptions.anthropic` at call level, and the OpenRouter provider ignores that (it spreads only `providerOptions.openrouter`, `@openrouter/ai-sdk-provider@1.5.4` `dist/index.mjs:1692-1694`).
- Context limit: 80% of OpenRouter `context_length`, with a 200,000 fallback (so 160,000). Fetched once per model per process from `https://openrouter.ai/api/v1/models`.
- No-model reply, verbatim: `No model is connected. Open Studio settings → Model to use the Vetra budget or connect your OpenRouter account.`
- Budget:
  - per code: `invite_codes.llm_budget_usd` (`double precision`, nullable), following the licence chain;
  - otherwise the `VETRA_LLM_DEFAULT_BUDGET_USD` per-deployment env (unset or invalid means 0);
  - range 0–10,000 USD, rounded to cents;
  - 0 means no Vetra key.
- Broker env: `OPENROUTER_MANAGEMENT_KEY` (absent means `SERVICE_NOT_CONFIGURED`), `OPENROUTER_WORKSPACE_ID`, `VETRA_LLM_DEFAULT_MODEL` (default `anthropic/claude-sonnet-4.6`) and `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`).
- Sweeper: every 15 minutes. The orphan grace is 30 minutes, and orphans are swept only when `OPENROUTER_WORKSPACE_ID` is set.
- `studioLlmUsage` cache: 60 seconds per env.
- **No raw `sql` table references in subgraph code.** The subgraph DB is a `withSchema` namespace, and raw SQL crashed staging on 2026-10-15. Use the Kysely builder only. Every new migration test also runs against `root.withSchema("<ns>")`.
- **Never log keys or ciphertext.** Every log line and client error that can carry upstream text goes through `redactSecrets`, which covers `sk-or-`, `sk-ant-` and `vault:v\d+:`. Licensing's own `SECRET_PATTERNS` also gains `sk-or-`.
- Gate, `vetra-cloud-package`: `pnpm vitest run && pnpm tsc && pnpm lint`, plus `pnpm exec oxfmt <changed files>`.
- Gate, `vetra-cli` (from `vetra-cli/package.json` scripts): `pnpm --filter vetra-cli typecheck && pnpm --filter vetra-cli lint && pnpm --filter vetra-cli test && pnpm --filter vetra-cli check:deps`.
- Gate, `vetra.io`: `npm run tsc && npm run lint && npm run format:check && npm run test:unit`.
- Commits: small, one per task step marked "Commit". **No `Co-Authored-By` and no AI attribution trailer.**
- Never edit `node_modules`, `ph-clint` or `clint-common`.

## Review Focus

These five failure modes follow from the spec but are not tested by any spec bullet. Each now has a test in its owning task.

1. **The namespace crash repeats.**
   - The risk: a raw-SQL or unqualified reference in the new `studio_llm_keys` migration or the `llm_budget_usd` column resolves against `public` and crashes switchboard boot, as on 2026-10-15.
   - Test: Task 2's `studio_llm_keys` migration test and Task 3's licensing migration test both run `up()` against `root.withSchema(...)` with nothing in `public`.
2. **The secret is written but never read.**
   - The risk: the broker writes `OPENROUTER_API_KEY`, but a ph-clint config field `openrouterApiKey` only reads `VETRA_OPENROUTER_API_KEY`. The Studio would sit in no-model mode forever while the card says it is connected.
   - Tests: Task 10 asserts `resolveLlmSettings` picks up a bare `OPENROUTER_API_KEY`, and Task 5 asserts the broker writes exactly `OPENROUTER_API_KEY`.
3. **The orphan sweep deletes live keys.**
   - The risks: (a) a key that `provisionVetraKey` has minted but not yet recorded is seen as an orphan; (b) keys of the other deployment in the shared OpenRouter org are deleted.
   - Test: Task 8 covers the 30-minute grace window and the "workspace or nothing" rule.
4. **Two concurrent provisions mint two keys.**
   - The risk: a double-click, or a claim and a cold fallback racing for the same env, each `POST /keys`. That leaves an unbudgeted, unrecorded key that bills the org.
   - Test: Task 5 runs two concurrent `provisionVetraKey` calls and asserts exactly one key on the fake.
5. **The budget arrives as a string.**
   - The risk: a `numeric` column returns `"20.00"`, so `limit_usd !== budget` is always true and the sweeper PATCHes every key every 15 minutes, and the GraphQL `Float!` serialises a string.
   - Tests: Task 2 and Task 3 assert that the values read back are JS numbers (`typeof === "number"`).

---

## Tasks

### Task 1: OpenRouter management client and test fake (vetra-cloud-package)

**Files**

- Create: `subgraphs/vetra-llm/redact.ts`
- Create: `subgraphs/vetra-llm/openrouter.ts`
- Create: `subgraphs/vetra-llm/__tests__/fake-openrouter.ts`
- Modify: `subgraphs/vetra-licensing/publisher-errors.ts:115-120` (`SECRET_PATTERNS`)
- Test: `subgraphs/vetra-llm/__tests__/openrouter.test.ts`
- Test: `subgraphs/vetra-licensing/__tests__/publisher-errors.test.ts` (append after the `sk-ant` case at :130-131)

**Interfaces**

- Consumes: global `fetch`, or an injected `typeof fetch`.
- Produces:
  - `redactSecrets(text: string): string`
  - `OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"`
  - `type LimitReset = "daily" | "weekly" | "monthly"`
  - `interface OpenRouterKey { hash: string; name: string; disabled: boolean; limit: number | null; limitRemaining: number | null; limitReset: LimitReset | null; usage: number; usageMonthly: number; createdAt: string }`
  - `interface OpenRouterModel { id: string; name: string; contextLength: number; supportsTools: boolean; promptUsdPerToken: number; completionUsdPerToken: number }`
  - `class OpenRouterError extends Error { status: number }`
  - `interface OpenRouterApi`:
    - `createKey(i: { name: string; limitUsd: number; limitReset: LimitReset; workspaceId: string | null }): Promise<{ key: string; data: OpenRouterKey }>`
    - `getKey(hash: string): Promise<OpenRouterKey | null>`
    - `updateKey(hash: string, patch: { limitUsd?: number; disabled?: boolean }): Promise<OpenRouterKey>`
    - `deleteKey(hash: string): Promise<void>`
    - `listKeys(i: { workspaceId: string | null }): Promise<OpenRouterKey[]>`
  - `createOpenRouterApi(opts: { managementKey: string; baseUrl?: string; fetch?: typeof fetch }): OpenRouterApi`
  - `fetchOpenRouterModels(opts?: { baseUrl?: string; fetch?: typeof fetch }): Promise<OpenRouterModel[]>`
  - Test-only: `createFakeOpenRouter(now?: () => Date): FakeOpenRouter`, where `FakeOpenRouter` is `{ api; keys; calls; failNext(op, status); seed(i) }`.

- [ ] **Step 1: Write the failing tests**

`subgraphs/vetra-llm/__tests__/openrouter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  createOpenRouterApi,
  fetchOpenRouterModels,
  OpenRouterError,
} from "../openrouter.js";

type Call = {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
};

function stubFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Call[] = [];
  const fetchImpl = (async (url: string, init?: RequestInit) => {
    calls.push({
      url,
      method: init?.method ?? "GET",
      headers: (init?.headers ?? {}) as Record<string, string>,
      body: init?.body ? JSON.parse(init.body as string) : undefined,
    });
    const next = responses.shift() ?? {
      status: 500,
      body: { error: { message: "no stubbed response" } },
    };
    return new Response(
      next.body === undefined ? null : JSON.stringify(next.body),
      { status: next.status },
    );
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const RAW_KEY = {
  hash: "f01d52",
  name: "studio:env-1",
  label: "sk-or-v1-0e6...1c96",
  disabled: false,
  limit: 20,
  limit_remaining: 17.5,
  limit_reset: "monthly",
  usage: 2.5,
  usage_monthly: 2.5,
  created_at: "2026-10-15T10:00:00Z",
};

describe("OpenRouter management client", () => {
  it("creates a monthly-capped key in the workspace with the management bearer", async () => {
    const { calls, fetchImpl } = stubFetch([
      { status: 201, body: { data: RAW_KEY, key: "sk-or-v1-secret" } },
    ]);
    const api = createOpenRouterApi({ managementKey: "mgmt", fetch: fetchImpl });
    const res = await api.createKey({
      name: "studio:env-1",
      limitUsd: 20,
      limitReset: "monthly",
      workspaceId: "ws-1",
    });
    expect(calls[0]).toMatchObject({
      url: "https://openrouter.ai/api/v1/keys",
      method: "POST",
      body: { name: "studio:env-1", limit: 20, limit_reset: "monthly", workspace_id: "ws-1" },
    });
    expect(calls[0].headers.Authorization).toBe("Bearer mgmt");
    expect(res.key).toBe("sk-or-v1-secret");
    expect(res.data).toStrictEqual({
      hash: "f01d52",
      name: "studio:env-1",
      disabled: false,
      limit: 20,
      limitRemaining: 17.5,
      limitReset: "monthly",
      usage: 2.5,
      usageMonthly: 2.5,
      createdAt: "2026-10-15T10:00:00Z",
    });
  });

  it("omits workspace_id without a workspace", async () => {
    const { calls, fetchImpl } = stubFetch([
      { status: 201, body: { data: RAW_KEY, key: "sk-or-v1-secret" } },
    ]);
    const api = createOpenRouterApi({ managementKey: "mgmt", fetch: fetchImpl });
    await api.createKey({ name: "studio:env-1", limitUsd: 5, limitReset: "monthly", workspaceId: null });
    expect(calls[0].body).toStrictEqual({ name: "studio:env-1", limit: 5, limit_reset: "monthly" });
  });

  it("patches only the given fields", async () => {
    const { calls, fetchImpl } = stubFetch([
      { status: 200, body: { data: { ...RAW_KEY, limit: 25 } } },
      { status: 200, body: { data: { ...RAW_KEY, disabled: true } } },
    ]);
    const api = createOpenRouterApi({ managementKey: "mgmt", fetch: fetchImpl });
    expect((await api.updateKey("f01d52", { limitUsd: 25 })).limit).toBe(25);
    expect((await api.updateKey("f01d52", { disabled: true })).disabled).toBe(true);
    expect(calls.map((c) => [c.method, c.url, c.body])).toStrictEqual([
      ["PATCH", "https://openrouter.ai/api/v1/keys/f01d52", { limit: 25 }],
      ["PATCH", "https://openrouter.ai/api/v1/keys/f01d52", { disabled: true }],
    ]);
  });

  it("reads a missing key as null and deletes a missing key without error", async () => {
    const { fetchImpl } = stubFetch([
      { status: 404, body: { error: { message: "not found" } } },
      { status: 404, body: { error: { message: "not found" } } },
    ]);
    const api = createOpenRouterApi({ managementKey: "mgmt", fetch: fetchImpl });
    expect(await api.getKey("gone")).toBeNull();
    await expect(api.deleteKey("gone")).resolves.toBeUndefined();
  });

  it("lists every page, including disabled keys, in the workspace", async () => {
    const { calls, fetchImpl } = stubFetch([
      { status: 200, body: { data: [RAW_KEY, { ...RAW_KEY, hash: "b" }] } },
      { status: 200, body: { data: [{ ...RAW_KEY, hash: "c" }] } },
      { status: 200, body: { data: [] } },
    ]);
    const api = createOpenRouterApi({ managementKey: "mgmt", fetch: fetchImpl });
    const keys = await api.listKeys({ workspaceId: "ws-1" });
    expect(keys.map((k) => k.hash)).toStrictEqual(["f01d52", "b", "c"]);
    expect(calls.map((c) => c.url)).toStrictEqual([
      "https://openrouter.ai/api/v1/keys?include_disabled=true&offset=0&workspace_id=ws-1",
      "https://openrouter.ai/api/v1/keys?include_disabled=true&offset=2&workspace_id=ws-1",
      "https://openrouter.ai/api/v1/keys?include_disabled=true&offset=3&workspace_id=ws-1",
    ]);
  });

  it("throws OpenRouterError with the status and never the key text", async () => {
    const { fetchImpl } = stubFetch([
      { status: 500, body: { error: { message: "boom for sk-or-v1-leaked123 Bearer mgmt" } } },
    ]);
    const api = createOpenRouterApi({ managementKey: "mgmt", fetch: fetchImpl });
    const err = await api.getKey("x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OpenRouterError);
    expect((err as OpenRouterError).status).toBe(500);
    expect((err as Error).message).not.toContain("sk-or-");
    expect((err as Error).message).not.toContain("Bearer mgmt");
    expect((err as Error).message).toContain("[redacted]");
  });
});

describe("fetchOpenRouterModels", () => {
  it("maps tools support, context and per-token prices", async () => {
    const { calls, fetchImpl } = stubFetch([
      {
        status: 200,
        body: {
          data: [
            {
              id: "anthropic/claude-sonnet-4.6",
              name: "Anthropic: Claude Sonnet 4.6",
              context_length: 1000000,
              supported_parameters: ["tools", "temperature"],
              pricing: { prompt: "0.000003", completion: "0.000015" },
            },
            {
              id: "x/no-tools",
              name: "No tools",
              context_length: 8000,
              supported_parameters: ["temperature"],
              pricing: { prompt: "0", completion: "0" },
            },
          ],
        },
      },
    ]);
    const models = await fetchOpenRouterModels({ fetch: fetchImpl });
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(models).toStrictEqual([
      {
        id: "anthropic/claude-sonnet-4.6",
        name: "Anthropic: Claude Sonnet 4.6",
        contextLength: 1000000,
        supportsTools: true,
        promptUsdPerToken: 0.000003,
        completionUsdPerToken: 0.000015,
      },
      {
        id: "x/no-tools",
        name: "No tools",
        contextLength: 8000,
        supportsTools: false,
        promptUsdPerToken: 0,
        completionUsdPerToken: 0,
      },
    ]);
  });
});
```

Append to `subgraphs/vetra-licensing/__tests__/publisher-errors.test.ts`, inside the `describe` that holds the `sk-ant` redaction case at :130-131:

```ts
    it("redacts OpenRouter keys too", () => {
      const logger = { error: vi.fn() };
      toLicensingGraphQLError("sk-or-v1-abc123", logger);
      expect(logger.error).toHaveBeenLastCalledWith("[licensing] internal error: [redacted]");
    });
```

- [ ] **Step 2: Run them; expect failure**

Run: `pnpm vitest run subgraphs/vetra-llm/__tests__/openrouter.test.ts subgraphs/vetra-licensing/__tests__/publisher-errors.test.ts`

Expected:
- `openrouter.test.ts` fails with `Failed to resolve import "../openrouter.js"`.
- The new publisher-errors case fails with `expected "[licensing] internal error: sk-or-v1-abc123"`.

- [ ] **Step 3: Implement**

`subgraphs/vetra-llm/redact.ts`:

```ts
/** Values that must never reach a log line or a client, even inside an error message. */
const SECRET_PATTERNS: RegExp[] = [
  /sk-or-[A-Za-z0-9_-]+/g, // OpenRouter keys
  /sk-ant-[A-Za-z0-9_-]+/g, // Claude keys (legacy, until phase 3)
  /vault:v\d+:[A-Za-z0-9+/=]+/g, // OpenBao transit ciphertexts
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, // credentials
];

export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((t, re) => t.replace(re, "[redacted]"), text).slice(0, 1000);
}
```

`subgraphs/vetra-llm/openrouter.ts`:

```ts
import { redactSecrets } from "./redact.js";

/**
 * OpenRouter REST client: management keys (provisioning, one per Studio) and
 * the public model list. Shapes verified against https://openrouter.ai/openapi.yaml
 * on 2026-10-15. Error messages are redacted: an upstream body may echo a key.
 */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

export type LimitReset = "daily" | "weekly" | "monthly";

export interface OpenRouterKey {
  hash: string;
  name: string;
  disabled: boolean;
  limit: number | null;
  limitRemaining: number | null;
  limitReset: LimitReset | null;
  usage: number;
  usageMonthly: number;
  createdAt: string;
}

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  supportsTools: boolean;
  promptUsdPerToken: number;
  completionUsdPerToken: number;
}

export interface OpenRouterApi {
  createKey(input: {
    name: string;
    limitUsd: number;
    limitReset: LimitReset;
    workspaceId: string | null;
  }): Promise<{ key: string; data: OpenRouterKey }>;
  /** Null when the key does not exist (404). */
  getKey(hash: string): Promise<OpenRouterKey | null>;
  updateKey(hash: string, patch: { limitUsd?: number; disabled?: boolean }): Promise<OpenRouterKey>;
  /** A key that is already gone (404) counts as deleted. */
  deleteKey(hash: string): Promise<void>;
  /** Every key of the workspace (the default workspace when null), disabled ones included. */
  listKeys(input: { workspaceId: string | null }): Promise<OpenRouterKey[]>;
}

export class OpenRouterError extends Error {
  override name = "OpenRouterError";
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Raw = Record<string, unknown>;

const RESETS = new Set<string>(["daily", "weekly", "monthly"]);
const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function toKey(raw: Raw): OpenRouterKey {
  const reset = typeof raw.limit_reset === "string" && RESETS.has(raw.limit_reset)
    ? (raw.limit_reset as LimitReset)
    : null;
  return {
    hash: String(raw.hash ?? ""),
    name: String(raw.name ?? ""),
    disabled: raw.disabled === true,
    limit: numOrNull(raw.limit),
    limitRemaining: numOrNull(raw.limit_remaining),
    limitReset: reset,
    usage: num(raw.usage),
    usageMonthly: num(raw.usage_monthly),
    createdAt: String(raw.created_at ?? ""),
  };
}

/** Pages of GET /keys are followed until an empty page; this caps a runaway loop. */
const MAX_KEY_PAGES = 100;

async function errorFor(res: Response, method: string, path: string): Promise<OpenRouterError> {
  const text = await res.text().catch(() => "");
  let detail = text;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: unknown } };
    if (typeof parsed.error?.message === "string") detail = parsed.error.message;
  } catch {
    // Not JSON: keep the raw text (redacted below).
  }
  return new OpenRouterError(
    res.status,
    redactSecrets(`OpenRouter ${method} ${path.split("?")[0]} failed (${res.status}): ${detail}`),
  );
}

export function createOpenRouterApi(opts: {
  managementKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
}): OpenRouterApi {
  const base = (opts.baseUrl ?? OPENROUTER_BASE_URL).replace(/\/+$/, "");
  const doFetch = opts.fetch ?? fetch;

  async function call(
    method: string,
    path: string,
    body?: Raw,
    allow404 = false,
  ): Promise<Raw | null> {
    const res = await doFetch(`${base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${opts.managementKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (allow404 && res.status === 404) return null;
    if (!res.ok) throw await errorFor(res, method, path);
    const text = await res.text();
    return text ? (JSON.parse(text) as Raw) : {};
  }

  return {
    async createKey(input) {
      const res = (await call("POST", "/keys", {
        name: input.name,
        limit: input.limitUsd,
        limit_reset: input.limitReset,
        ...(input.workspaceId ? { workspace_id: input.workspaceId } : {}),
      }))!;
      return { key: String(res.key ?? ""), data: toKey((res.data ?? {}) as Raw) };
    },
    async getKey(hash) {
      const res = await call("GET", `/keys/${encodeURIComponent(hash)}`, undefined, true);
      return res ? toKey((res.data ?? {}) as Raw) : null;
    },
    async updateKey(hash, patch) {
      const body: Raw = {};
      if (patch.limitUsd !== undefined) body.limit = patch.limitUsd;
      if (patch.disabled !== undefined) body.disabled = patch.disabled;
      const res = (await call("PATCH", `/keys/${encodeURIComponent(hash)}`, body))!;
      return toKey((res.data ?? {}) as Raw);
    },
    async deleteKey(hash) {
      await call("DELETE", `/keys/${encodeURIComponent(hash)}`, undefined, true);
    },
    async listKeys(input) {
      const all: OpenRouterKey[] = [];
      for (let page = 0; page < MAX_KEY_PAGES; page++) {
        const params = new URLSearchParams({ include_disabled: "true", offset: String(all.length) });
        if (input.workspaceId) params.set("workspace_id", input.workspaceId);
        const res = (await call("GET", `/keys?${params.toString()}`))!;
        const data = Array.isArray(res.data) ? (res.data as Raw[]) : [];
        if (data.length === 0) break;
        all.push(...data.map(toKey));
      }
      return all;
    },
  };
}

/** The public model list (no auth). */
export async function fetchOpenRouterModels(
  opts: { baseUrl?: string; fetch?: typeof fetch } = {},
): Promise<OpenRouterModel[]> {
  const base = (opts.baseUrl ?? OPENROUTER_BASE_URL).replace(/\/+$/, "");
  const res = await (opts.fetch ?? fetch)(`${base}/models`, { method: "GET" });
  if (!res.ok) throw await errorFor(res, "GET", "/models");
  const body = (await res.json()) as { data?: Raw[] };
  return (body.data ?? []).map((m) => {
    const pricing = (m.pricing ?? {}) as Raw;
    const params = Array.isArray(m.supported_parameters) ? m.supported_parameters : [];
    return {
      id: String(m.id ?? ""),
      name: String(m.name ?? m.id ?? ""),
      contextLength: num(m.context_length),
      supportsTools: params.includes("tools"),
      promptUsdPerToken: Number(pricing.prompt ?? 0) || 0,
      completionUsdPerToken: Number(pricing.completion ?? 0) || 0,
    };
  });
}
```

`subgraphs/vetra-llm/__tests__/fake-openrouter.ts`:

```ts
import {
  OpenRouterError,
  type LimitReset,
  type OpenRouterApi,
  type OpenRouterKey,
} from "../openrouter.js";

type Stored = OpenRouterKey & { secret: string; workspaceId: string | null };
type Op = "createKey" | "getKey" | "updateKey" | "deleteKey" | "listKeys";

export interface FakeOpenRouter {
  api: OpenRouterApi;
  keys: Map<string, Stored>;
  /** "createKey:<name>", "updateKey:<hash>:<json>", ... in call order. */
  calls: string[];
  /** The next call of `op` throws OpenRouterError(status). */
  failNext(op: Op, status: number): void;
  /** Put a key on the fake as if created elsewhere; returns its hash. */
  seed(input: { name: string; createdAt: string; workspaceId?: string | null; usageMonthly?: number }): string;
}

export function createFakeOpenRouter(now: () => Date = () => new Date()): FakeOpenRouter {
  const keys = new Map<string, Stored>();
  const calls: string[] = [];
  const failures = new Map<Op, number>();
  let seq = 0;

  const maybeFail = (op: Op) => {
    const status = failures.get(op);
    if (status === undefined) return;
    failures.delete(op);
    throw new OpenRouterError(status, `fake ${op} failed (${status})`);
  };
  const view = (k: Stored): OpenRouterKey => ({
    hash: k.hash,
    name: k.name,
    disabled: k.disabled,
    limit: k.limit,
    limitRemaining: k.limitRemaining,
    limitReset: k.limitReset,
    usage: k.usage,
    usageMonthly: k.usageMonthly,
    createdAt: k.createdAt,
  });
  const mint = (
    name: string,
    limit: number | null,
    limitReset: LimitReset | null,
    workspaceId: string | null,
    createdAt: string,
  ): Stored => {
    seq += 1;
    const k: Stored = {
      hash: `hash-${seq}`,
      name,
      disabled: false,
      limit,
      limitRemaining: limit,
      limitReset,
      usage: 0,
      usageMonthly: 0,
      createdAt,
      secret: `sk-or-v1-fake${seq}`,
      workspaceId,
    };
    keys.set(k.hash, k);
    return k;
  };

  const api: OpenRouterApi = {
    async createKey(input) {
      calls.push(`createKey:${input.name}`);
      maybeFail("createKey");
      const k = mint(input.name, input.limitUsd, input.limitReset, input.workspaceId, now().toISOString());
      return { key: k.secret, data: view(k) };
    },
    async getKey(hash) {
      calls.push(`getKey:${hash}`);
      maybeFail("getKey");
      const k = keys.get(hash);
      return k ? view(k) : null;
    },
    async updateKey(hash, patch) {
      calls.push(`updateKey:${hash}:${JSON.stringify(patch)}`);
      maybeFail("updateKey");
      const k = keys.get(hash);
      if (!k) throw new OpenRouterError(404, "fake: no such key");
      if (patch.limitUsd !== undefined) {
        k.limit = patch.limitUsd;
        k.limitRemaining = patch.limitUsd - k.usageMonthly;
      }
      if (patch.disabled !== undefined) k.disabled = patch.disabled;
      return view(k);
    },
    async deleteKey(hash) {
      calls.push(`deleteKey:${hash}`);
      maybeFail("deleteKey");
      keys.delete(hash);
    },
    async listKeys(input) {
      calls.push(`listKeys:${input.workspaceId ?? "default"}`);
      maybeFail("listKeys");
      return [...keys.values()].filter((k) => k.workspaceId === input.workspaceId).map(view);
    },
  };

  return {
    api,
    keys,
    calls,
    failNext: (op, status) => {
      failures.set(op, status);
    },
    seed: (input) => {
      const k = mint(input.name, null, null, input.workspaceId ?? null, input.createdAt);
      k.usageMonthly = input.usageMonthly ?? 0;
      return k.hash;
    },
  };
}
```

`subgraphs/vetra-licensing/publisher-errors.ts:115-120`: replace the `SECRET_PATTERNS` array with:

```ts
const SECRET_PATTERNS: RegExp[] = [
  /sk-or-[A-Za-z0-9_-]+/g, // OpenRouter keys
  /sk-ant-[A-Za-z0-9_-]+/g, // Claude keys
  /vault:v\d+:[A-Za-z0-9+/=]+/g, // OpenBao transit ciphertexts
  /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, // credentials
  /\b(token|password|secret)=[^\s&]+/gi,
];
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run subgraphs/vetra-llm/__tests__/openrouter.test.ts subgraphs/vetra-licensing/__tests__/publisher-errors.test.ts && pnpm tsc && pnpm lint && pnpm exec oxfmt subgraphs/vetra-llm subgraphs/vetra-licensing/publisher-errors.ts subgraphs/vetra-licensing/__tests__/publisher-errors.test.ts`

Expected: all tests pass, and tsc and oxlint report 0 errors.

- [ ] **Step 5: Commit**

```bash
git add subgraphs/vetra-llm subgraphs/vetra-licensing/publisher-errors.ts subgraphs/vetra-licensing/__tests__/publisher-errors.test.ts
git commit -m "feat(llm): OpenRouter management client, test fake and sk-or- redaction"
```

---

### Task 2: `studio_llm_keys` table and store (vetra-cloud-package)

**Files**

- Create: `subgraphs/vetra-llm/db/schema.ts`
- Create: `subgraphs/vetra-llm/db/migrations.ts`
- Create: `subgraphs/vetra-llm/store.ts`
- Create: `subgraphs/vetra-llm/__tests__/llm-db.ts` (test helper)
- Test: `subgraphs/vetra-llm/__tests__/migrations.test.ts`
- Test: `subgraphs/vetra-llm/__tests__/store.test.ts`

**Interfaces**

- Consumes: `isConcurrentIndexError(err: unknown): boolean` from `subgraphs/vetra-apps/db/migrations.ts:201-204`.
- Produces:
  - `type LlmKeySource = "VETRA" | "BYO"` and `type LlmKeyStatus = "ACTIVE" | "DISABLED" | "DELETED"`
  - `interface StudioLlmKeys { environment_id: string; source: LlmKeySource; key_hash: string | null; key_ciphertext: string | null; limit_usd: number | null; limit_reset: string; model: string; owner_did: string; status: LlmKeyStatus; created_at: string; updated_at: string }`
  - `interface VetraLlmDB { studio_llm_keys: StudioLlmKeys }`
  - `up(db: Kysely<any>): Promise<void>`
  - `type StudioLlmKeysPatch = Partial<Omit<StudioLlmKeys, "environment_id" | "created_at">>`
  - `interface LlmKeyStore { get(environmentId: string): Promise<StudioLlmKeys | null>; upsert(row: StudioLlmKeys): Promise<void>; update(environmentId: string, patch: StudioLlmKeysPatch): Promise<void>; listHeld(): Promise<StudioLlmKeys[]> }`
  - `createLlmKeyStore(db: Kysely<VetraLlmDB>): LlmKeyStore`
  - Test-only: `openLlmDb(): Promise<{ root: Kysely<any>; db: Kysely<VetraLlmDB>; destroy(): Promise<void> }>`

- [ ] **Step 1: Write the failing tests**

`subgraphs/vetra-llm/__tests__/llm-db.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import { Kysely, sql } from "kysely";
import { PGliteDialect } from "kysely-pglite-dialect";
import { up } from "../db/migrations.js";
import type { VetraLlmDB } from "../db/schema.js";

/**
 * The subgraph's db exactly as the switchboard hands it over: a "vetra-llm"
 * schema reached through withSchema, with nothing in public.
 */
export async function openLlmDb(): Promise<{
  root: Kysely<any>;
  db: Kysely<VetraLlmDB>;
  destroy(): Promise<void>;
}> {
  const root = new Kysely<any>({ dialect: new PGliteDialect(new PGlite()) });
  await sql`CREATE SCHEMA "vetra-llm"`.execute(root);
  const db = root.withSchema("vetra-llm") as unknown as Kysely<VetraLlmDB>;
  await up(db as unknown as Kysely<any>);
  return { root, db, destroy: () => root.destroy() };
}
```

`subgraphs/vetra-llm/__tests__/migrations.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { Kysely, sql } from "kysely";
import { PGliteDialect } from "kysely-pglite-dialect";
import { up } from "../db/migrations.js";

describe("vetra-llm migrations", () => {
  it("creates studio_llm_keys inside the namespace schema only, idempotently", async () => {
    const pg = new PGlite();
    const root = new Kysely<any>({ dialect: new PGliteDialect(pg) });
    try {
      await sql`CREATE SCHEMA "vetra-llm"`.execute(root);
      const ns = root.withSchema("vetra-llm");
      await up(ns);
      await up(ns);
      const tables = await pg.query<{ table_schema: string; table_name: string }>(
        `SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'studio_llm_keys'`,
      );
      expect(tables.rows).toStrictEqual([{ table_schema: "vetra-llm", table_name: "studio_llm_keys" }]);
      const publicTables = await pg.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      expect(publicTables.rows).toStrictEqual([]);
    } finally {
      await root.destroy();
    }
  });

  it("survives two boots racing on the same schema", async () => {
    const root = new Kysely<any>({ dialect: new PGliteDialect(new PGlite()) });
    try {
      await sql`CREATE SCHEMA "vetra-llm"`.execute(root);
      const ns = root.withSchema("vetra-llm");
      await Promise.all([up(ns), up(ns)]);
      await expect(up(ns)).resolves.toBeUndefined();
    } finally {
      await root.destroy();
    }
  });
});
```

`subgraphs/vetra-llm/__tests__/store.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";
import type { StudioLlmKeys } from "../db/schema.js";
import { createLlmKeyStore } from "../store.js";
import { openLlmDb } from "./llm-db.js";

let destroy: (() => Promise<void>) | null = null;
afterEach(async () => {
  await destroy?.();
  destroy = null;
});

const row = (over: Partial<StudioLlmKeys> = {}): StudioLlmKeys => ({
  environment_id: "env-1",
  source: "VETRA",
  key_hash: "hash-1",
  key_ciphertext: "vault:v1:abc",
  limit_usd: 20.5,
  limit_reset: "monthly",
  model: "anthropic/claude-sonnet-4.6",
  owner_did: "did:pkh:eip155:1:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  status: "ACTIVE",
  created_at: "2026-10-15T10:00:00.000Z",
  updated_at: "2026-10-15T10:00:00.000Z",
  ...over,
});

describe("LlmKeyStore", () => {
  it("round-trips a row and reads money back as a number, not a numeric string", async () => {
    const h = await openLlmDb();
    destroy = h.destroy;
    const store = createLlmKeyStore(h.db);
    await store.upsert(row());
    const got = await store.get("env-1");
    expect(got).toStrictEqual(row());
    expect(typeof got!.limit_usd).toBe("number");
  });

  it("upserts on environment_id and keeps created_at", async () => {
    const h = await openLlmDb();
    destroy = h.destroy;
    const store = createLlmKeyStore(h.db);
    await store.upsert(row());
    await store.upsert(row({ key_hash: "hash-2", created_at: "2030-01-01T00:00:00.000Z", updated_at: "2026-10-16T00:00:00.000Z" }));
    const got = await store.get("env-1");
    expect(got?.key_hash).toBe("hash-2");
    expect(got?.created_at).toBe("2026-10-15T10:00:00.000Z");
    expect(got?.updated_at).toBe("2026-10-16T00:00:00.000Z");
  });

  it("updates fields and lists only rows that still hold a key", async () => {
    const h = await openLlmDb();
    destroy = h.destroy;
    const store = createLlmKeyStore(h.db);
    await store.upsert(row({ environment_id: "a" }));
    await store.upsert(row({ environment_id: "b", status: "DISABLED" }));
    await store.upsert(row({ environment_id: "c", status: "DELETED", key_ciphertext: null }));
    await store.upsert(row({ environment_id: "d", key_hash: null }));
    await store.update("a", { limit_usd: 7, updated_at: "2026-10-16T00:00:00.000Z" });
    expect((await store.get("a"))?.limit_usd).toBe(7);
    expect((await store.listHeld()).map((r) => r.environment_id).sort()).toStrictEqual(["a", "b"]);
    expect(await store.get("nope")).toBeNull();
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run subgraphs/vetra-llm/__tests__/migrations.test.ts subgraphs/vetra-llm/__tests__/store.test.ts`

Expected: both fail with `Failed to resolve import "../db/migrations.js"`.

- [ ] **Step 3: Implement**

`subgraphs/vetra-llm/db/schema.ts`:

```ts
export type LlmKeySource = "VETRA" | "BYO";
export type LlmKeyStatus = "ACTIVE" | "DISABLED" | "DELETED";

/** One model key per Studio environment (spec "Table studio_llm_keys"). */
export interface StudioLlmKeys {
  environment_id: string;
  source: LlmKeySource;
  /** OpenRouter key hash; VETRA keys only. */
  key_hash: string | null;
  /** The key, OpenBao transit ciphertext (createKeyVault); never logged, never returned. */
  key_ciphertext: string | null;
  /** double precision: read back as a JS number (numeric would be a string). */
  limit_usd: number | null;
  limit_reset: string;
  model: string;
  owner_did: string;
  status: LlmKeyStatus;
  created_at: string;
  updated_at: string;
}

export interface VetraLlmDB {
  studio_llm_keys: StudioLlmKeys;
}
```

`subgraphs/vetra-llm/db/migrations.ts`:

```ts
import type { Kysely } from "kysely";
import { isConcurrentIndexError } from "../../vetra-apps/db/migrations.js";

/**
 * Schema builder only: the switchboard hands the subgraph
 * db.withSchema("vetra-llm"), and only builder table refs are qualified. Also
 * run by vetra-studio-pool at its setup (boot order is not fixed), so two boots
 * may race: a lost race (42P07 / 23505) is fine.
 */
export async function up(db: Kysely<any>): Promise<void> {
  try {
    await db.schema
      .createTable("studio_llm_keys")
      .addColumn("environment_id", "varchar(255)", (c) => c.primaryKey())
      .addColumn("source", "varchar(16)", (c) => c.notNull())
      .addColumn("key_hash", "varchar(128)")
      .addColumn("key_ciphertext", "text")
      .addColumn("limit_usd", "double precision")
      .addColumn("limit_reset", "varchar(16)", (c) => c.notNull().defaultTo("monthly"))
      .addColumn("model", "varchar(255)", (c) => c.notNull())
      .addColumn("owner_did", "varchar(255)", (c) => c.notNull())
      .addColumn("status", "varchar(16)", (c) => c.notNull())
      .addColumn("created_at", "varchar(64)", (c) => c.notNull())
      .addColumn("updated_at", "varchar(64)", (c) => c.notNull())
      .ifNotExists()
      .execute();
  } catch (err) {
    if (!isConcurrentIndexError(err)) throw err;
  }
  try {
    await db.schema
      .createIndex("studio_llm_keys_status_idx")
      .ifNotExists()
      .on("studio_llm_keys")
      .column("status")
      .execute();
  } catch (err) {
    if (!isConcurrentIndexError(err)) throw err;
  }
}
```

`subgraphs/vetra-llm/store.ts`:

```ts
import type { Kysely } from "kysely";
import type { StudioLlmKeys, VetraLlmDB } from "./db/schema.js";

export type StudioLlmKeysPatch = Partial<Omit<StudioLlmKeys, "environment_id" | "created_at">>;

export interface LlmKeyStore {
  get(environmentId: string): Promise<StudioLlmKeys | null>;
  /** Insert, or replace everything but environment_id and created_at. */
  upsert(row: StudioLlmKeys): Promise<void>;
  update(environmentId: string, patch: StudioLlmKeysPatch): Promise<void>;
  /** Rows whose key still exists on OpenRouter: ACTIVE or DISABLED, with a hash. */
  listHeld(): Promise<StudioLlmKeys[]>;
}

export function createLlmKeyStore(db: Kysely<VetraLlmDB>): LlmKeyStore {
  return {
    async get(environmentId) {
      return (
        (await db
          .selectFrom("studio_llm_keys")
          .selectAll()
          .where("environment_id", "=", environmentId)
          .executeTakeFirst()) ?? null
      );
    },
    async upsert(row) {
      const rest = {
        source: row.source,
        key_hash: row.key_hash,
        key_ciphertext: row.key_ciphertext,
        limit_usd: row.limit_usd,
        limit_reset: row.limit_reset,
        model: row.model,
        owner_did: row.owner_did,
        status: row.status,
        updated_at: row.updated_at,
      };
      await db
        .insertInto("studio_llm_keys")
        .values(row)
        .onConflict((oc) => oc.column("environment_id").doUpdateSet(rest))
        .execute();
    },
    async update(environmentId, patch) {
      await db
        .updateTable("studio_llm_keys")
        .set(patch)
        .where("environment_id", "=", environmentId)
        .execute();
    },
    async listHeld() {
      return db
        .selectFrom("studio_llm_keys")
        .selectAll()
        .where("status", "in", ["ACTIVE", "DISABLED"])
        .where("key_hash", "is not", null)
        .orderBy("environment_id")
        .execute();
    },
  };
}
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run subgraphs/vetra-llm && pnpm tsc && pnpm lint && pnpm exec oxfmt subgraphs/vetra-llm`

Expected: the openrouter, migrations and store suites all pass, with 0 tsc and 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add subgraphs/vetra-llm
git commit -m "feat(llm): studio_llm_keys table and key store (namespace-safe)"
```

---
### Task 3: Invite-code LLM budget: column, store and publisher API (vetra-cloud-package)

**Files**

- Create: `shared/llm-budget.ts`
- Modify: `subgraphs/vetra-licensing/db/migrations.ts`:
  - `:33`: the `addColumnIfMissing` type union;
  - after `:199-201`: a new `addColumnIfMissing` call.
- Modify: `subgraphs/vetra-licensing/db/schema.ts:94-95` (`InviteCodes`)
- Modify: `subgraphs/vetra-licensing/invite-codes.ts`:
  - `:29-39`: `InviteCodeView`;
  - `:79-91`: `view`;
  - `:93-104`: the `createInviteCode` input;
  - `:117-130`: the row literal;
  - after `:182`: new functions;
  - after `:326`: `llmBudgetForCode`.
- Modify: `subgraphs/vetra-licensing/publisher-schema.ts`:
  - `:138-148`: `PublisherInviteCode`;
  - `:250-260`: `CreateInviteCodeInput`;
  - after `:295`: a new mutation.
- Modify: `subgraphs/vetra-licensing/publisher-resolvers.ts`:
  - `:31`: the import;
  - `:624-660`: `createInviteCode`;
  - after `:689`: `setInviteCodeLlmBudget`.
- Test: `shared/llm-budget.test.ts`
- Test: `subgraphs/vetra-licensing/__tests__/invite-codes.test.ts`
- Test: `subgraphs/vetra-licensing/__tests__/migrations.test.ts`
- Test: `subgraphs/vetra-licensing/__tests__/publisher-api.test.ts`
- Test: `subgraphs/vetra-licensing/__tests__/publisher-isolation.test.ts:33,117,135`
- Test: `subgraphs/vetra-licensing/__tests__/schema-composition.test.ts:104`

**Interfaces**

- Consumes:
  - `addColumnIfMissing` (`db/migrations.ts:29-49`);
  - `getCode` and `normalizeCode` (`invite-codes.ts`);
  - `owned`, `withCodes` and `UnknownInviteCodeError` (`publisher-resolvers.ts`).
- Produces:
  - `MAX_LLM_BUDGET_USD = 10_000`
  - `isValidLlmBudget(v: number): boolean`
  - `roundUsd(v: number): number`
  - `InviteCodes.llm_budget_usd: number | null`
  - `InviteCodeView.llmBudgetUsd: number | null`
  - The `createInviteCode` input accepts `llmBudgetUsd?: number | null`.
  - `setInviteCodeLlmBudget(db: Kysely<VetraLicensingDB>, appId: string, code: string, llmBudgetUsd: number | null): Promise<boolean>`
  - `llmBudgetForCode(db: Kysely<VetraLicensingDB>, code: string): Promise<number | null>`
  - GraphQL:
    - `PublisherInviteCode.llmBudgetUsd: Float`
    - `CreateInviteCodeInput.llmBudgetUsd: Float`
    - `VetraPublisherMutations.setInviteCodeLlmBudget(appId: String!, code: String!, llmBudgetUsd: Float): Boolean!`

- [ ] **Step 1: Write the failing tests**

`shared/llm-budget.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MAX_LLM_BUDGET_USD, isValidLlmBudget, roundUsd } from "./llm-budget.js";

describe("llm budget values", () => {
  it("accepts 0 up to the cap, rejects the rest", () => {
    expect(MAX_LLM_BUDGET_USD).toBe(10_000);
    for (const ok of [0, 0.01, 20, 10_000]) expect(isValidLlmBudget(ok)).toBe(true);
    for (const bad of [-0.01, 10_000.01, Number.NaN, Number.POSITIVE_INFINITY]) expect(isValidLlmBudget(bad)).toBe(false);
  });

  it("rounds to cents", () => {
    expect(roundUsd(12.346)).toBe(12.35);
    expect(roundUsd(20)).toBe(20);
  });
});
```

Add `llmBudgetForCode` and `setInviteCodeLlmBudget` to the import list in `subgraphs/vetra-licensing/__tests__/invite-codes.test.ts:7-27`. Then append inside `describe("invite codes", ...)`:

```ts
  it("stores the LLM budget as a number, sets and clears it only within the owning app", async () => {
    const d = await open();
    await createInviteCode(d, { ...base, code: "code-bbb1", llmBudgetUsd: 20.5 });
    expect(await llmBudgetForCode(d, "code-bbb1")).toBe(20.5);
    expect(typeof (await llmBudgetForCode(d, "code-bbb1"))).toBe("number");
    expect((await listInviteCodes(d, "app-1")).find((c) => c.code === "code-bbb1")?.llmBudgetUsd).toBe(20.5);
    expect(await setInviteCodeLlmBudget(d, "app-2", "code-bbb1", 5)).toBe(false);
    expect(await setInviteCodeLlmBudget(d, "app-1", "no-such-code", 5)).toBe(false);
    expect(await setInviteCodeLlmBudget(d, "app-1", " code-bbb1 ", 5)).toBe(true);
    expect(await llmBudgetForCode(d, "code-bbb1")).toBe(5);
    expect(await setInviteCodeLlmBudget(d, "app-1", "code-bbb1", null)).toBe(true);
    expect(await llmBudgetForCode(d, "code-bbb1")).toBeNull();
    expect(await llmBudgetForCode(d, "no-such-code")).toBeNull();
  });

  it("defaults the budget to null and refuses a negative, non-finite or over-cap one", async () => {
    const d = await open();
    expect((await createInviteCode(d, { ...base, code: "code-none1" })).llmBudgetUsd).toBeNull();
    expect((await createInviteCode(d, { ...base, code: "code-round", llmBudgetUsd: 12.346 })).llmBudgetUsd).toBe(12.35);
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY, 10_000.01]) {
      await expect(createInviteCode(d, { ...base, code: "code-bad01", llmBudgetUsd: bad })).rejects.toBeInstanceOf(
        InvalidCodeInputError,
      );
      await expect(setInviteCodeLlmBudget(d, "app-1", "code-none1", bad)).rejects.toBeInstanceOf(InvalidCodeInputError);
    }
  });
```

Append inside `describe("vetra-licensing migrations (real PGlite)", ...)` in `subgraphs/vetra-licensing/__tests__/migrations.test.ts` (Review Focus 1 and 5):

```ts
  it("adds invite_codes.llm_budget_usd inside a namespace schema and reads it back as a number", async () => {
    const pg = new PGlite();
    db = new Kysely<VetraLicensingDB>({ dialect: new PGliteDialect(pg) });
    await pg.exec(`CREATE SCHEMA ns_budget`);
    const ns = db.withSchema("ns_budget") as unknown as Kysely<any>;
    await up(ns);
    await up(ns);
    await ns
      .insertInto("invite_codes")
      .values({ code: "code-ns-01", app_id: "a", kind: "k", active: true, created_at: "2026-10-15T00:00:00.000Z", llm_budget_usd: 12.5 })
      .execute();
    const row = await ns
      .selectFrom("invite_codes")
      .select("llm_budget_usd")
      .where("code", "=", "code-ns-01")
      .executeTakeFirstOrThrow();
    expect(row.llm_budget_usd).toBe(12.5);
    const publicTables = await pg.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    expect(publicTables.rows).toStrictEqual([]);
  });
```

Append inside `describe("vetraPublisher end to end", ...)` in `subgraphs/vetra-licensing/__tests__/publisher-api.test.ts`, after the `setInviteCodeAnthropicKey` cases (`:339-383`):

```ts
  it("creates a code with a monthly LLM budget, then sets, changes and clears it", async () => {
    const created = (await m("createInviteCode", {
      input: { appId: APP, kind: "2026-pro", code: "Budget-0001", llmBudgetUsd: 20 },
    })) as { code: string; llmBudgetUsd: number | null };
    expect(created.llmBudgetUsd).toBe(20);
    const budget = async () =>
      ((await q("inviteCodes", { appId: APP })) as { code: string; llmBudgetUsd: number | null }[]).find(
        (x) => x.code === "Budget-0001",
      )?.llmBudgetUsd;
    expect(await m("setInviteCodeLlmBudget", { appId: APP, code: "Budget-0001", llmBudgetUsd: 35.5 })).toBe(true);
    expect(await budget()).toBe(35.5);
    expect(await m("setInviteCodeLlmBudget", { appId: APP, code: " Budget-0001 ", llmBudgetUsd: null })).toBe(true);
    expect(await budget()).toBeNull();
  });

  it("refuses a bad budget, another app's code and a non-owner", async () => {
    await m("createInviteCode", { input: { appId: APP, kind: "2026-pro", code: "Budget-0002" } });
    expect(await codeOf(m("setInviteCodeLlmBudget", { appId: APP, code: "Budget-0002", llmBudgetUsd: -5 }))).toBe(
      "INVALID_INPUT",
    );
    expect(await codeOf(m("setInviteCodeLlmBudget", { appId: HELD, code: "Budget-0002", llmBudgetUsd: 5 }))).toBe(
      "NOT_FOUND",
    );
    const other = r.VetraPublisherMutations.setInviteCodeLlmBudget!(
      {},
      { appId: APP, code: "Budget-0002", llmBudgetUsd: 5 },
      asUser(OTHER),
    );
    expect(await codeOf(other)).toBe("NOT_FOUND");
  });
```

Edits to the other two tests:

- `subgraphs/vetra-licensing/__tests__/publisher-isolation.test.ts`:
  - `:33`: insert `"setInviteCodeLlmBudget",` after `"setInviteCodeAnthropicKey",`.
  - After `:117`: add `["setInviteCodeLlmBudget", "m", (x) => ({ appId: x.app, code: x.code, llmBudgetUsd: 5 })],`.
  - After `:135`: add `["setInviteCodeLlmBudget", "m", (x, own) => ({ appId: own.app, code: x.code, llmBudgetUsd: 5 })],`.
- `subgraphs/vetra-licensing/__tests__/schema-composition.test.ts:104`: after `"setInviteCodeAnthropicKey",` add `"setInviteCodeLlmBudget",`.

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run shared/llm-budget.test.ts subgraphs/vetra-licensing/__tests__/invite-codes.test.ts subgraphs/vetra-licensing/__tests__/migrations.test.ts subgraphs/vetra-licensing/__tests__/publisher-api.test.ts subgraphs/vetra-licensing/__tests__/publisher-isolation.test.ts subgraphs/vetra-licensing/__tests__/schema-composition.test.ts`

Expected:
- `llm-budget.test.ts` fails with `Failed to resolve import "./llm-budget.js"`.
- `invite-codes.test.ts` fails with `llmBudgetForCode is not a function`.
- The migrations case fails with `column "llm_budget_usd" of relation "invite_codes" does not exist`.
- The publisher-api cases fail with `Cannot read properties of undefined (reading 'setInviteCodeLlmBudget')` / `toBe(20)` received `undefined`.
- The isolation and composition tests fail on the missing mutation.

- [ ] **Step 3: Implement**

`shared/llm-budget.ts`:

```ts
/** The largest monthly LLM budget (USD) a code or the deployment default may set. */
export const MAX_LLM_BUDGET_USD = 10_000;

export function isValidLlmBudget(v: number): boolean {
  return Number.isFinite(v) && v >= 0 && v <= MAX_LLM_BUDGET_USD;
}

export function roundUsd(v: number): number {
  return Math.round(v * 100) / 100;
}
```

`subgraphs/vetra-licensing/db/migrations.ts`:

- `:33`: change `type: "varchar(255)" | "text" | "boolean",` to `type: "varchar(255)" | "text" | "boolean" | "double precision",`.
- After the `legacy_case_insensitive` call (`:199-201`), insert:

```ts
  // The monthly LLM budget (USD) a licence redeemed from this code gets for
  // its Studio's OpenRouter key; null = the deployment default. double
  // precision, not numeric: it must read back as a number.
  await addColumnIfMissing(db, "invite_codes", "llm_budget_usd", "double precision");
```

`subgraphs/vetra-licensing/db/schema.ts`: after `anthropic_key_ciphertext: string | null;` (`:95`), insert:

```ts
  /** Monthly LLM budget (USD) for Studios of licences redeemed from this code; null = deployment default. */
  llm_budget_usd: number | null;
```

`subgraphs/vetra-licensing/invite-codes.ts`:

1. Add `import { MAX_LLM_BUDGET_USD, isValidLlmBudget, roundUsd } from "../../shared/llm-budget.js";` to the imports.
2. In `InviteCodeView` (`:29-39`), add `llmBudgetUsd: number | null;` after `hasAnthropicKey: boolean;`.
3. In `view` (`:79-91`), add `llmBudgetUsd: row.llm_budget_usd ?? null,` after the `hasAnthropicKey` line.
4. In the `createInviteCode` input type (`:93-104`), add `llmBudgetUsd?: number | null;` after `anthropicKeyCiphertext: string | null;`.
5. As the first statement of `createInviteCode`'s body, add `const llmBudgetUsd = llmBudgetOf(input.llmBudgetUsd);`. In the row literal (`:117-130`), add `llm_budget_usd: llmBudgetUsd,` after `anthropic_key_ciphertext: input.anthropicKeyCiphertext,`.
6. After `setInviteCodeAnthropicKey` (ends `:182`), insert:

```ts
/** A budget input as stored: null stays null, the rest rounded to cents; out of range is refused. */
function llmBudgetOf(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (!isValidLlmBudget(v)) {
    throw new InvalidCodeInputError(`llmBudgetUsd must be between 0 and ${MAX_LLM_BUDGET_USD}`);
  }
  return roundUsd(v);
}

/**
 * Sets (USD) or clears (null: the deployment default applies) the monthly LLM
 * budget on an existing code. False when the code does not exist or belongs to
 * another app. Licences take their budget from the code they were redeemed
 * from, so this reaches existing holders (the vetra-llm sweeper applies it).
 */
export async function setInviteCodeLlmBudget(
  db: Kysely<VetraLicensingDB>,
  appId: string,
  code: string,
  llmBudgetUsd: number | null,
): Promise<boolean> {
  const budget = llmBudgetOf(llmBudgetUsd);
  const res = await db
    .updateTable("invite_codes")
    .set({ llm_budget_usd: budget })
    .where("code", "=", normalizeCode(code))
    .where("app_id", "=", appId)
    .executeTakeFirst();
  return Number(res.numUpdatedRows) > 0;
}
```

7. After `keyCiphertextForCode` (ends `:326`), insert:

```ts
/** The monthly LLM budget (USD) set on a code; null when unset or the code is unknown. */
export async function llmBudgetForCode(
  db: Kysely<VetraLicensingDB>,
  code: string,
): Promise<number | null> {
  return (await getCode(db, code))?.llm_budget_usd ?? null;
}
```

`subgraphs/vetra-licensing/publisher-schema.ts`:

- In `type PublisherInviteCode` (`:138-148`), add after `hasAnthropicKey: Boolean!`:

```graphql
    "Monthly LLM budget (USD) of Studios redeemed from this code; null = the deployment default."
    llmBudgetUsd: Float
```

- In `input CreateInviteCodeInput` (`:250-260`), add after `anthropicKey: String`:

```graphql
    "Monthly LLM budget (USD) for Studios of licences redeemed from this code; omit for the deployment default."
    llmBudgetUsd: Float
```

- After `:295` (`setInviteCodeAnthropicKey(...)`), add:

```graphql
    setInviteCodeLlmBudget(appId: String!, code: String!, llmBudgetUsd: Float): Boolean!
```

`subgraphs/vetra-licensing/publisher-resolvers.ts`:

- `:31`: change the import to `import { createInviteCode, listInviteCodes, setInviteCodeActive, setInviteCodeAnthropicKey, setInviteCodeLlmBudget } from "./invite-codes.js";`.
- In `createInviteCode` (`:624-660`):
  - add `llmBudgetUsd?: Opt<number>;` to the `In<{...}>` argument type after `anthropicKey?: Opt<string>;`;
  - in the `createInviteCode(deps.codes, {...})` call, add `llmBudgetUsd: a.input.llmBudgetUsd ?? null,` after `anthropicKeyCiphertext,`.
- After the `setInviteCodeAnthropicKey` resolver (ends `:689`), add:

```ts
      setInviteCodeLlmBudget: withCodes(
        async (a: { appId: string; code: string; llmBudgetUsd?: Opt<number> }, ctx) => {
          const appId = await owned(a.appId, ctx, true);
          // Another app's code fails exactly like a missing one.
          if (!(await setInviteCodeLlmBudget(deps.codes, appId, a.code, a.llmBudgetUsd ?? null))) {
            throw new UnknownInviteCodeError();
          }
          return true;
        },
      ),
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run shared subgraphs/vetra-licensing && pnpm tsc && pnpm lint && pnpm exec oxfmt $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard)`

Expected: all of `shared` and `vetra-licensing` pass (including the unchanged `apply-studio-key` and `subscriptions-api`), with 0 tsc and 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add shared/llm-budget.ts shared/llm-budget.test.ts subgraphs/vetra-licensing
git commit -m "feat(licensing): monthly LLM budget on invite codes (llmBudgetUsd, setInviteCodeLlmBudget)"
```

---

### Task 4: Budget resolution through the licence chain (`StudioAccess.llmBudgetUsd`) (vetra-cloud-package)

**Files**

- Modify: `shared/llm-budget.ts` (add `defaultLlmBudgetUsd`)
- Modify: `subgraphs/vetra-licensing/studio-access.ts`:
  - `:12-23`: deps;
  - `:25-30`: `StudioAccess`;
  - `:60-74`: `keyCiphertext`;
  - `:76`: `DENIED`;
  - `:95-106`: `studioAccess`;
  - append `studioLlmBudgetForDid`.
- Modify: `subgraphs/vetra-licensing/studio-access-factory.ts:62-77` (`buildStudioAccessDeps`)
- Modify: `subgraphs/vetra-licensing/subscriptions-schema.ts:51-58` (`type StudioAccess`)
- Test: `shared/llm-budget.test.ts`
- Test: `subgraphs/vetra-licensing/__tests__/studio-access.test.ts`
- Test: `subgraphs/vetra-licensing/__tests__/subscriptions-api.test.ts:403,410-411,446-447`

**Interfaces**

- Consumes:
  - `llmBudgetForCode(db, code)` (Task 3);
  - `isValidLlmBudget` and `roundUsd` (Task 3);
  - `redeemedCode` and `licencesOf` (existing `StudioAccessDeps`).
- Produces:
  - `defaultLlmBudgetUsd(env: Record<string, string | undefined>): number`
  - `StudioAccessDeps.llmBudgetForCode?: (code: string) => Promise<number | null>`
  - `StudioAccessDeps.defaultLlmBudgetUsd?: number`
  - `StudioAccess.llmBudgetUsd: number`
  - `interface StudioLlmBudget { allowed: boolean; budgetUsd: number }`
  - `studioLlmBudgetForDid(deps: StudioAccessDeps, rawDid: string): Promise<StudioLlmBudget>`
  - GraphQL: `StudioAccess.llmBudgetUsd: Float!`

- [ ] **Step 1: Write the failing tests**

Append to `shared/llm-budget.test.ts`. Also add `defaultLlmBudgetUsd` to that file's import from `./llm-budget.js`.

```ts
describe("defaultLlmBudgetUsd", () => {
  it("reads VETRA_LLM_DEFAULT_BUDGET_USD; unset, empty or invalid is 0", () => {
    expect(defaultLlmBudgetUsd({ VETRA_LLM_DEFAULT_BUDGET_USD: "20" })).toBe(20);
    expect(defaultLlmBudgetUsd({ VETRA_LLM_DEFAULT_BUDGET_USD: " 12.346 " })).toBe(12.35);
    for (const raw of [undefined, "", "abc", "-1", "10000.5"]) {
      expect(defaultLlmBudgetUsd({ VETRA_LLM_DEFAULT_BUDGET_USD: raw })).toBe(0);
    }
  });
});
```

Edits to `subgraphs/vetra-licensing/__tests__/studio-access.test.ts`:

1. `:2`: import `studioLlmBudgetForDid` as well: `import { studioAccess, studioKeyForDid, studioLlmBudgetForDid, type StudioAccessDeps } from "../studio-access.js";`.
2. In the `deps` helper (`:18-29`), add after `keyCiphertextForCode: ...`:
   `llmBudgetForCode: async (c) => (c === "budget-30" ? 30 : c === "budget-0" ? 0 : null),`
3. `:31`: `const DENIED = { allowed: false, licenseId: null, expires: null, hasAttachedKey: false, llmBudgetUsd: 0 };`
4. `:37`: add `llmBudgetUsd: 0,` to the expected object.
5. Add `llmBudgetUsd: 0` to the expected objects at `:62` and `:71`.
6. Append:

```ts
describe("studio LLM budget", () => {
  it("takes the budget of the code the usable licence was redeemed from", async () => {
    const d = deps([L("a")], { a: "budget-30" });
    expect(await studioLlmBudgetForDid(d, DID)).toStrictEqual({ allowed: true, budgetUsd: 30 });
    expect((await studioAccess(d, DID)).llmBudgetUsd).toBe(30);
  });

  it("follows the chain: a renewal through a code without a budget keeps the predecessor's", async () => {
    const d = deps([L("a", { status: "REPLACED", replacedBy: "b", endedAt: NOW }), L("b")], { a: "budget-30", b: "no-key" });
    expect(await studioLlmBudgetForDid(d, DID)).toStrictEqual({ allowed: true, budgetUsd: 30 });
  });

  it("an explicit 0 on the code wins over the deployment default (no Vetra key)", async () => {
    const d = deps([L("a")], { a: "budget-0" }, { defaultLlmBudgetUsd: 15 });
    expect(await studioLlmBudgetForDid(d, DID)).toStrictEqual({ allowed: true, budgetUsd: 0 });
  });

  it("falls back to the deployment default, else 0", async () => {
    expect(await studioLlmBudgetForDid(deps([L("a")], { a: "no-key" }, { defaultLlmBudgetUsd: 15 }), DID)).toStrictEqual({
      allowed: true,
      budgetUsd: 15,
    });
    expect(await studioLlmBudgetForDid(deps([L("a")], { a: "no-key" }), DID)).toStrictEqual({ allowed: true, budgetUsd: 0 });
  });

  it("is not allowed, budget 0, without a usable licence or for a non-EVM DID", async () => {
    const lapsed = deps([L("a", { end: "2026-10-07T00:00:00.000Z" })], { a: "budget-30" });
    expect(await studioLlmBudgetForDid(lapsed, DID)).toStrictEqual({ allowed: false, budgetUsd: 0 });
    expect((await studioAccess(lapsed, DID)).llmBudgetUsd).toBe(0);
    expect(await studioLlmBudgetForDid(deps([L("a")], { a: "budget-30" }), "did:key:z6Mk")).toStrictEqual({
      allowed: false,
      budgetUsd: 0,
    });
  });
});
```

In `subgraphs/vetra-licensing/__tests__/subscriptions-api.test.ts`, add `llmBudgetUsd: 0` to the three `toStrictEqual` StudioAccess literals at `:403`, `:410-411` and `:446-447`.

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run shared/llm-budget.test.ts subgraphs/vetra-licensing/__tests__/studio-access.test.ts subgraphs/vetra-licensing/__tests__/subscriptions-api.test.ts`

Expected:
- `defaultLlmBudgetUsd is not a function`;
- `studioLlmBudgetForDid is not a function`;
- the `toStrictEqual` assertions fail because the received object lacks `llmBudgetUsd`.

- [ ] **Step 3: Implement**

Append to `shared/llm-budget.ts`:

```ts
/**
 * VETRA_LLM_DEFAULT_BUDGET_USD (per deployment): the monthly budget of a
 * usable studio licence whose code chain sets none. Unset or invalid: 0, so a
 * deployment that has not opted in provisions no Vetra keys.
 */
export function defaultLlmBudgetUsd(env: Record<string, string | undefined>): number {
  const raw = env.VETRA_LLM_DEFAULT_BUDGET_USD?.trim();
  if (!raw) return 0;
  const n = Number(raw);
  return isValidLlmBudget(n) ? roundUsd(n) : 0;
}
```

`subgraphs/vetra-licensing/studio-access.ts`:

1. In `StudioAccessDeps` (`:12-23`), after `keyCiphertextForCode(...)`, add:

```ts
  /** The monthly LLM budget (USD) set on a code, null when unset. Absent: no code carries a budget. */
  llmBudgetForCode?(code: string): Promise<number | null>;
  /** VETRA_LLM_DEFAULT_BUDGET_USD: the budget when no code in the chain sets one. Absent: 0. */
  defaultLlmBudgetUsd?: number;
```

2. In `StudioAccess` (`:25-30`), add `llmBudgetUsd: number;` after `hasAttachedKey: boolean;`. After the interface, add:

```ts
/** What the vetra-llm broker provisions for a holder: a key only when allowed and budgetUsd > 0. */
export interface StudioLlmBudget {
  allowed: boolean;
  budgetUsd: number;
}
```

3. Replace `keyCiphertext` (`:54-74`, including its comment) with a shared chain walk and the two readers on top of it:

```ts
/**
 * Each usable licence, longest-lasting first, then its chain predecessors (a
 * renewal through a code without a key or budget keeps what the chain started
 * with). A licence that is no longer live and no longer in a live chain never
 * appears.
 */
function* chainLicences(h: Held): Generator<AuthorisedLicence> {
  const predecessorOf = new Map(
    h.all.flatMap((l) => (l.replacedBy ? [[l.replacedBy, l] as const] : [])),
  );
  for (const live of h.usable) {
    const seen = new Set<string>();
    for (let l: AuthorisedLicence | undefined = live; l && !seen.has(l.id); l = predecessorOf.get(l.id)) {
      seen.add(l.id);
      yield l;
    }
  }
}

/** The key behind a usable licence: its own redeemed code's, else one of its chain predecessors'. */
async function keyCiphertext(deps: StudioAccessDeps, did: string, h: Held): Promise<string | null> {
  for (const l of chainLicences(h)) {
    const code = await deps.redeemedCode(l.id, did);
    const ct = code ? await deps.keyCiphertextForCode(code) : null;
    if (ct) return ct;
  }
  return null;
}

/** The monthly LLM budget of usable licences: the first code along the chain that sets one, else the default. */
async function llmBudget(deps: StudioAccessDeps, did: string, h: Held): Promise<number> {
  if (deps.llmBudgetForCode) {
    for (const l of chainLicences(h)) {
      const code = await deps.redeemedCode(l.id, did);
      const budget = code ? await deps.llmBudgetForCode(code) : null;
      if (budget !== null) return budget;
    }
  }
  return deps.defaultLlmBudgetUsd ?? 0;
}
```

4. `:76`: `const DENIED: StudioAccess = { allowed: false, licenseId: null, expires: null, hasAttachedKey: false, llmBudgetUsd: 0 };`
5. In `studioAccess` (`:95-106`):
   - replace the allowed-branch return with `return { allowed: true, licenseId: best.id, expires: best.end, hasAttachedKey: key !== null, llmBudgetUsd: await llmBudget(deps, did, h) };`;
   - replace the final return with `return { allowed: false, licenseId: newest?.id ?? null, expires: newest?.end ?? null, hasAttachedKey: false, llmBudgetUsd: 0 };`.
6. Append:

```ts
/** The monthly LLM budget for a holder's Studio: allowed only with a usable studio licence. */
export async function studioLlmBudgetForDid(deps: StudioAccessDeps, rawDid: string): Promise<StudioLlmBudget> {
  const did = holderOf(rawDid);
  if (did === null) return { allowed: false, budgetUsd: 0 };
  const h = await held(deps, did);
  if (h.usable.length === 0) return { allowed: false, budgetUsd: 0 };
  return { allowed: true, budgetUsd: await llmBudget(deps, did, h) };
}
```

`subgraphs/vetra-licensing/studio-access-factory.ts`:

- Change `:7` to `import { keyCiphertextForCode, llmBudgetForCode, redeemedCodeOf } from "./invite-codes.js";`.
- Add `import { defaultLlmBudgetUsd } from "../../shared/llm-budget.js";`.
- In the object returned by `buildStudioAccessDeps` (`:68-76`), add after `keyCiphertextForCode: ...`:

```ts
    llmBudgetForCode: (code) => llmBudgetForCode(input.db, code),
    defaultLlmBudgetUsd: defaultLlmBudgetUsd(process.env),
```

`subgraphs/vetra-licensing/subscriptions-schema.ts`: in `type StudioAccess`, add after `hasAttachedKey: Boolean!` (`:57`):

```graphql
    "The effective monthly LLM budget (USD) of the usable studio licence, through its code chain or the deployment default; 0 without one (no Vetra key)."
    llmBudgetUsd: Float!
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run shared subgraphs/vetra-licensing subgraphs/vetra-studio-pool && pnpm tsc && pnpm lint && pnpm exec oxfmt $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard)`

Expected: every suite passes. The pre-existing chain-key tests at `studio-access.test.ts:47-58` still pass, which confirms the `chainLicences` refactor kept the key behaviour. tsc and lint report 0 errors.

- [ ] **Step 5: Commit**

```bash
git add shared/llm-budget.ts shared/llm-budget.test.ts subgraphs/vetra-licensing
git commit -m "feat(licensing): resolve the Studio LLM budget through the licence chain (StudioAccess.llmBudgetUsd)"
```

---
### Task 5: Key broker: `provisionVetraKey`, undo, idempotency, `studioLlmUsage` (vetra-cloud-package)

**Files**

- Create: `subgraphs/vetra-llm/config.ts`
- Create: `subgraphs/vetra-llm/errors.ts`
- Create: `subgraphs/vetra-llm/broker.ts`
- Create: `subgraphs/vetra-llm/__tests__/fakes.ts` (test helper)
- Test: `subgraphs/vetra-llm/__tests__/config.test.ts`
- Test: `subgraphs/vetra-llm/__tests__/broker.test.ts`

**Interfaces**

- Consumes:
  - `LlmKeyStore` and `createLlmKeyStore` (Task 2);
  - `OpenRouterApi`, `OpenRouterError` and `OPENROUTER_BASE_URL` (Task 1);
  - `redactSecrets` (Task 1);
  - `StudioLlmBudget` (Task 4);
  - `KeyVault` (`subgraphs/vetra-licensing/key-vault.ts:18-21`);
  - `SecretsService.setSecret` and `SecretsService.setEnvVar` (`subgraphs/vetra-cloud-secrets/services/secrets-service.ts:75-87`);
  - `withKeyLock` (`shared/key-lock.ts:10-20`).
- Produces:
  - `DEFAULT_STUDIO_MODEL = "anthropic/claude-sonnet-4.6"`
  - `interface LlmConfig { managementKey: string | null; workspaceId: string | null; defaultModel: string; baseUrl: string }`
  - `loadLlmConfig(env: Record<string, string | undefined>): LlmConfig`
  - `type LlmErrorCode`
  - `llmError(code: LlmErrorCode, message?: string): GraphQLError`
  - `notConfigured(what: string): GraphQLError`
  - `isNotConfigured(err: unknown): boolean`
  - `toLlmGraphQLError(err: unknown, logger?: Pick<Console, "error">): GraphQLError`
  - Constants: `OPENROUTER_KEY_SECRET = "OPENROUTER_API_KEY"`, `MODEL_VAR = "VETRA_MODEL"`, `KEY_NAME_PREFIX = "studio:"`, `LIMIT_RESET = "monthly"`, `USAGE_CACHE_MS = 60_000`
  - `keyName(envId): string` and `llmLockKey(envId): string`
  - `sameUsd(a: number | null, b: number): boolean`
  - `nextMonthlyReset(now: Date): string`
  - `interface VetraKeyGrant { key: string; model: string; limitUsd: number; created: boolean }`
  - `interface ProvisionResult { connected: boolean; llmBudgetUsd: number }`
  - `interface StudioLlmUsage { source: "VETRA" | "BYO"; model: string; usageUsd: number; limitUsd: number | null; resetsAt: string | null }`
  - `interface BrokerDeps`
  - `interface LlmBroker`:
    - `ensureVetraKey(i: { environmentId: string; ownerDid: string }): Promise<VetraKeyGrant | null>`
    - `provisionVetraKey(i: { environmentId: string; tenantId: string; ownerDid: string }): Promise<ProvisionResult>`
    - `releaseVetraKey(environmentId: string): Promise<void>`
    - `studioLlmUsage(environmentId: string): Promise<StudioLlmUsage | null>`
  - `createLlmBroker(d: BrokerDeps): LlmBroker`
  - Test-only:
    - `createFakeSecrets()`, which returns `{ setSecret, setEnvVar, deleteSecret, listSecretKeys, secret(t, k), envVar(t, k) }`;
    - `fakeKeyVault: KeyVault`;
    - `holderDid(addr?: string): string`.

- [ ] **Step 1: Write the failing tests**

`subgraphs/vetra-llm/__tests__/fakes.ts`:

```ts
import { vi } from "vitest";
import type { KeyVault } from "../../vetra-licensing/key-vault.js";

/** In-memory tenant secrets and env vars with the SecretsService method shapes the broker uses. */
export function createFakeSecrets() {
  const secrets = new Map<string, Map<string, string>>();
  const vars = new Map<string, Map<string, string>>();
  const bag = (m: Map<string, Map<string, string>>, t: string) => {
    let b = m.get(t);
    if (!b) {
      b = new Map();
      m.set(t, b);
    }
    return b;
  };
  return {
    setSecret: vi.fn(async (t: string, k: string, v: string) => {
      bag(secrets, t).set(k, v);
      return { key: k };
    }),
    setEnvVar: vi.fn(async (t: string, k: string, v: string) => {
      bag(vars, t).set(k, v);
      return { key: k, value: v };
    }),
    deleteSecret: vi.fn(async (t: string, k: string) => bag(secrets, t).delete(k)),
    listSecretKeys: vi.fn(async (t: string) => [...bag(secrets, t).keys()].sort().map((key) => ({ key }))),
    secret: (t: string, k: string) => secrets.get(t)?.get(k),
    envVar: (t: string, k: string) => vars.get(t)?.get(k),
  };
}

/** Looks like OpenBao transit output, so redaction tests see a realistic ciphertext. */
export const fakeKeyVault: KeyVault = {
  encrypt: async (p) => `vault:v1:${Buffer.from(p).toString("base64")}`,
  decrypt: async (c) => Buffer.from(c.slice("vault:v1:".length), "base64").toString("utf8"),
};

export const holderDid = (addr = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") => `did:pkh:eip155:1:${addr}`;
```

`subgraphs/vetra-llm/__tests__/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_STUDIO_MODEL, loadLlmConfig } from "../config.js";

describe("loadLlmConfig", () => {
  it("defaults: not configured, no workspace, Sonnet 4.6, the public API", () => {
    expect(loadLlmConfig({})).toStrictEqual({
      managementKey: null,
      workspaceId: null,
      defaultModel: "anthropic/claude-sonnet-4.6",
      baseUrl: "https://openrouter.ai/api/v1",
    });
    expect(DEFAULT_STUDIO_MODEL).toBe("anthropic/claude-sonnet-4.6");
  });

  it("reads the env, trimming, and treats blanks as unset", () => {
    expect(
      loadLlmConfig({
        OPENROUTER_MANAGEMENT_KEY: " mgmt ",
        OPENROUTER_WORKSPACE_ID: "ws-1",
        VETRA_LLM_DEFAULT_MODEL: "openai/gpt-5",
        OPENROUTER_BASE_URL: "http://fake",
      }),
    ).toStrictEqual({ managementKey: "mgmt", workspaceId: "ws-1", defaultModel: "openai/gpt-5", baseUrl: "http://fake" });
    expect(loadLlmConfig({ OPENROUTER_MANAGEMENT_KEY: "  " }).managementKey).toBeNull();
  });
});
```

`subgraphs/vetra-llm/__tests__/broker.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { GraphQLError } from "graphql";
import type { StudioLlmBudget } from "../../vetra-licensing/studio-access.js";
import {
  createLlmBroker,
  MODEL_VAR,
  nextMonthlyReset,
  OPENROUTER_KEY_SECRET,
  type BrokerDeps,
  type LlmBroker,
} from "../broker.js";
import { DEFAULT_STUDIO_MODEL } from "../config.js";
import { isNotConfigured, toLlmGraphQLError } from "../errors.js";
import { OpenRouterError } from "../openrouter.js";
import { createLlmKeyStore } from "../store.js";
import { createFakeOpenRouter } from "./fake-openrouter.js";
import { createFakeSecrets, fakeKeyVault, holderDid } from "./fakes.js";
import { openLlmDb } from "./llm-db.js";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const ENV = "env-1";
const TENANT = "warm-newt-75-aa726a95";

let destroy: (() => Promise<void>) | null = null;
afterEach(async () => {
  await destroy?.();
  destroy = null;
});

async function setup(budget: StudioLlmBudget = { allowed: true, budgetUsd: 20 }, over: Partial<BrokerDeps> = {}) {
  const h = await openLlmDb();
  destroy = h.destroy;
  const fake = createFakeOpenRouter(() => NOW);
  const secrets = createFakeSecrets();
  const logs: string[] = [];
  const logger = {
    info: (m: string) => void logs.push(m),
    warn: (m: string) => void logs.push(m),
    error: (m: string) => void logs.push(m),
  };
  const budgetForDid = vi.fn(async (_did: string) => budget);
  const store = createLlmKeyStore(h.db);
  const broker = createLlmBroker({
    store,
    openrouter: fake.api,
    keyVault: fakeKeyVault,
    secrets,
    budgetForDid,
    cfg: { defaultModel: DEFAULT_STUDIO_MODEL, workspaceId: "ws-staging" },
    now: () => NOW,
    logger,
    ...over,
  });
  return { fake, secrets, logs, budgetForDid, store, broker };
}

const provision = (b: LlmBroker) =>
  b.provisionVetraKey({ environmentId: ENV, tenantId: TENANT, ownerDid: holderDid() });

describe("provisionVetraKey", () => {
  it("creates a monthly-capped studio:<env> key, stores hash + ciphertext, writes OPENROUTER_API_KEY and VETRA_MODEL", async () => {
    const s = await setup();
    expect(await provision(s.broker)).toStrictEqual({ connected: true, llmBudgetUsd: 20 });
    const [key] = [...s.fake.keys.values()];
    expect(key).toMatchObject({ name: `studio:${ENV}`, limit: 20, limitReset: "monthly", workspaceId: "ws-staging" });
    const row = await s.store.get(ENV);
    expect(row).toMatchObject({ source: "VETRA", key_hash: key.hash, limit_usd: 20, status: "ACTIVE", model: DEFAULT_STUDIO_MODEL });
    expect(row!.key_ciphertext).not.toContain(key.secret);
    expect(await fakeKeyVault.decrypt(row!.key_ciphertext!)).toBe(key.secret);
    // Review Focus 2: exactly the name the agent reads.
    expect(OPENROUTER_KEY_SECRET).toBe("OPENROUTER_API_KEY");
    expect(MODEL_VAR).toBe("VETRA_MODEL");
    expect(s.secrets.secret(TENANT, "OPENROUTER_API_KEY")).toBe(key.secret);
    expect(s.secrets.envVar(TENANT, "VETRA_MODEL")).toBe(DEFAULT_STUDIO_MODEL);
  });

  it("is idempotent per env: a second provision reuses the key and rewrites it", async () => {
    const s = await setup();
    await provision(s.broker);
    await provision(s.broker);
    expect(s.fake.calls.filter((c) => c.startsWith("createKey"))).toHaveLength(1);
    expect(s.secrets.setSecret).toHaveBeenCalledTimes(2);
  });

  it("mints exactly one key when two provisions race for the same env (Review Focus 4)", async () => {
    const s = await setup();
    await Promise.all([provision(s.broker), provision(s.broker), provision(s.broker)]);
    expect(s.fake.keys.size).toBe(1);
    expect(s.fake.calls.filter((c) => c.startsWith("createKey"))).toHaveLength(1);
  });

  it("undoes the key when the secret write fails, and rethrows", async () => {
    const s = await setup();
    s.secrets.setSecret.mockRejectedValueOnce(new Error("secrets down"));
    await expect(provision(s.broker)).rejects.toThrow("secrets down");
    expect(s.fake.keys.size).toBe(0);
    expect(s.fake.calls.some((c) => c.startsWith("deleteKey:"))).toBe(true);
    expect((await s.store.get(ENV))?.status).toBe("DELETED");
  });

  it("undoes the key when storing the row fails", async () => {
    const s = await setup(undefined, {
      keyVault: { encrypt: async () => Promise.reject(new Error("transit down")), decrypt: fakeKeyVault.decrypt },
    });
    await expect(provision(s.broker)).rejects.toThrow("transit down");
    expect(s.fake.keys.size).toBe(0);
    expect(await s.store.get(ENV)).toBeNull();
  });

  it("keeps a pre-existing key when only the secret write fails", async () => {
    const s = await setup();
    await provision(s.broker);
    s.secrets.setSecret.mockRejectedValueOnce(new Error("secrets down"));
    await expect(provision(s.broker)).rejects.toThrow("secrets down");
    expect(s.fake.keys.size).toBe(1);
    expect((await s.store.get(ENV))?.status).toBe("ACTIVE");
  });

  it("budget 0 or no licence: no key, not connected; an existing key is disabled", async () => {
    const s = await setup({ allowed: true, budgetUsd: 0 });
    expect(await provision(s.broker)).toStrictEqual({ connected: false, llmBudgetUsd: 0 });
    expect(s.fake.keys.size).toBe(0);
    expect(s.secrets.setSecret).not.toHaveBeenCalled();

    s.budgetForDid.mockResolvedValue({ allowed: true, budgetUsd: 10 });
    await provision(s.broker);
    s.budgetForDid.mockResolvedValue({ allowed: false, budgetUsd: 0 });
    expect(await provision(s.broker)).toStrictEqual({ connected: false, llmBudgetUsd: 0 });
    expect([...s.fake.keys.values()][0].disabled).toBe(true);
    expect((await s.store.get(ENV))?.status).toBe("DISABLED");
  });

  it("re-enables a disabled key and applies a changed budget", async () => {
    const s = await setup();
    await provision(s.broker);
    s.budgetForDid.mockResolvedValue({ allowed: false, budgetUsd: 0 });
    await provision(s.broker);
    s.budgetForDid.mockResolvedValue({ allowed: true, budgetUsd: 35 });
    expect(await provision(s.broker)).toStrictEqual({ connected: true, llmBudgetUsd: 35 });
    expect([...s.fake.keys.values()][0]).toMatchObject({ disabled: false, limit: 35 });
    expect(await s.store.get(ENV)).toMatchObject({ status: "ACTIVE", limit_usd: 35 });
  });

  it("mints a fresh key when the stored one was deleted on OpenRouter", async () => {
    const s = await setup();
    await provision(s.broker);
    s.fake.keys.clear();
    s.budgetForDid.mockResolvedValue({ allowed: true, budgetUsd: 25 });
    expect(await provision(s.broker)).toStrictEqual({ connected: true, llmBudgetUsd: 25 });
    expect(s.fake.keys.size).toBe(1);
  });

  it("refuses with SERVICE_NOT_CONFIGURED without a management key or key storage", async () => {
    const s1 = await setup(undefined, { openrouter: null });
    const e1 = await provision(s1.broker).catch((e: unknown) => e);
    expect(isNotConfigured(e1)).toBe(true);
    await destroy?.();
    const s2 = await setup(undefined, { keyVault: null });
    expect(isNotConfigured(await provision(s2.broker).catch((e: unknown) => e))).toBe(true);
  });

  it("never logs a key or ciphertext", async () => {
    const s = await setup();
    await provision(s.broker);
    s.secrets.setSecret.mockRejectedValueOnce(new Error("secrets down"));
    s.fake.failNext("updateKey", 500);
    s.budgetForDid.mockResolvedValue({ allowed: true, budgetUsd: 99 });
    await provision(s.broker).catch(() => undefined);
    for (const line of s.logs) {
      expect(line).not.toMatch(/sk-or-/);
      expect(line).not.toMatch(/vault:v\d+:/);
    }
  });
});

describe("releaseVetraKey", () => {
  it("deletes the key and marks the row DELETED; a second release is a no-op", async () => {
    const s = await setup();
    await provision(s.broker);
    await s.broker.releaseVetraKey(ENV);
    await s.broker.releaseVetraKey(ENV);
    expect(s.fake.keys.size).toBe(0);
    expect(await s.store.get(ENV)).toMatchObject({ status: "DELETED", key_ciphertext: null });
    expect(s.fake.calls.filter((c) => c.startsWith("deleteKey"))).toHaveLength(1);
  });
});

describe("studioLlmUsage", () => {
  it("reports this month's usage and the reset date, cached for 60 seconds", async () => {
    const s = await setup();
    await provision(s.broker);
    [...s.fake.keys.values()][0].usageMonthly = 3.2;
    expect(await s.broker.studioLlmUsage(ENV)).toStrictEqual({
      source: "VETRA",
      model: DEFAULT_STUDIO_MODEL,
      usageUsd: 3.2,
      limitUsd: 20,
      resetsAt: "2026-11-01T00:00:00.000Z",
    });
    await s.broker.studioLlmUsage(ENV);
    expect(s.fake.calls.filter((c) => c.startsWith("getKey"))).toHaveLength(1);
    expect(await s.broker.studioLlmUsage("no-such-env")).toBeNull();
  });

  it("computes the next monthly reset across a year end", () => {
    expect(nextMonthlyReset(new Date("2026-12-31T23:59:00.000Z"))).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("toLlmGraphQLError", () => {
  it("passes GraphQL errors through, maps OpenRouter errors to UPSTREAM_ERROR and hides the rest", () => {
    const logger = { error: vi.fn() };
    const g = new GraphQLError("x", { extensions: { code: "FORBIDDEN" } });
    expect(toLlmGraphQLError(g, logger)).toBe(g);
    const up = toLlmGraphQLError(new OpenRouterError(502, "bad gateway sk-or-v1-x"), logger);
    expect(up.extensions.code).toBe("UPSTREAM_ERROR");
    expect(up.message).toBe("OpenRouter request failed (502)");
    const internal = toLlmGraphQLError(new Error("pg said vault:v1:abc="), logger);
    expect(internal.extensions.code).toBe("INTERNAL");
    expect(internal.message).toBe("Internal error");
    for (const [line] of logger.error.mock.calls) expect(String(line)).not.toMatch(/sk-or-|vault:v1:/);
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run subgraphs/vetra-llm/__tests__/config.test.ts subgraphs/vetra-llm/__tests__/broker.test.ts`

Expected: both fail with `Failed to resolve import "../config.js"` / `"../broker.js"`.

- [ ] **Step 3: Implement**

`subgraphs/vetra-llm/config.ts`:

```ts
import { OPENROUTER_BASE_URL } from "./openrouter.js";

/** Verified against GET https://openrouter.ai/api/v1/models on 2026-10-15. */
export const DEFAULT_STUDIO_MODEL = "anthropic/claude-sonnet-4.6";

/**
 * vetra-llm configuration, read once at setup. Without a management key the
 * broker refuses with SERVICE_NOT_CONFIGURED; nothing else breaks.
 */
export interface LlmConfig {
  /** OPENROUTER_MANAGEMENT_KEY (OpenBao via ExternalSecret). */
  managementKey: string | null;
  /**
   * OPENROUTER_WORKSPACE_ID: the workspace this deployment's keys live in.
   * Required for the orphan sweep (staging and prod share one organisation).
   */
  workspaceId: string | null;
  /** VETRA_LLM_DEFAULT_MODEL: the model a new Studio key starts with. */
  defaultModel: string;
  /** OPENROUTER_BASE_URL: tests and local fakes only. */
  baseUrl: string;
}

export function loadLlmConfig(env: Record<string, string | undefined>): LlmConfig {
  const s = (k: string) => env[k]?.trim() || null;
  return {
    managementKey: s("OPENROUTER_MANAGEMENT_KEY"),
    workspaceId: s("OPENROUTER_WORKSPACE_ID"),
    defaultModel: s("VETRA_LLM_DEFAULT_MODEL") ?? DEFAULT_STUDIO_MODEL,
    baseUrl: s("OPENROUTER_BASE_URL") ?? OPENROUTER_BASE_URL,
  };
}
```

`subgraphs/vetra-llm/errors.ts`:

```ts
import { GraphQLError } from "graphql";
import { OpenRouterError } from "./openrouter.js";
import { redactSecrets } from "./redact.js";

export type LlmErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "BAD_USER_INPUT"
  | "SERVICE_NOT_CONFIGURED"
  | "UPSTREAM_ERROR"
  | "INTERNAL";

/** GraphQL error with the code in `extensions.code`. */
export function llmError(code: LlmErrorCode, message?: string): GraphQLError {
  return new GraphQLError(message ?? code, { extensions: { code } });
}

export function notConfigured(what: string): GraphQLError {
  return llmError("SERVICE_NOT_CONFIGURED", `${what} is not configured`);
}

export function isNotConfigured(err: unknown): boolean {
  return err instanceof GraphQLError && err.extensions.code === "SERVICE_NOT_CONFIGURED";
}

/** Clean client errors; the detail goes to the log, redacted, never to the client. */
export function toLlmGraphQLError(err: unknown, logger: Pick<Console, "error"> = console): GraphQLError {
  if (err instanceof GraphQLError) return err;
  if (err instanceof OpenRouterError) {
    logger.error(`[vetra-llm] ${redactSecrets(err.message)}`);
    return llmError("UPSTREAM_ERROR", `OpenRouter request failed (${err.status})`);
  }
  const text = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  logger.error(`[vetra-llm] internal error: ${redactSecrets(text)}`);
  return llmError("INTERNAL", "Internal error");
}
```

`subgraphs/vetra-llm/broker.ts`:

```ts
import { withKeyLock } from "../../shared/key-lock.js";
import type { SecretsService } from "../vetra-cloud-secrets/services/secrets-service.js";
import type { KeyVault } from "../vetra-licensing/key-vault.js";
import type { StudioLlmBudget } from "../vetra-licensing/studio-access.js";
import type { LlmConfig } from "./config.js";
import { notConfigured } from "./errors.js";
import { OpenRouterError, type OpenRouterApi } from "./openrouter.js";
import { redactSecrets } from "./redact.js";
import type { LlmKeyStore } from "./store.js";

/** The tenant secret the agent reads (vetra-cli llm.ts resolveOpenRouterKey). */
export const OPENROUTER_KEY_SECRET = "OPENROUTER_API_KEY";
/** The tenant env var the agent reads as its main model (ph-clint: VETRA_ + model). */
export const MODEL_VAR = "VETRA_MODEL";
export const KEY_NAME_PREFIX = "studio:";
/** Verified enum (daily | weekly | monthly | null) in https://openrouter.ai/openapi.yaml. */
export const LIMIT_RESET = "monthly" as const;
export const USAGE_CACHE_MS = 60_000;

export const keyName = (environmentId: string): string => `${KEY_NAME_PREFIX}${environmentId}`;
/** The per-env lock every key mutation (broker and sweeper) takes. */
export const llmLockKey = (environmentId: string): string => `llm:${environmentId}`;

/** Budgets are cents; doubles compare within half a cent. */
export const sameUsd = (a: number | null, b: number): boolean => a !== null && Math.abs(a - b) < 0.005;

/** OpenRouter resets monthly limits at midnight UTC on the 1st. */
export function nextMonthlyReset(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
}

export interface VetraKeyGrant {
  key: string;
  model: string;
  limitUsd: number;
  /** True when this call minted the key (an undo deletes it). */
  created: boolean;
}

export interface ProvisionResult {
  connected: boolean;
  llmBudgetUsd: number;
}

export interface StudioLlmUsage {
  source: "VETRA" | "BYO";
  model: string;
  usageUsd: number;
  limitUsd: number | null;
  resetsAt: string | null;
}

export interface BrokerDeps {
  store: LlmKeyStore;
  /** Null without OPENROUTER_MANAGEMENT_KEY. */
  openrouter: OpenRouterApi | null;
  /** Null without OPENBAO_ADDR. */
  keyVault: KeyVault | null;
  secrets: Pick<SecretsService, "setSecret" | "setEnvVar"> | null;
  /** The holder's licence gate and effective monthly budget (studioLlmBudgetForDid). */
  budgetForDid(did: string): Promise<StudioLlmBudget>;
  cfg: Pick<LlmConfig, "defaultModel" | "workspaceId">;
  now(): Date;
  logger: Pick<Console, "info" | "warn" | "error">;
}

export interface LlmBroker {
  /**
   * The env's Vetra key, created or reused, limited to the holder's budget.
   * Null (and an existing key disabled) when the licence is not usable or its
   * budget is 0. Writes no tenant secret: the pool claim batches it.
   */
  ensureVetraKey(input: { environmentId: string; ownerDid: string }): Promise<VetraKeyGrant | null>;
  /** ensureVetraKey + OPENROUTER_API_KEY / VETRA_MODEL into the tenant; a key minted here is deleted when the write fails. */
  provisionVetraKey(input: { environmentId: string; tenantId: string; ownerDid: string }): Promise<ProvisionResult>;
  /** Delete the env's key on OpenRouter and mark its row DELETED. Idempotent. */
  releaseVetraKey(environmentId: string): Promise<void>;
  /** This month's spend against the limit; null without a key. Cached 60 s. */
  studioLlmUsage(environmentId: string): Promise<StudioLlmUsage | null>;
}

export function createLlmBroker(d: BrokerDeps): LlmBroker {
  const configured = () => {
    if (!d.openrouter) throw notConfigured("OpenRouter (OPENROUTER_MANAGEMENT_KEY)");
    if (!d.keyVault) throw notConfigured("key storage (OPENBAO_ADDR)");
    return { openrouter: d.openrouter, keyVault: d.keyVault };
  };

  const deleteQuietly = async (hash: string) => {
    try {
      await d.openrouter?.deleteKey(hash);
    } catch (err) {
      d.logger.error(`[vetra-llm] undo: could not delete key ${hash}: ${redactSecrets(String(err))}`);
    }
  };

  async function ensureLocked(input: { environmentId: string; ownerDid: string }): Promise<VetraKeyGrant | null> {
    const { openrouter, keyVault } = configured();
    const budget = await d.budgetForDid(input.ownerDid);
    const row = await d.store.get(input.environmentId);
    const now = d.now().toISOString();
    const held = row && row.status !== "DELETED" && row.key_hash && row.key_ciphertext ? row : null;

    if (!budget.allowed || budget.budgetUsd <= 0) {
      if (held && held.status === "ACTIVE") {
        await openrouter.updateKey(held.key_hash!, { disabled: true });
        await d.store.update(input.environmentId, { status: "DISABLED", updated_at: now });
      }
      return null;
    }

    if (held) {
      try {
        if (held.status !== "ACTIVE" || !sameUsd(held.limit_usd, budget.budgetUsd)) {
          await openrouter.updateKey(held.key_hash!, { limitUsd: budget.budgetUsd, disabled: false });
        }
        await d.store.update(input.environmentId, {
          status: "ACTIVE",
          limit_usd: budget.budgetUsd,
          owner_did: input.ownerDid,
          updated_at: now,
        });
        return {
          key: await keyVault.decrypt(held.key_ciphertext!),
          model: held.model,
          limitUsd: budget.budgetUsd,
          created: false,
        };
      } catch (err) {
        // Deleted on OpenRouter behind our back: mint a fresh one below.
        if (!(err instanceof OpenRouterError && err.status === 404)) throw err;
        d.logger.warn(`[vetra-llm] key of ${input.environmentId} is gone on OpenRouter; creating a new one`);
      }
    }

    const created = await openrouter.createKey({
      name: keyName(input.environmentId),
      limitUsd: budget.budgetUsd,
      limitReset: LIMIT_RESET,
      workspaceId: d.cfg.workspaceId,
    });
    const model = row?.model ?? d.cfg.defaultModel;
    try {
      await d.store.upsert({
        environment_id: input.environmentId,
        source: "VETRA",
        key_hash: created.data.hash,
        key_ciphertext: await keyVault.encrypt(created.key),
        limit_usd: budget.budgetUsd,
        limit_reset: LIMIT_RESET,
        model,
        owner_did: input.ownerDid,
        status: "ACTIVE",
        created_at: row?.created_at ?? now,
        updated_at: now,
      });
    } catch (err) {
      await deleteQuietly(created.data.hash);
      throw err;
    }
    d.logger.info(
      `[vetra-llm] created key ${created.data.hash} for ${input.environmentId} (limit $${budget.budgetUsd}/month)`,
    );
    return { key: created.key, model, limitUsd: budget.budgetUsd, created: true };
  }

  async function releaseLocked(environmentId: string): Promise<void> {
    const row = await d.store.get(environmentId);
    if (!row || row.status === "DELETED") return;
    if (row.key_hash) await configured().openrouter.deleteKey(row.key_hash);
    await d.store.update(environmentId, {
      status: "DELETED",
      key_ciphertext: null,
      updated_at: d.now().toISOString(),
    });
  }

  const usageCache = new Map<string, { at: number; value: StudioLlmUsage | null }>();

  return {
    ensureVetraKey: (input) => withKeyLock(llmLockKey(input.environmentId), () => ensureLocked(input)),

    provisionVetraKey: (input) =>
      withKeyLock(llmLockKey(input.environmentId), async () => {
        if (!d.secrets) throw notConfigured("tenant secrets (OPENBAO_ADDR)");
        const grant = await ensureLocked(input);
        if (!grant) return { connected: false, llmBudgetUsd: 0 };
        try {
          await d.secrets.setSecret(input.tenantId, OPENROUTER_KEY_SECRET, grant.key);
          await d.secrets.setEnvVar(input.tenantId, MODEL_VAR, grant.model);
        } catch (err) {
          if (grant.created) await releaseLocked(input.environmentId).catch(() => undefined);
          throw err;
        }
        return { connected: true, llmBudgetUsd: grant.limitUsd };
      }),

    releaseVetraKey: (environmentId) => withKeyLock(llmLockKey(environmentId), () => releaseLocked(environmentId)),

    async studioLlmUsage(environmentId) {
      const nowMs = d.now().getTime();
      const hit = usageCache.get(environmentId);
      if (hit && nowMs - hit.at < USAGE_CACHE_MS) return hit.value;
      const row = await d.store.get(environmentId);
      let value: StudioLlmUsage | null = null;
      if (row && row.status !== "DELETED" && row.key_hash) {
        const key = await configured().openrouter.getKey(row.key_hash);
        value = {
          source: row.source,
          model: row.model,
          usageUsd: key?.usageMonthly ?? 0,
          limitUsd: key?.limit ?? row.limit_usd,
          resetsAt: row.limit_reset === LIMIT_RESET ? nextMonthlyReset(d.now()) : null,
        };
      }
      usageCache.set(environmentId, { at: nowMs, value });
      return value;
    },
  };
}
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run subgraphs/vetra-llm && pnpm tsc && pnpm lint && pnpm exec oxfmt subgraphs/vetra-llm`

Expected: every `vetra-llm` suite passes, including the race test (one `createKey`), with 0 tsc and 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add subgraphs/vetra-llm
git commit -m "feat(llm): key broker with per-env lock, undo on secret failure and cached usage"
```

---
### Task 6: The `vetra-llm` subgraph: schema, `provisionStudioLlm`, `studioLlmStatus`, `studioLlmUsage`, registration (vetra-cloud-package)

**Files**

- Create: `shared/tenant-owners.ts`
- Modify: `subgraphs/vetra-licensing/subscriptions-resolvers.ts`:
  - `:90`: drop `UNDEFINED_TABLE`;
  - `:174-199`: use the shared check;
  - imports `:1-2`.
- Modify: `shared/studio-package.ts` (add `isStudioState`)
- Create: `subgraphs/vetra-llm/schema.ts`
- Create: `subgraphs/vetra-llm/resolvers.ts`
- Create: `subgraphs/vetra-llm/factory.ts`
- Create: `subgraphs/vetra-llm/index.ts`
- Modify: `subgraphs/index.ts:7` (append an export)
- Modify: `powerhouse.manifest.json:74-77` (the `subgraphs` array)
- Test: `shared/tenant-owners.test.ts`
- Test: `shared/studio-package.test.ts`
- Test: `subgraphs/vetra-llm/__tests__/resolvers.test.ts`
- Regression: `subgraphs/vetra-licensing/__tests__/apply-studio-key.test.ts` (unchanged, must stay green)

**Interfaces**

- Consumes:
  - `createProjectionWait` and `ProjectionWaitOptions` (`shared/projection-wait.ts:16-58`);
  - `isStudioAgentPackage` (`shared/studio-package.ts:8`);
  - `EnvAccess`, `EnvAccessRow` and `createEnvAccess` (`subgraphs/vetra-cloud-observability/env-access.ts:11-81`);
  - `callerIsAdmin` (`shared/admins.ts:10`);
  - `didForAddress` (`subgraphs/vetra-licensing/did.ts:25`);
  - `createStudioAccessDeps` and `appsTrustedIds` (`subgraphs/vetra-licensing/studio-access-factory.ts:21,80`);
  - `studioLlmBudgetForDid` (Task 4);
  - `createReactorEnvGateway` (`subgraphs/vetra-apps/envs.ts:22,125`);
  - `createSecretsService` (`subgraphs/vetra-cloud-secrets/services/secrets-service.ts`);
  - `createLlmBroker`, `OPENROUTER_KEY_SECRET`, `toLlmGraphQLError`, `llmError` and `notConfigured` (Task 5);
  - `up` (Task 2);
  - `OpenBaoTransitClient` (`subgraphs/vetra-cloud-secrets/openbao-transit.ts`).
- Produces:
  - `type TenantOwnersResult = { ok: true; owners: (string | null)[] } | { ok: false; reason: "UNVERIFIABLE" | "BUSY" | "UNKNOWN" }`
  - `createTenantOwnersCheck(lookup: (tenantId: string) => Promise<(string | null)[]>, wait: ProjectionWaitOptions, logPrefix: string): (tenantId: string) => Promise<TenantOwnersResult>`
  - `isStudioState(state: { packages: ReadonlyArray<{ name: string }> } | null | undefined): boolean`
  - `transitFromEnv(env): OpenBaoTransitClient | null`
  - `createProcessBroker(input: { db; transit; secrets; studio; env }): { broker: LlmBroker; cfg: LlmConfig; openrouter: OpenRouterApi | null; keyVault: KeyVault | null }`
  - `interface LlmResolverDeps { broker; tenantOwners; envIdsByTenant; envRow; envState; access; secrets; logger }`
  - `createLlmResolvers(deps: LlmResolverDeps): Record<string, unknown>`
  - `class VetraLlmSubgraph extends BaseSubgraph` (name `"vetra-llm"`)
  - GraphQL (`vetraLlm` namespace):
    - Query: `studioLlmStatus(environmentId: String!): StudioLlmStatus!` and `studioLlmUsage(environmentId: String!): StudioLlmUsage`;
    - Mutation: `provisionStudioLlm(tenantId: String!): StudioLlmProvision!`.

- [ ] **Step 1: Write the failing tests**

`shared/tenant-owners.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { createTenantOwnersCheck } from "./tenant-owners.js";

const WAIT = { timeoutMs: 20, intervalMs: 5 };

describe("createTenantOwnersCheck", () => {
  it("returns the projected owners", async () => {
    const check = createTenantOwnersCheck(async () => ["0xaa", null], WAIT, "[t]");
    expect(await check("t1")).toStrictEqual({ ok: true, owners: ["0xaa", null] });
  });

  it("waits, then reports an unknown tenant", async () => {
    const lookup = vi.fn(async () => [] as (string | null)[]);
    const check = createTenantOwnersCheck(lookup, WAIT, "[t]");
    expect(await check("t1")).toStrictEqual({ ok: false, reason: "UNKNOWN" });
    expect(lookup.mock.calls.length).toBeGreaterThan(1);
  });

  it("fails closed when the projection table is missing (42P01), and logs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const check = createTenantOwnersCheck(async () => Promise.reject(Object.assign(new Error("x"), { code: "42P01" })), WAIT, "[t] probe");
    expect(await check("t1")).toStrictEqual({ ok: false, reason: "UNVERIFIABLE" });
    expect(error).toHaveBeenCalledWith("[t] probe: tenant projection unreadable (42P01)");
    error.mockRestore();
  });

  it("is BUSY when every waiter slot is taken, and rethrows other errors", async () => {
    const busy = createTenantOwnersCheck(async () => [], { ...WAIT, maxWaiters: 0 }, "[t]");
    expect(await busy("t1")).toStrictEqual({ ok: false, reason: "BUSY" });
    const broken = createTenantOwnersCheck(async () => Promise.reject(new Error("boom")), WAIT, "[t]");
    await expect(broken("t1")).rejects.toThrow("boom");
  });
});
```

`shared/studio-package.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isStudioState } from "./studio-package.js";

describe("isStudioState", () => {
  it("is true when a package is the studio agent (either name)", () => {
    expect(isStudioState({ packages: [{ name: "vetra" }] })).toBe(true);
    expect(isStudioState({ packages: [{ name: "x" }, { name: "vetra-cli" }] })).toBe(true);
  });
  it("is false otherwise", () => {
    expect(isStudioState({ packages: [{ name: "@powerhousedao/vetra" }] })).toBe(false);
    expect(isStudioState({ packages: [] })).toBe(false);
    expect(isStudioState(null)).toBe(false);
  });
});
```

`subgraphs/vetra-llm/__tests__/resolvers.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { OWNER_ONLY_ACCESS } from "../../vetra-cloud-observability/env-access.js";
import type { TenantOwnersResult } from "../../../shared/tenant-owners.js";
import { createLlmBroker } from "../broker.js";
import { DEFAULT_STUDIO_MODEL } from "../config.js";
import { createLlmResolvers, type LlmResolverDeps } from "../resolvers.js";
import { createLlmKeyStore } from "../store.js";
import { createFakeOpenRouter } from "./fake-openrouter.js";
import { createFakeSecrets, fakeKeyVault } from "./fakes.js";
import { openLlmDb } from "./llm-db.js";

const OWNER = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const STRANGER = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TENANT = "warm-newt-75-aa726a95";
const ENV = "aa726a95-1111-2222-3333-444455556666";
const STUDIO = { packages: [{ name: "vetra", registry: "https://registry.vetra.io", version: "1" }] };
const asUser = (address: string) => ({ user: { address } });

let destroy: (() => Promise<void>) | null = null;
afterEach(async () => {
  await destroy?.();
  destroy = null;
});

type R = {
  VetraLlmQueries: Record<string, (p: unknown, a: object, c: object) => Promise<unknown>>;
  VetraLlmMutations: Record<string, (p: unknown, a: object, c: object) => Promise<unknown>>;
};

async function setup(over: Partial<LlmResolverDeps> = {}, budgetUsd = 20) {
  const h = await openLlmDb();
  destroy = h.destroy;
  const fake = createFakeOpenRouter();
  const secrets = createFakeSecrets();
  const broker = createLlmBroker({
    store: createLlmKeyStore(h.db),
    openrouter: fake.api,
    keyVault: fakeKeyVault,
    secrets,
    budgetForDid: async () => ({ allowed: true, budgetUsd }),
    cfg: { defaultModel: DEFAULT_STUDIO_MODEL, workspaceId: null },
    now: () => new Date("2026-10-15T12:00:00.000Z"),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  const r = createLlmResolvers({
    broker,
    tenantOwners: async (): Promise<TenantOwnersResult> => ({ ok: true, owners: [OWNER] }),
    envIdsByTenant: async (t) => (t === TENANT ? [ENV] : []),
    envRow: async (id) => (id === ENV ? { owner: OWNER, ownerOrgId: null, appId: null, tenantId: TENANT } : null),
    envState: async (id) => (id === ENV ? (STUDIO as never) : null),
    access: OWNER_ONLY_ACCESS,
    secrets,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...over,
  }) as unknown as R;
  const code = (p: Promise<unknown>) =>
    p.then(
      () => "OK",
      (e: { extensions?: { code?: unknown } }) => e.extensions?.code,
    );
  return { r, fake, secrets, code };
}

describe("provisionStudioLlm", () => {
  it("provisions the caller's Studio key and the session-export secret", async () => {
    const s = await setup();
    const res = await s.r.VetraLlmMutations.provisionStudioLlm({}, { tenantId: TENANT }, asUser(OWNER));
    expect(res).toStrictEqual({ environmentId: ENV, connected: true, llmBudgetUsd: 20 });
    expect(s.secrets.secret(TENANT, "OPENROUTER_API_KEY")).toMatch(/^sk-or-/);
    expect(s.secrets.secret(TENANT, "VETRA_SESSION_EXPORT_SECRET")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("finishes without a key when the licence has no budget", async () => {
    const s = await setup({}, 0);
    const res = await s.r.VetraLlmMutations.provisionStudioLlm({}, { tenantId: TENANT }, asUser(OWNER));
    expect(res).toStrictEqual({ environmentId: ENV, connected: false, llmBudgetUsd: 0 });
    expect(s.fake.keys.size).toBe(0);
    expect(s.secrets.secret(TENANT, "VETRA_SESSION_EXPORT_SECRET")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("refuses anonymous callers, other owners, unknown tenants and non-Studios, minting nothing", async () => {
    const s = await setup();
    const m = s.r.VetraLlmMutations.provisionStudioLlm;
    expect(await s.code(m({}, { tenantId: TENANT }, {}))).toBe("UNAUTHENTICATED");
    expect(await s.code(m({}, { tenantId: TENANT }, asUser(STRANGER)))).toBe("FORBIDDEN");
    const unknown = await setup({ tenantOwners: async () => ({ ok: false, reason: "UNKNOWN" }) });
    expect(await unknown.code(unknown.r.VetraLlmMutations.provisionStudioLlm({}, { tenantId: "nope" }, asUser(OWNER)))).toBe(
      "NOT_FOUND",
    );
    const busy = await setup({ tenantOwners: async () => ({ ok: false, reason: "BUSY" }) });
    expect(await busy.code(busy.r.VetraLlmMutations.provisionStudioLlm({}, { tenantId: TENANT }, asUser(OWNER)))).toBe(
      "FORBIDDEN",
    );
    const plain = await setup({ envState: async () => ({ packages: [{ name: "other" }] }) as never });
    expect(await plain.code(plain.r.VetraLlmMutations.provisionStudioLlm({}, { tenantId: TENANT }, asUser(OWNER)))).toBe(
      "BAD_USER_INPUT",
    );
    expect(s.fake.keys.size + plain.fake.keys.size).toBe(0);
  });
});

describe("studioLlmStatus and studioLlmUsage", () => {
  it("reports whether the Studio has a model key, for its operator only", async () => {
    const s = await setup();
    const status = s.r.VetraLlmQueries.studioLlmStatus;
    expect(await status({}, { environmentId: ENV }, asUser(OWNER))).toStrictEqual({ environmentId: ENV, connected: false });
    await s.r.VetraLlmMutations.provisionStudioLlm({}, { tenantId: TENANT }, asUser(OWNER));
    expect(await status({}, { environmentId: ENV }, asUser(OWNER))).toStrictEqual({ environmentId: ENV, connected: true });
    expect(await s.code(status({}, { environmentId: ENV }, asUser(STRANGER)))).toBe("FORBIDDEN");
    expect(await s.code(status({}, { environmentId: "nope" }, asUser(OWNER)))).toBe("NOT_FOUND");
  });

  it("returns usage for the operator and null without a key", async () => {
    const s = await setup();
    const usage = s.r.VetraLlmQueries.studioLlmUsage;
    expect(await usage({}, { environmentId: ENV }, asUser(OWNER))).toBeNull();
    await s.r.VetraLlmMutations.provisionStudioLlm({}, { tenantId: TENANT }, asUser(OWNER));
    expect(await usage({}, { environmentId: ENV }, asUser(OWNER))).toMatchObject({ source: "VETRA", limitUsd: 20, usageUsd: 0 });
    expect(await s.code(usage({}, { environmentId: ENV }, asUser(STRANGER)))).toBe("FORBIDDEN");
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run shared/tenant-owners.test.ts shared/studio-package.test.ts subgraphs/vetra-llm/__tests__/resolvers.test.ts`

Expected: all three fail with `Failed to resolve import` (`./tenant-owners.js`, `isStudioState` is not exported, `../resolvers.js`).

- [ ] **Step 3: Implement**

`shared/tenant-owners.ts`:

```ts
import { createProjectionWait, type ProjectionWaitOptions } from "./projection-wait.js";

const UNDEFINED_TABLE = "42P01";

export type TenantOwnersResult =
  | { ok: true; owners: (string | null)[] }
  | { ok: false; reason: "UNVERIFIABLE" | "BUSY" | "UNKNOWN" };

/**
 * The owners of a tenant's environments, waiting for the projection: the cold
 * path writes a new Studio's tenant config right after pushing its document,
 * before the environment processor may have projected it. The wait is shared
 * per tenant and capped across tenants (projection-wait.ts): every slot taken
 * is BUSY. Still unknown after the window: UNKNOWN. A missing projection table
 * (42P01) fails closed as UNVERIFIABLE, logged. Moved from licensing's
 * applyStudioKey so vetra-llm's provisionStudioLlm checks exactly the same way.
 */
export function createTenantOwnersCheck(
  lookup: (tenantId: string) => Promise<(string | null)[]>,
  wait: ProjectionWaitOptions,
  logPrefix: string,
): (tenantId: string) => Promise<TenantOwnersResult> {
  let find: ReturnType<typeof createProjectionWait<string | null>> | null = null;
  return async (tenantId) => {
    find ??= createProjectionWait(lookup, wait);
    let owners: (string | null)[] | null;
    try {
      owners = await find(tenantId, { wait: true });
    } catch (err) {
      if ((err as { code?: unknown }).code === UNDEFINED_TABLE) {
        console.error(`${logPrefix}: tenant projection unreadable (${UNDEFINED_TABLE})`);
        return { ok: false, reason: "UNVERIFIABLE" };
      }
      throw err;
    }
    if (owners === null) return { ok: false, reason: "BUSY" };
    if (owners.length === 0) return { ok: false, reason: "UNKNOWN" };
    return { ok: true, owners };
  };
}
```

`subgraphs/vetra-licensing/subscriptions-resolvers.ts`:

- Imports: add `import { createTenantOwnersCheck } from "../../shared/tenant-owners.js";`. Remove the `createProjectionWait` named import from `:2` and keep `type ProjectionWaitOptions`.
- Delete `:90` (`const UNDEFINED_TABLE = "42P01";`).
- Replace `:174-199` (the comment, `let findTenantOwners`, and `knownTenantOwners`) with:

```ts
  /**
   * The owners of a tenant's environments, waiting for the projection
   * (shared/tenant-owners.ts). Busy or unverifiable: FORBIDDEN; still unknown
   * after the window: NOT_FOUND.
   */
  const tenantOwners = createTenantOwnersCheck(
    (t) => deps.tenantOwners(t),
    deps.tenantWait,
    "[licensing] applyStudioKey",
  );
  const knownTenantOwners = async (tenantId: string): Promise<(string | null)[]> => {
    const r = await tenantOwners(tenantId);
    if (r.ok) return r.owners;
    if (r.reason === "UNVERIFIABLE") {
      throw new ForbiddenError("tenant ownership cannot be verified in this deployment");
    }
    if (r.reason === "BUSY") throw new ForbiddenError("too many tenants are being waited on; retry shortly");
    throw new UnknownTenantError();
  };
```

`shared/studio-package.ts`: append:

```ts
/** Whether an environment document's state installs the studio agent package (the document is the truth, not the projection). */
export function isStudioState(state: { packages: ReadonlyArray<{ name: string }> } | null | undefined): boolean {
  return !!state && state.packages.some((p) => isStudioAgentPackage(p.name));
}
```

`subgraphs/vetra-llm/schema.ts`:

```ts
import type { DocumentNode } from "graphql";
import { gql } from "graphql-tag";

/** Vetra LLM broker: per-Studio OpenRouter keys from the licence's monthly budget. */
export const schema: DocumentNode = gql`
  type StudioLlmStatus {
    environmentId: String!
    "True when the Studio's tenant holds an OPENROUTER_API_KEY (Vetra-provisioned or user-set)."
    connected: Boolean!
  }

  type StudioLlmUsage {
    "VETRA (Vetra budget) or BYO (the user's OpenRouter account, phase 2)."
    source: String!
    model: String!
    "Spend this month (USD)."
    usageUsd: Float!
    "Monthly limit (USD); null when unlimited."
    limitUsd: Float
    "When the monthly limit resets (ISO); null when it does not."
    resetsAt: String
  }

  type StudioLlmProvision {
    environmentId: String!
    "False when the licence has no LLM budget: the Studio runs in connect-a-model mode."
    connected: Boolean!
    llmBudgetUsd: Float!
  }

  type VetraLlmQueries {
    "Operators of the Studio only."
    studioLlmStatus(environmentId: String!): StudioLlmStatus!
    "Operators of the Studio only; null without a key. Cached 60 s."
    studioLlmUsage(environmentId: String!): StudioLlmUsage
  }

  type VetraLlmMutations {
    "Cold Studio creation: provision the Studio's key from the caller's licence budget (replaces vetraSubscriptions.applyStudioKey). Every environment on the tenant must be the caller's."
    provisionStudioLlm(tenantId: String!): StudioLlmProvision!
  }

  extend type Query {
    vetraLlm: VetraLlmQueries!
  }

  extend type Mutation {
    vetraLlm: VetraLlmMutations!
  }
`;
```

`subgraphs/vetra-llm/resolvers.ts`:

```ts
import { randomBytes } from "node:crypto";
import { callerIsAdmin } from "../../shared/admins.js";
import { isStudioState } from "../../shared/studio-package.js";
import type { TenantOwnersResult } from "../../shared/tenant-owners.js";
import type { EnvAccess, EnvAccessRow } from "../vetra-cloud-observability/env-access.js";
import type { SecretsService } from "../vetra-cloud-secrets/services/secrets-service.js";
import { didForAddress } from "../vetra-licensing/did.js";
import { OPENROUTER_KEY_SECRET, type LlmBroker } from "./broker.js";
import { llmError, notConfigured, toLlmGraphQLError } from "./errors.js";

export interface LlmContext {
  user?: { address?: string };
  isAdmin?: (address: string) => boolean;
}

export interface LlmResolverDeps {
  broker: LlmBroker;
  tenantOwners(tenantId: string): Promise<TenantOwnersResult>;
  /** Environment ids projected for a tenant. */
  envIdsByTenant(tenantId: string): Promise<string[]>;
  /** The projection row access is decided on; null when unknown. */
  envRow(environmentId: string): Promise<(EnvAccessRow & { tenantId: string | null }) | null>;
  /** The environment document's state (the truth for "is this a Studio"). */
  envState(environmentId: string): Promise<{ packages: ReadonlyArray<{ name: string }> } | null>;
  access: EnvAccess;
  secrets: Pick<SecretsService, "setSecret" | "listSecretKeys"> | null;
  logger: Pick<Console, "info" | "warn" | "error">;
}

interface Caller {
  address: string;
  did: string;
  isAdmin: boolean;
}

function requireCaller(ctx: LlmContext): Caller {
  const address = ctx.user?.address?.toLowerCase();
  if (!address) throw llmError("UNAUTHENTICATED", "Sign in with Renown");
  return { address, did: didForAddress(address), isAdmin: callerIsAdmin(ctx, address) };
}

export function createLlmResolvers(deps: LlmResolverDeps): Record<string, unknown> {
  const wrap =
    <A, R>(fn: (a: A, ctx: LlmContext) => Promise<R>) =>
    async (_p: unknown, a: A, ctx: LlmContext): Promise<R> => {
      try {
        return await fn(a, ctx);
      } catch (err) {
        throw toLlmGraphQLError(err, deps.logger);
      }
    };

  /** The caller must operate the env (canOperate), and it must be a Studio. */
  const operable = async (environmentId: string, ctx: LlmContext) => {
    const caller = requireCaller(ctx);
    const env = await deps.envRow(environmentId);
    if (!env) throw llmError("NOT_FOUND", "environment not found");
    if (!(await deps.access.canOperate(caller, env))) {
      throw llmError("FORBIDDEN", "you cannot operate this environment");
    }
    if (!isStudioState(await deps.envState(environmentId))) {
      throw llmError("BAD_USER_INPUT", "not a Vetra Studio");
    }
    return { caller, env };
  };

  return {
    Query: { vetraLlm: () => ({}) },
    Mutation: { vetraLlm: () => ({}) },

    VetraLlmQueries: {
      studioLlmStatus: wrap(async (a: { environmentId: string }, ctx) => {
        const { env } = await operable(a.environmentId, ctx);
        if (!deps.secrets || !env.tenantId) return { environmentId: a.environmentId, connected: false };
        const keys = await deps.secrets.listSecretKeys(env.tenantId);
        return {
          environmentId: a.environmentId,
          connected: keys.some((k) => k.key === OPENROUTER_KEY_SECRET),
        };
      }),

      studioLlmUsage: wrap(async (a: { environmentId: string }, ctx) => {
        await operable(a.environmentId, ctx);
        return deps.broker.studioLlmUsage(a.environmentId);
      }),
    },

    VetraLlmMutations: {
      provisionStudioLlm: wrap(async (a: { tenantId: string }, ctx) => {
        const caller = requireCaller(ctx);
        // Same check as licensing's applyStudioKey: every environment on the
        // tenant must be the caller's (subscriptions-resolvers.ts).
        const r = await deps.tenantOwners(a.tenantId);
        if (!r.ok) {
          if (r.reason === "UNKNOWN") throw llmError("NOT_FOUND", "unknown tenant");
          throw llmError(
            "FORBIDDEN",
            r.reason === "BUSY"
              ? "too many tenants are being waited on; retry shortly"
              : "tenant ownership cannot be verified in this deployment",
          );
        }
        if (r.owners.some((o) => o !== caller.address)) {
          throw llmError("FORBIDDEN", "this tenant is not one of your environments");
        }
        let environmentId: string | null = null;
        for (const id of await deps.envIdsByTenant(a.tenantId)) {
          if (isStudioState(await deps.envState(id))) {
            environmentId = id;
            break;
          }
        }
        if (!environmentId) throw llmError("BAD_USER_INPUT", "not a Vetra Studio");
        if (!deps.secrets) throw notConfigured("tenant secrets (OPENBAO_ADDR)");
        const res = await deps.broker.provisionVetraKey({
          environmentId,
          tenantId: a.tenantId,
          ownerDid: caller.did,
        });
        // Per-env random secret gating vetra-cli's session-export endpoints
        // (was written by applyStudioKey; unchanged behaviour).
        await deps.secrets.setSecret(a.tenantId, "VETRA_SESSION_EXPORT_SECRET", randomBytes(32).toString("hex"));
        return { environmentId, ...res };
      }),
    },
  };
}
```

`subgraphs/vetra-llm/factory.ts`:

```ts
import type { Kysely } from "kysely";
import { OpenBaoTransitClient } from "../vetra-cloud-secrets/openbao-transit.js";
import type { SecretsService } from "../vetra-cloud-secrets/services/secrets-service.js";
import { createKeyVault, type KeyVault } from "../vetra-licensing/key-vault.js";
import { studioLlmBudgetForDid, type StudioAccessDeps } from "../vetra-licensing/studio-access.js";
import { createLlmBroker, type LlmBroker } from "./broker.js";
import { loadLlmConfig, type LlmConfig } from "./config.js";
import type { VetraLlmDB } from "./db/schema.js";
import { createOpenRouterApi, type OpenRouterApi } from "./openrouter.js";
import { createLlmKeyStore } from "./store.js";

const DEFAULT_TRANSIT_ROLE = "vetra-secrets";

/** Built exactly as the pool and licensing build it (OPENBAO_TRANSIT_ROLE, OPENBAO_TRANSIT_KEY_PREFIX). */
export function transitFromEnv(env: Record<string, string | undefined>): OpenBaoTransitClient | null {
  const addr = env.OPENBAO_ADDR;
  if (!addr) return null;
  return new OpenBaoTransitClient({
    addr,
    role: env.OPENBAO_TRANSIT_ROLE ?? DEFAULT_TRANSIT_ROLE,
    keyNamePrefix: env.OPENBAO_TRANSIT_KEY_PREFIX,
  });
}

export interface ProcessBroker {
  broker: LlmBroker;
  cfg: LlmConfig;
  openrouter: OpenRouterApi | null;
  keyVault: KeyVault | null;
}

/** One broker definition for every subgraph that provisions keys (vetra-llm, vetra-studio-pool). */
export function createProcessBroker(input: {
  db: Kysely<VetraLlmDB>;
  transit: OpenBaoTransitClient | null;
  secrets: Pick<SecretsService, "setSecret" | "setEnvVar"> | null;
  studio: StudioAccessDeps;
  env: Record<string, string | undefined>;
}): ProcessBroker {
  const cfg = loadLlmConfig(input.env);
  const openrouter = cfg.managementKey
    ? createOpenRouterApi({ managementKey: cfg.managementKey, baseUrl: cfg.baseUrl })
    : null;
  const keyVault = createKeyVault(input.transit);
  const broker = createLlmBroker({
    store: createLlmKeyStore(input.db),
    openrouter,
    keyVault,
    secrets: input.secrets,
    budgetForDid: (did) => studioLlmBudgetForDid(input.studio, did),
    cfg,
    now: () => new Date(),
    logger: console,
  });
  return { broker, cfg, openrouter, keyVault };
}
```

`subgraphs/vetra-llm/index.ts`:

```ts
import { BaseSubgraph } from "@powerhousedao/reactor-api";
import type { DocumentNode } from "graphql";
import type { Kysely } from "kysely";
import type { DB } from "../../processors/vetra-cloud-environment/schema.js";
import { defaultRenownOrgs } from "../../shared/renown-orgs.js";
import { createTenantOwnersCheck } from "../../shared/tenant-owners.js";
import { createReactorEnvGateway } from "../vetra-apps/envs.js";
import type { VetraAppsDB } from "../vetra-apps/db/schema.js";
import {
  appDidLookup,
  appDisputeLookup,
  createEnvAccess,
} from "../vetra-cloud-observability/env-access.js";
import type { SecretsDB } from "../vetra-cloud-secrets/db/schema.js";
import { createSecretsService } from "../vetra-cloud-secrets/services/secrets-service.js";
import type { VetraLicensingDB } from "../vetra-licensing/db/schema.js";
import { appsTrustedIds, createStudioAccessDeps } from "../vetra-licensing/studio-access-factory.js";
import { up } from "./db/migrations.js";
import type { VetraLlmDB } from "./db/schema.js";
import { createProcessBroker, transitFromEnv } from "./factory.js";
import { createLlmResolvers } from "./resolvers.js";
import { schema } from "./schema.js";

/**
 * Vetra LLM: the OpenRouter key broker. One capped key per Studio, from the
 * licence's monthly budget (namespace "vetra-llm"). Without
 * OPENROUTER_MANAGEMENT_KEY or OPENBAO_ADDR the subgraph still loads and its
 * mutations answer SERVICE_NOT_CONFIGURED; no other subgraph breaks.
 */
export class VetraLlmSubgraph extends BaseSubgraph {
  name = "vetra-llm";
  typeDefs: DocumentNode = schema;
  resolvers: Record<string, unknown> = {};
  additionalContextFields = {};

  protected timers: ReturnType<typeof setInterval>[] = [];

  async onSetup() {
    const db = (await this.relationalDb.createNamespace("vetra-llm")) as unknown as Kysely<VetraLlmDB>;
    await up(db as Kysely<any>);

    const transit = transitFromEnv(process.env);
    if (!transit) console.warn("[vetra-llm] OPENBAO_ADDR unset — keys cannot be stored or written");
    const secrets = transit
      ? createSecretsService({
          db: (await this.relationalDb.createNamespace("vetra-cloud-secrets")) as unknown as Kysely<SecretsDB>,
          transit,
        })
      : null;
    const licensingDb = (await this.relationalDb.createNamespace(
      "vetra-licensing",
    )) as unknown as Kysely<VetraLicensingDB>;
    const appsDb = (await this.relationalDb.createNamespace("vetra-apps")) as unknown as Kysely<VetraAppsDB>;
    const studio = createStudioAccessDeps({
      client: this.reactorClient as never,
      licensingDb,
      trustedIds: appsTrustedIds(appsDb),
      transit,
    });
    const { broker, cfg } = createProcessBroker({ db, transit, secrets, studio, env: process.env });
    if (!cfg.managementKey) {
      console.warn("[vetra-llm] OPENROUTER_MANAGEMENT_KEY unset — Vetra LLM keys disabled (SERVICE_NOT_CONFIGURED)");
    }

    const envDb = (await this.relationalDb.createNamespace("vetra-cloud-environments")) as unknown as Kysely<DB>;
    const envs = createReactorEnvGateway(this.reactorClient as never);

    this.resolvers = createLlmResolvers({
      broker,
      tenantOwners: createTenantOwnersCheck(
        async (tenantId) =>
          (await envDb.selectFrom("environments").select("owner").where("tenantId", "=", tenantId).execute()).map(
            (r) => r.owner?.toLowerCase() ?? null,
          ),
        { timeoutMs: 10_000, intervalMs: 500 },
        "[vetra-llm] provisionStudioLlm",
      ),
      envIdsByTenant: async (tenantId) =>
        (await envDb.selectFrom("environments").select("id").where("tenantId", "=", tenantId).execute()).map(
          (r) => r.id,
        ),
      envRow: async (environmentId) =>
        (await envDb
          .selectFrom("environments")
          .select(["owner", "ownerOrgId", "appId", "tenantId"])
          .where("id", "=", environmentId)
          .executeTakeFirst()) ?? null,
      envState: (environmentId) => envs.getState(environmentId),
      access: createEnvAccess({
        orgs: defaultRenownOrgs(),
        appDidOf: appDidLookup(appsDb),
        appOrgDisputed: appDisputeLookup(appsDb),
      }),
      secrets,
      logger: console,
    });
  }

  async onDisconnect() {
    for (const t of this.timers) clearInterval(t);
    this.timers = [];
  }
}
```

`subgraphs/index.ts`: append `export * as VetraLlmSubgraph from "./vetra-llm/index.js";`.

`powerhouse.manifest.json`: after the `vetra-apps` entry (`:74-77`), add (with a comma after the `vetra-apps` object):

```json
    {
      "id": "vetra-llm",
      "name": "Vetra LLM"
    }
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run shared subgraphs/vetra-llm subgraphs/vetra-licensing && pnpm tsc && pnpm lint && pnpm exec oxfmt $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard)`

Expected:
- the new suites pass;
- `apply-studio-key.test.ts` is unchanged and passes (same FORBIDDEN/NOT_FOUND behaviour and the same log line);
- tsc and lint report 0 errors.

- [ ] **Step 5: Commit**

```bash
git add shared subgraphs/vetra-llm subgraphs/vetra-licensing/subscriptions-resolvers.ts subgraphs/index.ts powerhouse.manifest.json
git commit -m "feat(llm): vetra-llm subgraph with provisionStudioLlm, studioLlmStatus and studioLlmUsage"
```

---
### Task 7: Pool claim calls the broker; no key no longer blocks a claim (vetra-cloud-package)

**Files**

- Modify: `subgraphs/vetra-studio-pool/claim.ts` (whole file, 175 lines; rewritten below)
- Modify: `subgraphs/vetra-studio-pool/index.ts`:
  - imports `:33-36`;
  - after `:97`: the broker;
  - `:129-156`: claim wiring;
  - `:174-182`: release on delete.
- Modify: `subgraphs/vetra-studio-pool/config.ts`:
  - `:1-11`: interface;
  - `:30-37`: `loadPoolConfig`.
- Modify: `subgraphs/vetra-studio-pool/create-env.ts:79-82` (drop `VETRA_REQUIRE_API_KEY`)
- Test: `subgraphs/vetra-studio-pool/claim.test.ts`:
  - `:4-8`, `:18-47`, `:50-54` and `:64-104`;
  - add new cases.
- Test: `subgraphs/vetra-studio-pool/config.test.ts`:
  - `:6-13` and `:25-32`;
  - add a new case.
- Test: `subgraphs/vetra-studio-pool/create-env.test.ts:52-61`

**Interfaces**

- Consumes:
  - `LlmBroker.ensureVetraKey` and `LlmBroker.releaseVetraKey` (Task 5);
  - `OPENROUTER_KEY_SECRET` and `MODEL_VAR` (Task 5);
  - `isNotConfigured` (Task 5);
  - `createProcessBroker` (Task 6);
  - `up` (Task 2);
  - `studioLlmBudgetForDid` (Task 4);
  - `STUDIO_KEY_SECRET_NAMES` (`subgraphs/vetra-licensing/subscriptions-resolvers.ts:84-88`);
  - `studioKeyForDid` (`subgraphs/vetra-licensing/studio-access.ts:109`);
  - `SecretsService.replaceTenantConfig` (`secrets-service.ts:126-129`).
- Produces:
  - `ClaimDeps` gains:
    - `hasStudioAccess(did: string): Promise<boolean>`
    - `grantLlmKey(environmentId: string, did: string): Promise<{ key: string; model: string } | null>`
    - `releaseLlmKey(environmentId: string): Promise<void>`
    - `legacyAnthropicKey(did: string): Promise<string | null>`
  - `ClaimDeps` loses `getKeyForDid`.
  - `replaceTenantConfig` entries become `Array<{ key: string; value: string; secret?: boolean }>`.
  - `PoolConfig.legacyAnthropicKey: boolean` (from `STUDIO_POOL_LEGACY_ANTHROPIC_KEY`, default true).

- [ ] **Step 1: Write the failing tests**

`subgraphs/vetra-studio-pool/claim.test.ts`:

1. Replace `:4-8` (`SECRET_NAMES`) with:

```ts
const LEGACY_NAMES = ["ANTHROPIC_API_KEY", "VETRA_ANTHROPIC_API_KEY", "VETRA_CLI_ANTHROPIC_API_KEY"];
```

2. `:16`: change `type SecretEntry = { key: string; value: string };` to `type SecretEntry = { key: string; value: string; secret?: boolean };`.
3. In `deps()` (`:18-47`), replace the `getKeyForDid: ...` property (`:31-33`) with:

```ts
    hasStudioAccess: vi.fn(async (_did: string) => true),
    grantLlmKey: vi.fn(async (_env: string, _did: string) => ({
      key: "sk-or-v1-real",
      model: "anthropic/claude-sonnet-4.6",
    })),
    releaseLlmKey: vi.fn(async (_env: string) => {}),
    legacyAnthropicKey: vi.fn(async (_did: string) => "sk-ant-real" as string | null),
```

4. Replace the first test (`:50-54`) with:

```ts
  it("returns null without a usable studio licence (without consuming an env or minting a key)", async () => {
    const d = deps({ hasStudioAccess: vi.fn(async () => false) });
    expect(await claimWarmEnvironment(d as never, "did:pkh:eip155:1:0xCaller")).toBeNull();
    expect(d.claimDb.claimOneAvailable).not.toHaveBeenCalled();
    expect(d.grantLlmKey).not.toHaveBeenCalled();
  });
```

5. In the "looks up the key by full DID" test (`:64-80`):
   - rename it to `"gates on the full DID; grants the key for the claimed env; sets owner + claims by derived address"`;
   - replace `expect(d.getKeyForDid).toHaveBeenCalledWith("did:pkh:eip155:1:0xCALLER");` with:

```ts
    expect(d.hasStudioAccess).toHaveBeenCalledWith("did:pkh:eip155:1:0xCALLER");
    expect(d.grantLlmKey).toHaveBeenCalledWith("doc-1", "did:pkh:eip155:1:0xCALLER");
```

6. Replace the batch test (`:82-104`) with:

```ts
  it("writes the model key, its model, legacy keys, ADMINS and the session secret in ONE batch", async () => {
    const d = deps();
    await claimWarmEnvironment(d as never, "did:pkh:eip155:1:0xCALLER");
    expect(d.replaceTenantConfig).toHaveBeenCalledTimes(1);
    const [tenantId, state, entries] = d.replaceTenantConfig.mock.calls[0];
    expect(state).toBe(WARM_STATE);
    expect(tenantId).toBe("warm-newt-aaaa1111-aaaa1111");
    expect(entries).toContainEqual({ key: "OPENROUTER_API_KEY", value: "sk-or-v1-real" });
    // The model is a plain env var, not a secret.
    expect(entries).toContainEqual({ key: "VETRA_MODEL", value: "anthropic/claude-sonnet-4.6", secret: false });
    // Transition only (removed in phase 3): agents built before OpenRouter still read these.
    for (const name of LEGACY_NAMES) expect(entries).toContainEqual({ key: name, value: "sk-ant-real" });
    expect(entries).toContainEqual({ key: "ADMINS", value: "0xcaller" });
    expect(entries.find((e) => e.key === "VETRA_SESSION_EXPORT_SECRET")?.value).toMatch(/^[0-9a-f]{64}$/);
    expect(entries).toHaveLength(7);
  });

  it("still claims without an LLM budget or legacy key: the Studio comes up in connect-a-model mode", async () => {
    const d = deps({ grantLlmKey: vi.fn(async () => null), legacyAnthropicKey: vi.fn(async () => null) });
    expect(await claimWarmEnvironment(d as never, "did:pkh:eip155:1:0xCaller")).not.toBeNull();
    const [, , entries] = d.replaceTenantConfig.mock.calls[0];
    expect(entries.map((e) => e.key).sort()).toStrictEqual(["ADMINS", "VETRA_SESSION_EXPORT_SECRET"]);
  });

  it("releases the minted key and deletes the env when the claim fails after the grant", async () => {
    const d = deps();
    d.replaceTenantConfig = vi.fn(async () => {
      throw new Error("inject boom");
    });
    expect(await claimWarmEnvironment(d as never, "did:pkh:eip155:1:0xCaller")).toBeNull();
    expect(d.releaseLlmKey).toHaveBeenCalledWith("doc-1");
    expect(d.deleteEnv).toHaveBeenCalledWith("doc-1");
  });

  it("deletes the env (and releases nothing) when the grant itself fails", async () => {
    const d = deps({
      grantLlmKey: vi.fn(async () => {
        throw new Error("openrouter down");
      }),
    });
    expect(await claimWarmEnvironment(d as never, "did:pkh:eip155:1:0xCaller")).toBeNull();
    expect(d.replaceTenantConfig).not.toHaveBeenCalled();
    expect(d.deleteEnv).toHaveBeenCalledWith("doc-1");
  });

  it("never logs the model key", async () => {
    const d = deps();
    d.replaceTenantConfig = vi.fn(async () => {
      throw new Error("inject boom");
    });
    await claimWarmEnvironment(d as never, "did:pkh:eip155:1:0xCaller");
    const lines = [...d.logger.info.mock.calls, ...d.logger.warn.mock.calls, ...d.logger.error.mock.calls].flat();
    for (const line of lines) expect(String(line)).not.toMatch(/sk-or-|sk-ant-/);
  });
```

`subgraphs/vetra-studio-pool/config.test.ts`: add `legacyAnthropicKey: true,` to both expected objects (`:6-13`, `:25-32`) and append:

```ts
  it("turns the legacy Anthropic write off after cut-over", () => {
    expect(loadPoolConfig({ STUDIO_POOL_LEGACY_ANTHROPIC_KEY: "false" }).legacyAnthropicKey).toBe(false);
    expect(loadPoolConfig({ STUDIO_POOL_LEGACY_ANTHROPIC_KEY: "true" }).legacyAnthropicKey).toBe(true);
  });
```

`subgraphs/vetra-studio-pool/create-env.test.ts:52-61`: replace the comment and assertion with:

```ts
    // The agent always serves (no-model mode without a key): no require-key gate.
    const svc = (
      actions as { type: string; input: { clintConfig?: { env?: { name: string; value: string }[] } } }[]
    ).find((a) => a.type === "ENABLE_SERVICE");
    expect(svc?.input.clintConfig?.env?.map((e) => e.name)).not.toContain("VETRA_REQUIRE_API_KEY");
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run subgraphs/vetra-studio-pool/claim.test.ts subgraphs/vetra-studio-pool/config.test.ts subgraphs/vetra-studio-pool/create-env.test.ts`

Expected:
- claim: `d.hasStudioAccess is not a function`-style failures (`expected "spy" to be called`) and `toHaveLength(7)` received 5;
- config: missing `legacyAnthropicKey`;
- create-env: `VETRA_REQUIRE_API_KEY` is still present.

- [ ] **Step 3: Implement**

`subgraphs/vetra-studio-pool/claim.ts`: replace the whole file with:

```ts
import { randomBytes } from "node:crypto";
import type { VetraCloudEnvironmentState } from "../../document-models/vetra-cloud-environment/index.js";
import { STUDIO_KEY_SECRET_NAMES } from "../vetra-licensing/subscriptions-resolvers.js";
import { MODEL_VAR, OPENROUTER_KEY_SECRET } from "../vetra-llm/broker.js";
import type { ClaimDb } from "./pool-db.js";

const SECRET_RETRIES = 3;

/** One tenant config entry; `secret` defaults to true (a plain env var sets false). */
export type TenantEntry = { key: string; value: string; secret?: boolean };

export interface ClaimDeps {
  claimDb: ClaimDb;
  /** The licence gate: a caller without a usable studio licence consumes no env. */
  hasStudioAccess: (did: string) => Promise<boolean>;
  /**
   * The env's Vetra OpenRouter key (vetra-llm broker ensureVetraKey), created
   * or reused, capped at the licence's monthly budget. Null when the licence
   * has no budget or the broker is not configured: the Studio then serves in
   * connect-a-model mode.
   */
  grantLlmKey: (environmentId: string, did: string) => Promise<{ key: string; model: string } | null>;
  /** Delete the env's Vetra key after a failed claim (the env is deleted too). */
  releaseLlmKey: (environmentId: string) => Promise<void>;
  /**
   * Transition only (removed in phase 3): the Anthropic key on the caller's
   * licence, still written for agents built before OpenRouter; null when none
   * or when STUDIO_POOL_LEGACY_ANTHROPIC_KEY=false.
   */
  legacyAnthropicKey: (did: string) => Promise<string | null>;
  /** System action: SET_OWNER on the (owner-null) claimed document. */
  setOwner: (documentId: string, address: string) => Promise<void>;
  /**
   * The claimed document's current ownership and state (null when it cannot
   * be read). The read-model row says AVAILABLE; the document is the truth.
   */
  readEnv: (documentId: string) => Promise<{
    owner: string | null;
    ownerOrgId: string | null;
    state: VetraCloudEnvironmentState;
  } | null>;
  /**
   * Replace the tenant's env vars and secrets with what the document declares
   * plus `entries`, atomically — one write, one notify, one pod bounce.
   * Anything written before the claim (and not declared by the document) is
   * gone. `entries` carry the model key and model, the legacy key names,
   * `ADMINS` (so the claimant is the embedded switchboard's admin without a
   * gitops re-render) and the session-export secret.
   */
  replaceTenantConfig: (
    tenantId: string,
    state: VetraCloudEnvironmentState,
    entries: TenantEntry[],
  ) => Promise<void>;
  /**
   * Move the document's reactor-api protection to the new owner and revoke
   * every other grant (env-protection.ts protectForOwner).
   */
  handOver: (documentId: string, address: string) => Promise<void>;
  /** Fully delete an env (deleteDocument) — used to clean up a half-claimed env
   *  on failure so it doesn't leak a pod/namespace/cert as a TERMINATING husk. */
  deleteEnv: (documentId: string) => Promise<void>;
  cfg: { version: string };
  nowIso: () => string;
  /** Optional async sleep (injectable for tests); defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  logger: { info(m: string): void; warn(m: string): void; error(m: string): void };
}

export interface ClaimResult {
  documentId: string;
  subdomain: string;
  tenantId: string;
}

async function withRetry(
  fn: () => Promise<void>,
  retries: number,
  sleep: (ms: number) => Promise<void>,
): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      await fn();
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < retries - 1) await sleep(2 ** attempt * 100);
    }
  }
  throw lastErr;
}

/**
 * Atomically claim one warm env for the caller `did` (a `did:pkh:...`), give it
 * its model key, and transfer ownership (system SET_OWNER on the owner-null
 * env). The gate is the studio licence, not a key: a licence without an LLM
 * budget still gets a Studio, which serves in connect-a-model mode. Returns
 * null when the caller has no usable licence or the pool is empty (frontend
 * then cold-falls-back).
 *
 * Self-healing: transient secret writes are retried; on ANY post-assign failure
 * the minted key is released and the half-claimed env deleted, so a failed
 * claim leaks nothing (the keeper refills, the sweeper backstops the key).
 */
export async function claimWarmEnvironment(
  d: ClaimDeps,
  did: string,
): Promise<ClaimResult | null> {
  const addr = (did.split(":").pop() ?? did).toLowerCase();
  const sleep = d.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));

  // 1. No usable studio licence → don't consume an env.
  if (!(await d.hasStudioAccess(did))) {
    d.logger.info(`[studio-pool] claim: no usable studio licence for ${addr}`);
    return null;
  }

  // 2. Atomic assign (only a READY, AVAILABLE, current-version env).
  const env = await d.claimDb.claimOneAvailable(addr, d.cfg.version, d.nowIso());
  if (!env || !env.tenantId) {
    d.logger.info(`[studio-pool] claim: pool empty for ${addr}`);
    return null;
  }

  let granted = false;
  try {
    // 2b. The document is the truth: a warm env is owner-null and personal.
    //     One that someone owns already (signed on it before the claim) is
    //     compromised: delete it, never hand it out (caller falls back cold).
    const doc = await d.readEnv(env.id);
    if (!doc || doc.owner || doc.ownerOrgId) {
      d.logger.warn(
        `[studio-pool] claim: ${env.id} is not an unowned warm env (owner=${doc?.owner ?? "?"}, org=${doc?.ownerOrgId ?? "-"}); deleting`,
      );
      await d.deleteEnv(env.id).catch((e) =>
        d.logger.warn(`[studio-pool] cleanup delete failed for ${env.id}: ${String(e)}`),
      );
      return null;
    }
    // 3. The model key for this env, from the licence's budget.
    const llm = await d.grantLlmKey(env.id, did);
    granted = llm !== null;
    const anthropic = await d.legacyAnthropicKey(did);
    // 4. Everything in ONE batched write — a single pg_notify → one
    //    secrets-controller reconcile → ONE Reloader bounce of the agent pod.
    //    Retried as a whole for transient failures.
    const entries: TenantEntry[] = [
      ...(llm
        ? [
            { key: OPENROUTER_KEY_SECRET, value: llm.key },
            { key: MODEL_VAR, value: llm.model, secret: false },
          ]
        : []),
      ...(anthropic ? STUDIO_KEY_SECRET_NAMES.map((key) => ({ key, value: anthropic })) : []),
      { key: "ADMINS", value: addr },
      // Per-env random secret gating vetra-cli's session-export endpoints
      // (admin-side debugging). Rides this same batched write — no extra bounce.
      { key: "VETRA_SESSION_EXPORT_SECRET", value: randomBytes(32).toString("hex") },
    ];
    // Everything not declared by the document is dropped in the same write,
    // so nothing planted before the claim survives into the user's studio.
    await withRetry(
      () => d.replaceTenantConfig(env.tenantId!, doc.state, entries),
      SECRET_RETRIES,
      sleep,
    );
    // 5. Transfer ownership LAST (system action — env was created owner-null).
    await d.setOwner(env.id, addr);
    // 6. Protection follows the owner; every other grant goes. The env
    //    protector does the same on the change event, so a failure here only
    //    delays it.
    try {
      await d.handOver(env.id, addr);
    } catch (err) {
      d.logger.warn(`[studio-pool] claim: protection hand-over for ${env.id} failed: ${String(err)}`);
    }
    d.logger.info(
      `[studio-pool] claimed ${env.id} (${env.tenantId}) for ${addr}${granted ? "" : " (no model key: connect-a-model mode)"}`,
    );
    return {
      documentId: env.id,
      subdomain: env.subdomain ?? "",
      tenantId: env.tenantId,
    };
  } catch (err) {
    // Half-claimed → release the key and delete the env so nothing leaks; the
    // keeper refills. Caller gets null → cold-falls-back.
    d.logger.warn(
      `[studio-pool] claim post-assign failed for ${env.id}; deleting: ${err instanceof Error ? err.name : "error"}`,
    );
    if (granted) {
      await d.releaseLlmKey(env.id).catch(() =>
        d.logger.warn(`[studio-pool] key release failed for ${env.id}; the vetra-llm sweeper deletes it`),
      );
    }
    await d.deleteEnv(env.id).catch((e) =>
      d.logger.warn(`[studio-pool] cleanup delete failed for ${env.id}: ${String(e)}`),
    );
    return null;
  }
}
```

The "deletes the env when the grant itself fails" case gets `granted === false`, so `releaseLlmKey` is not called. The "releases the minted key" case gets `granted === true`.

`subgraphs/vetra-studio-pool/config.ts`:

- Add `legacyAnthropicKey: boolean;` to `PoolConfig`, documented as `/** STUDIO_POOL_LEGACY_ANTHROPIC_KEY: write the licence's Anthropic key on claim (transition; "false" after cut-over, removed in phase 3). */`.
- In `loadPoolConfig`'s return, add `legacyAnthropicKey: env.STUDIO_POOL_LEGACY_ANTHROPIC_KEY !== "false",`.

`subgraphs/vetra-studio-pool/create-env.ts:79-82`: delete the comment and the `{ name: "VETRA_REQUIRE_API_KEY", value: "true", isSecret: false },` entry.

`subgraphs/vetra-studio-pool/index.ts`:

1. Imports: replace `:35` with:

```ts
import { studioKeyForDid, studioLlmBudgetForDid } from "../vetra-licensing/studio-access.js";
import { up as ensureLlmTables } from "../vetra-llm/db/migrations.js";
import type { VetraLlmDB } from "../vetra-llm/db/schema.js";
import { isNotConfigured } from "../vetra-llm/errors.js";
import { createProcessBroker } from "../vetra-llm/factory.js";
```

2. After `secretsService` is created (`:94-97`), insert:

```ts
    // The vetra-llm key broker, in-process. Its tables are ensured here too
    // because subgraph boot order is not fixed.
    const llmDb = (await this.relationalDb.createNamespace("vetra-llm")) as unknown as Kysely<VetraLlmDB>;
    await ensureLlmTables(llmDb as Kysely<any>);
    const { broker } = createProcessBroker({
      db: llmDb,
      transit,
      secrets: secretsService,
      studio: studioAccess,
      env: process.env,
    });
```

3. In the `claimWarmEnvironment({...})` deps (`:131-154`), replace `getKeyForDid: (d) => studioKeyForDid(studioAccess, d),` with:

```ts
          hasStudioAccess: async (d) => (await studioLlmBudgetForDid(studioAccess, d)).allowed,
          grantLlmKey: async (environmentId, d) => {
            try {
              return await broker.ensureVetraKey({ environmentId, ownerDid: d });
            } catch (err) {
              // A deployment without OPENROUTER_MANAGEMENT_KEY still hands out Studios.
              if (isNotConfigured(err)) return null;
              throw err;
            }
          },
          releaseLlmKey: (environmentId) => broker.releaseVetraKey(environmentId),
          legacyAnthropicKey: (d) => (cfg.legacyAnthropicKey ? studioKeyForDid(studioAccess, d) : Promise.resolve(null)),
```

   Replace the `replaceTenantConfig` mapper (`:142-146`) with:

```ts
          replaceTenantConfig: (tenantId, state, entries) =>
            secretsService.replaceTenantConfig(tenantId, [
              ...tenantConfigEntries(state),
              ...entries.map((e) => ({ key: e.key, value: e.value, secret: e.secret ?? true })),
            ]),
```

4. In the delete subscription callback (`:176-181`), after `void this.reconcileDeletedEnvironment(envDb, id, secretsService);`, add:

```ts
        // A deleted Studio's key goes at once; the vetra-llm sweeper is the backstop.
        void broker
          .releaseVetraKey(id)
          .catch((e: unknown) =>
            console.warn(`[studio-pool] key release for deleted env ${id} failed: ${e instanceof Error ? e.name : "error"}`),
          );
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run subgraphs/vetra-studio-pool subgraphs/vetra-llm && pnpm tsc && pnpm lint && pnpm exec oxfmt $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard)`

Expected:
- every pool suite passes, including the unchanged `resolvers.test.ts`, `keeper.test.ts` and `reconcile.test.ts`;
- 0 tsc errors (the `ClaimDeps` change is satisfied in `index.ts`);
- 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add subgraphs/vetra-studio-pool
git commit -m "feat(studio-pool): claim provisions the Studio's OpenRouter key; licence, not key, gates the claim"
```

---

### Task 8: Lifecycle sweeper (vetra-cloud-package)

**Files**

- Create: `subgraphs/vetra-llm/sweeper.ts`
- Modify: `subgraphs/vetra-llm/index.ts` (the `onSetup` tail: start the sweep timer)
- Test: `subgraphs/vetra-llm/__tests__/sweeper.test.ts`

**Interfaces**

- Consumes:
  - `LlmKeyStore` (Task 2);
  - `OpenRouterApi` (Task 1);
  - `KeyVault`;
  - `SecretsService.setSecret` and `SecretsService.deleteSecret`;
  - `StudioLlmBudget` (Task 4);
  - `KEY_NAME_PREFIX`, `OPENROUTER_KEY_SECRET`, `llmLockKey` and `sameUsd` (Task 5);
  - `withKeyLock`;
  - `redactSecrets`;
  - `createProcessBroker(...).openrouter` and `.keyVault` (Task 6).
- Produces:
  - `SWEEP_INTERVAL_MS = 900_000`
  - `ORPHAN_GRACE_MS = 1_800_000`
  - `interface SweepDeps`
  - `interface SweepReport { deleted: number; disabled: number; enabled: number; limited: number; orphans: number; failed: number }`
  - `runLlmSweepOnce(d: SweepDeps): Promise<SweepReport>`

- [ ] **Step 1: Write the failing test**

`subgraphs/vetra-llm/__tests__/sweeper.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioLlmBudget } from "../../vetra-licensing/studio-access.js";
import type { StudioLlmKeys } from "../db/schema.js";
import { createLlmKeyStore } from "../store.js";
import { ORPHAN_GRACE_MS, runLlmSweepOnce, type SweepDeps } from "../sweeper.js";
import { createFakeOpenRouter } from "./fake-openrouter.js";
import { createFakeSecrets, fakeKeyVault, holderDid } from "./fakes.js";
import { openLlmDb } from "./llm-db.js";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

let destroy: (() => Promise<void>) | null = null;
afterEach(async () => {
  await destroy?.();
  destroy = null;
});

async function setup(opts: {
  envs?: Record<string, { tenantId: string | null; status: string | null } | null>;
  budgets?: Record<string, StudioLlmBudget>;
  workspaceId?: string | null;
} = {}) {
  const h = await openLlmDb();
  destroy = h.destroy;
  const fake = createFakeOpenRouter(() => NOW);
  const secrets = createFakeSecrets();
  const store = createLlmKeyStore(h.db);
  const logs: string[] = [];
  const deps: SweepDeps = {
    store,
    openrouter: fake.api,
    keyVault: fakeKeyVault,
    secrets,
    budgetForDid: vi.fn(async (did: string) => opts.budgets?.[did] ?? { allowed: true, budgetUsd: 20 }),
    envOf: async (id) => (opts.envs && id in opts.envs ? opts.envs[id] : { tenantId: `t-${id}`, status: "READY" }),
    workspaceId: opts.workspaceId === undefined ? "ws-1" : opts.workspaceId,
    now: () => NOW,
    logger: { info: (m) => void logs.push(m), warn: (m) => void logs.push(m), error: (m) => void logs.push(m) },
  };
  /** A Studio row whose key exists on the fake (in the workspace). */
  const held = async (env: string, over: Partial<StudioLlmKeys> = {}) => {
    const hash = fake.seed({ name: `studio:${env}`, createdAt: ago(60 * 60_000), workspaceId: "ws-1" });
    fake.keys.get(hash)!.limit = 20;
    await store.upsert({
      environment_id: env,
      source: "VETRA",
      key_hash: hash,
      key_ciphertext: await fakeKeyVault.encrypt(fake.keys.get(hash)!.secret),
      limit_usd: 20,
      limit_reset: "monthly",
      model: "anthropic/claude-sonnet-4.6",
      owner_did: holderDid(),
      status: "ACTIVE",
      created_at: ago(60 * 60_000),
      updated_at: ago(60 * 60_000),
      ...over,
    });
    return hash;
  };
  return { fake, secrets, store, deps, held, logs };
}

describe("runLlmSweepOnce", () => {
  it("deletes the key of a deleted or released Studio", async () => {
    const s = await setup({ envs: { gone: null, released: { tenantId: "t", status: "DESTROYED" } } });
    const a = await s.held("gone");
    const b = await s.held("released");
    expect(await runLlmSweepOnce(s.deps)).toMatchObject({ deleted: 2, failed: 0 });
    expect(s.fake.keys.has(a) || s.fake.keys.has(b)).toBe(false);
    expect(await s.store.get("gone")).toMatchObject({ status: "DELETED", key_ciphertext: null });
  });

  it("disables the key and removes the secret when the licence is no longer usable", async () => {
    const s = await setup({ budgets: { [holderDid()]: { allowed: false, budgetUsd: 0 } } });
    const hash = await s.held("e1");
    await s.secrets.setSecret("t-e1", "OPENROUTER_API_KEY", "sk-or-v1-x");
    expect(await runLlmSweepOnce(s.deps)).toMatchObject({ disabled: 1 });
    expect(s.fake.keys.get(hash)!.disabled).toBe(true);
    expect(s.secrets.secret("t-e1", "OPENROUTER_API_KEY")).toBeUndefined();
    expect((await s.store.get("e1"))?.status).toBe("DISABLED");
  });

  it("re-enables a renewed licence's key, updates its limit and writes the secret back", async () => {
    const s = await setup({ budgets: { [holderDid()]: { allowed: true, budgetUsd: 30 } } });
    const hash = await s.held("e1", { status: "DISABLED" });
    s.fake.keys.get(hash)!.disabled = true;
    expect(await runLlmSweepOnce(s.deps)).toMatchObject({ enabled: 1 });
    expect(s.fake.keys.get(hash)).toMatchObject({ disabled: false, limit: 30 });
    expect(s.secrets.secret("t-e1", "OPENROUTER_API_KEY")).toBe(s.fake.keys.get(hash)!.secret);
  });

  it("PATCHes the limit when the budget on the code changed, and nothing when it did not", async () => {
    const s = await setup({ budgets: { [holderDid()]: { allowed: true, budgetUsd: 45 } } });
    const hash = await s.held("e1");
    await s.held("e2", { owner_did: holderDid("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb") });
    expect(await runLlmSweepOnce(s.deps)).toMatchObject({ limited: 1 });
    expect(s.fake.keys.get(hash)!.limit).toBe(45);
    expect((await s.store.get("e1"))?.limit_usd).toBe(45);
    expect(s.fake.calls.filter((c) => c.startsWith("updateKey"))).toHaveLength(1);
  });

  it("deletes old studio: orphans in the workspace but keeps fresh ones, known ones and foreign names (Review Focus 3)", async () => {
    const s = await setup();
    const known = await s.held("e1");
    const old = s.fake.seed({ name: "studio:lost", createdAt: ago(ORPHAN_GRACE_MS + 60_000), workspaceId: "ws-1" });
    const fresh = s.fake.seed({ name: "studio:in-flight", createdAt: ago(60_000), workspaceId: "ws-1" });
    const foreign = s.fake.seed({ name: "someone-else", createdAt: ago(ORPHAN_GRACE_MS * 10), workspaceId: "ws-1" });
    const otherDeployment = s.fake.seed({ name: "studio:prod-env", createdAt: ago(ORPHAN_GRACE_MS * 10), workspaceId: "ws-prod" });
    expect(await runLlmSweepOnce(s.deps)).toMatchObject({ orphans: 1 });
    expect(s.fake.keys.has(old)).toBe(false);
    for (const h of [known, fresh, foreign, otherDeployment]) expect(s.fake.keys.has(h)).toBe(true);
  });

  it("never sweeps orphans without a workspace (staging and prod share the organisation)", async () => {
    const s = await setup({ workspaceId: null });
    s.fake.seed({ name: "studio:lost", createdAt: ago(ORPHAN_GRACE_MS * 10), workspaceId: null });
    expect(await runLlmSweepOnce(s.deps)).toMatchObject({ orphans: 0 });
    expect(s.fake.calls.some((c) => c.startsWith("listKeys"))).toBe(false);
  });

  it("isolates a failing row and never logs keys", async () => {
    const s = await setup({ budgets: { [holderDid()]: { allowed: true, budgetUsd: 45 } } });
    await s.held("e1");
    await s.held("e2");
    s.fake.failNext("updateKey", 500);
    expect(await runLlmSweepOnce(s.deps)).toMatchObject({ limited: 1, failed: 1 });
    for (const line of s.logs) expect(line).not.toMatch(/sk-or-|vault:v\d+:/);
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run subgraphs/vetra-llm/__tests__/sweeper.test.ts`

Expected: it fails with `Failed to resolve import "../sweeper.js"`.

- [ ] **Step 3: Implement**

`subgraphs/vetra-llm/sweeper.ts`:

```ts
import { withKeyLock } from "../../shared/key-lock.js";
import type { SecretsService } from "../vetra-cloud-secrets/services/secrets-service.js";
import type { KeyVault } from "../vetra-licensing/key-vault.js";
import type { StudioLlmBudget } from "../vetra-licensing/studio-access.js";
import { KEY_NAME_PREFIX, OPENROUTER_KEY_SECRET, llmLockKey, sameUsd } from "./broker.js";
import type { OpenRouterApi } from "./openrouter.js";
import { redactSecrets } from "./redact.js";
import type { LlmKeyStore } from "./store.js";

/** Like the Apps watcher. */
export const SWEEP_INTERVAL_MS = 15 * 60_000;
/**
 * A studio: key younger than this is never an orphan: provisionVetraKey mints
 * the key before it records the row, and a claim may still be in flight.
 */
export const ORPHAN_GRACE_MS = 30 * 60_000;

const RELEASED_STATUSES = new Set(["TERMINATING", "DESTROYED", "ARCHIVED"]);

export interface SweepDeps {
  store: LlmKeyStore;
  openrouter: OpenRouterApi;
  keyVault: KeyVault;
  secrets: Pick<SecretsService, "setSecret" | "deleteSecret">;
  budgetForDid(did: string): Promise<StudioLlmBudget>;
  /** The env's projection row; null when the env document is gone. */
  envOf(environmentId: string): Promise<{ tenantId: string | null; status: string | null } | null>;
  /** OPENROUTER_WORKSPACE_ID; without it the orphan rule never runs. */
  workspaceId: string | null;
  now(): Date;
  logger: Pick<Console, "info" | "warn" | "error">;
}

export interface SweepReport {
  deleted: number;
  disabled: number;
  enabled: number;
  limited: number;
  orphans: number;
  failed: number;
}

async function sweepRow(d: SweepDeps, environmentId: string, report: SweepReport): Promise<void> {
  // Re-read under the env lock: a provision may have changed it since listHeld.
  const row = await d.store.get(environmentId);
  if (!row || row.status === "DELETED" || !row.key_hash) return;
  const now = d.now().toISOString();

  const env = await d.envOf(environmentId);
  if (!env || (env.status !== null && RELEASED_STATUSES.has(env.status))) {
    await d.openrouter.deleteKey(row.key_hash);
    await d.store.update(environmentId, { status: "DELETED", key_ciphertext: null, updated_at: now });
    report.deleted += 1;
    return;
  }

  const budget = await d.budgetForDid(row.owner_did);
  if (!budget.allowed || budget.budgetUsd <= 0) {
    if (row.status === "ACTIVE") {
      await d.openrouter.updateKey(row.key_hash, { disabled: true });
      if (env.tenantId) await d.secrets.deleteSecret(env.tenantId, OPENROUTER_KEY_SECRET);
      await d.store.update(environmentId, { status: "DISABLED", updated_at: now });
      report.disabled += 1;
    }
    return;
  }

  if (row.status === "DISABLED") {
    await d.openrouter.updateKey(row.key_hash, { disabled: false, limitUsd: budget.budgetUsd });
    if (env.tenantId && row.key_ciphertext) {
      await d.secrets.setSecret(env.tenantId, OPENROUTER_KEY_SECRET, await d.keyVault.decrypt(row.key_ciphertext));
    }
    await d.store.update(environmentId, { status: "ACTIVE", limit_usd: budget.budgetUsd, updated_at: now });
    report.enabled += 1;
    return;
  }

  if (!sameUsd(row.limit_usd, budget.budgetUsd)) {
    await d.openrouter.updateKey(row.key_hash, { limitUsd: budget.budgetUsd });
    await d.store.update(environmentId, { limit_usd: budget.budgetUsd, updated_at: now });
    report.limited += 1;
  }
}

async function sweepOrphans(d: SweepDeps, workspaceId: string, report: SweepReport): Promise<void> {
  const known = new Set((await d.store.listHeld()).map((r) => r.key_hash));
  const cutoff = d.now().getTime() - ORPHAN_GRACE_MS;
  for (const key of await d.openrouter.listKeys({ workspaceId })) {
    if (!key.name.startsWith(KEY_NAME_PREFIX) || known.has(key.hash)) continue;
    const created = Date.parse(key.createdAt);
    if (!Number.isFinite(created) || created > cutoff) continue;
    try {
      await d.openrouter.deleteKey(key.hash);
      report.orphans += 1;
    } catch (err) {
      report.failed += 1;
      d.logger.warn(`[vetra-llm] orphan ${key.hash} not deleted: ${redactSecrets(String(err))}`);
    }
  }
}

/**
 * One pass of the lifecycle rules (spec "Lifecycle sweeper"):
 * - a deleted or released Studio → its key is deleted;
 * - a licence no longer usable → the key is disabled and the secret removed;
 * - a renewed licence → the key is re-enabled, its limit updated and the secret written back;
 * - a changed budget → the limit is PATCHed;
 * - `studio:` keys with no row → deleted, but only within this deployment's
 *   workspace and only once they are older than the grace window.
 *
 * Each row runs under the broker's env lock; one failing row never stops the pass.
 */
export async function runLlmSweepOnce(d: SweepDeps): Promise<SweepReport> {
  const report: SweepReport = { deleted: 0, disabled: 0, enabled: 0, limited: 0, orphans: 0, failed: 0 };
  for (const row of await d.store.listHeld()) {
    try {
      await withKeyLock(llmLockKey(row.environment_id), () => sweepRow(d, row.environment_id, report));
    } catch (err) {
      report.failed += 1;
      d.logger.warn(`[vetra-llm] sweep of ${row.environment_id} failed: ${redactSecrets(String(err))}`);
    }
  }
  if (d.workspaceId) await sweepOrphans(d, d.workspaceId, report);
  return report;
}
```

`subgraphs/vetra-llm/index.ts`:

1. Add `import { runLlmSweepOnce, SWEEP_INTERVAL_MS } from "./sweeper.js";`.
2. Change `const { broker, cfg } = createProcessBroker(...)` to `const { broker, cfg, openrouter, keyVault } = createProcessBroker(...)`.
3. At the end of `onSetup`, add:

```ts
    if (openrouter && keyVault && secrets) {
      let busy = false;
      const timer = setInterval(() => {
        if (busy) return;
        busy = true;
        runLlmSweepOnce({
          store: createLlmKeyStore(db),
          openrouter,
          keyVault,
          secrets,
          budgetForDid: (did) => studioLlmBudgetForDid(studio, did),
          envOf: async (environmentId) =>
            (await envDb
              .selectFrom("environments")
              .select(["tenantId", "status"])
              .where("id", "=", environmentId)
              .executeTakeFirst()) ?? null,
          workspaceId: cfg.workspaceId,
          now: () => new Date(),
          logger: console,
        })
          .then((r) => {
            if (r.deleted + r.disabled + r.enabled + r.limited + r.orphans + r.failed > 0) {
              console.info(`[vetra-llm] sweep: ${JSON.stringify(r)}`);
            }
          })
          .catch((err: unknown) => console.warn(`[vetra-llm] sweep failed: ${err instanceof Error ? err.name : "error"}`))
          .finally(() => {
            busy = false;
          });
      }, SWEEP_INTERVAL_MS);
      timer.unref?.();
      this.timers.push(timer);
      if (!cfg.workspaceId) console.warn("[vetra-llm] OPENROUTER_WORKSPACE_ID unset — orphan keys are not swept");
    }
```

   It also needs `import { createLlmKeyStore } from "./store.js";` and `import { studioLlmBudgetForDid } from "../vetra-licensing/studio-access.js";`.

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run subgraphs/vetra-llm && pnpm tsc && pnpm lint && pnpm exec oxfmt $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard)`

Expected: every `vetra-llm` suite passes, with 0 tsc and 0 lint errors.

- [ ] **Step 5: Commit**

```bash
git add subgraphs/vetra-llm
git commit -m "feat(llm): 15-minute lifecycle sweeper (deleted, lapsed, renewed, re-budgeted, orphan keys)"
```

---
### Task 9: Migration job `migrateStudiosToOpenRouter` (admin-only mutation) (vetra-cloud-package)

The existing admin pattern is `callerIsAdmin` (`shared/admins.ts:10-21`), which checks the `ADMINS` env and is used by the observability and apps resolvers. The migration is an admin-only GraphQL mutation built on it. It defaults to `dryRun: true`. With `removeAnthropicSecrets: true` it also performs cut-over step 4 (deleting the three Anthropic secrets).

**Files**

- Create: `subgraphs/vetra-llm/migrate.ts`
- Modify: `shared/studio-package.ts` (add `isStudioPackagesJson`)
- Modify: `subgraphs/vetra-llm/schema.ts` (`VetraLlmMutations` and the new report type)
- Modify: `subgraphs/vetra-llm/resolvers.ts` (`LlmResolverDeps.migrate` and the mutation)
- Modify: `subgraphs/vetra-llm/index.ts` (wire `migrate`)
- Test: `subgraphs/vetra-llm/__tests__/migrate.test.ts`
- Test: `subgraphs/vetra-llm/__tests__/resolvers.test.ts` (the `setup` deps and a new `describe`)
- Test: `shared/studio-package.test.ts`

**Interfaces**

- Consumes:
  - `LlmBroker.provisionVetraKey` (Task 5);
  - `studioLlmBudgetForDid` (Task 4);
  - `STUDIO_KEY_SECRET_NAMES` (`subgraphs/vetra-licensing/subscriptions-resolvers.ts:84-88`);
  - `didForAddress` (`did.ts:25`);
  - `callerIsAdmin`;
  - `SecretsService.deleteSecret` (`secrets-service.ts:102`).
- Produces:
  - `isStudioPackagesJson(raw: string | null): boolean`
  - `interface ClaimedStudio { id: string; tenantId: string; owner: string }`
  - `claimedStudiosFrom(rows: Array<{ id: string; tenantId: string | null; owner: string | null; status: string | null; packages: string | null }>): ClaimedStudio[]`
  - `interface MigrationReport { dryRun: boolean; scanned: number; provisioned: string[]; noBudget: string[]; noLicence: string[]; failed: string[]; anthropicSecretsRemoved: number }`
  - `migrateStudiosToOpenRouter(d: MigrationDeps, opts: { dryRun: boolean; removeAnthropicSecrets: boolean }): Promise<MigrationReport>`
  - GraphQL: `migrateStudiosToOpenRouter(dryRun: Boolean = true, removeAnthropicSecrets: Boolean = false): StudioLlmMigrationReport!` (admins only)

- [ ] **Step 1: Write the failing tests**

`subgraphs/vetra-llm/__tests__/migrate.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { claimedStudiosFrom, migrateStudiosToOpenRouter, type MigrationDeps } from "../migrate.js";
import { createFakeSecrets } from "./fakes.js";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const C = "0xcccccccccccccccccccccccccccccccccccccccc";
const D = "0xdddddddddddddddddddddddddddddddddddddddd";

function deps(over: Partial<MigrationDeps> = {}) {
  const secrets = createFakeSecrets();
  const d: MigrationDeps = {
    listClaimedStudios: async () => [
      { id: "budgeted", tenantId: "t-a", owner: A },
      { id: "no-budget", tenantId: "t-b", owner: B },
      { id: "lapsed", tenantId: "t-c", owner: C },
      { id: "broken", tenantId: "t-d", owner: D },
    ],
    budgetForDid: vi.fn(async (did: string) =>
      did.endsWith(A) || did.endsWith(D)
        ? { allowed: true, budgetUsd: 20 }
        : did.endsWith(B)
          ? { allowed: true, budgetUsd: 0 }
          : { allowed: false, budgetUsd: 0 },
    ),
    provision: vi.fn(async (i: { environmentId: string }) => {
      if (i.environmentId === "broken") throw new Error("openrouter down sk-or-v1-leak");
      return { connected: true, llmBudgetUsd: 20 };
    }),
    secrets,
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...over,
  };
  return { d, secrets };
}

describe("migrateStudiosToOpenRouter", () => {
  it("dry run: classifies every Studio and provisions nothing", async () => {
    const { d } = deps();
    expect(await migrateStudiosToOpenRouter(d, { dryRun: true, removeAnthropicSecrets: true })).toStrictEqual({
      dryRun: true,
      scanned: 4,
      provisioned: ["budgeted", "broken"],
      noBudget: ["no-budget"],
      noLicence: ["lapsed"],
      failed: [],
      anthropicSecretsRemoved: 0,
    });
    expect(d.provision).not.toHaveBeenCalled();
  });

  it("provisions budgeted Studios with the owner's DID, isolates failures and never logs keys", async () => {
    const { d } = deps();
    const r = await migrateStudiosToOpenRouter(d, { dryRun: false, removeAnthropicSecrets: false });
    expect(r).toMatchObject({ provisioned: ["budgeted"], noBudget: ["no-budget"], noLicence: ["lapsed"], failed: ["broken"] });
    expect(d.provision).toHaveBeenCalledWith({
      environmentId: "budgeted",
      tenantId: "t-a",
      ownerDid: `did:pkh:eip155:1:${A}`,
    });
    const logged = vi.mocked(d.logger.warn).mock.calls.flat().join("\n");
    expect(logged).not.toMatch(/sk-or-/);
  });

  it("removes the three Anthropic secrets from every scanned Studio when asked (cut-over step 4)", async () => {
    const { d, secrets } = deps();
    for (const t of ["t-a", "t-b"]) {
      for (const n of ["ANTHROPIC_API_KEY", "VETRA_ANTHROPIC_API_KEY", "VETRA_CLI_ANTHROPIC_API_KEY"]) {
        await secrets.setSecret(t, n, "sk-ant-x");
      }
    }
    const r = await migrateStudiosToOpenRouter(d, { dryRun: false, removeAnthropicSecrets: true });
    expect(r.anthropicSecretsRemoved).toBe(6);
    expect(secrets.secret("t-a", "ANTHROPIC_API_KEY")).toBeUndefined();
  });
});

describe("claimedStudiosFrom", () => {
  it("keeps owned, live Studio rows with a tenant", () => {
    const studio = JSON.stringify([{ name: "vetra", version: "1" }]);
    expect(
      claimedStudiosFrom([
        { id: "ok", tenantId: "t1", owner: "0xAA", status: "READY", packages: studio },
        { id: "unclaimed", tenantId: "t2", owner: null, status: "READY", packages: studio },
        { id: "released", tenantId: "t3", owner: "0xaa", status: "DESTROYED", packages: studio },
        { id: "not-studio", tenantId: "t4", owner: "0xaa", status: "READY", packages: JSON.stringify([{ name: "x" }]) },
        { id: "no-tenant", tenantId: null, owner: "0xaa", status: "READY", packages: studio },
      ]),
    ).toStrictEqual([{ id: "ok", tenantId: "t1", owner: "0xaa" }]);
  });
});
```

Append to `shared/studio-package.test.ts` (and import `isStudioPackagesJson`):

```ts
describe("isStudioPackagesJson", () => {
  it("reads the projection's packages column", () => {
    expect(isStudioPackagesJson(JSON.stringify([{ name: "vetra-cli", version: "1" }]))).toBe(true);
    expect(isStudioPackagesJson(JSON.stringify([{ name: "x" }]))).toBe(false);
    expect(isStudioPackagesJson("not json")).toBe(false);
    expect(isStudioPackagesJson(null)).toBe(false);
  });
});
```

`subgraphs/vetra-llm/__tests__/resolvers.test.ts`:

- In `setup()`'s `createLlmResolvers({...})`, add `migrate: vi.fn(async (o: { dryRun: boolean; removeAnthropicSecrets: boolean }) => ({ dryRun: o.dryRun, scanned: 0, provisioned: [], noBudget: [], noLicence: [], failed: [], anthropicSecretsRemoved: 0 })),` before `...over`.
- Append:

```ts
describe("migrateStudiosToOpenRouter", () => {
  afterEach(() => {
    delete process.env.ADMINS;
  });

  it("is for platform admins only and defaults to a dry run", async () => {
    process.env.ADMINS = OWNER;
    const s = await setup();
    const m = s.r.VetraLlmMutations.migrateStudiosToOpenRouter;
    expect(await s.code(m({}, {}, asUser(STRANGER)))).toBe("FORBIDDEN");
    expect(await m({}, {}, asUser(OWNER))).toMatchObject({ dryRun: true });
    expect(await m({}, { dryRun: false, removeAnthropicSecrets: true }, asUser(OWNER))).toMatchObject({ dryRun: false });
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm vitest run subgraphs/vetra-llm/__tests__/migrate.test.ts subgraphs/vetra-llm/__tests__/resolvers.test.ts shared/studio-package.test.ts`

Expected:
- `Failed to resolve import "../migrate.js"`;
- `isStudioPackagesJson is not a function`;
- the resolvers case fails with `Cannot read properties of undefined (reading 'migrateStudiosToOpenRouter')` / `not a function`.

- [ ] **Step 3: Implement**

Append to `shared/studio-package.ts`:

```ts
/** The environments projection's `packages` column (JSON array of { name, version }) names the studio agent. */
export function isStudioPackagesJson(raw: string | null): boolean {
  try {
    const parsed = JSON.parse(raw ?? "[]") as unknown;
    return Array.isArray(parsed) && parsed.some((p) => isStudioAgentPackage((p as { name?: string })?.name));
  } catch {
    return false;
  }
}
```

`subgraphs/vetra-llm/migrate.ts`:

```ts
import { isStudioPackagesJson } from "../../shared/studio-package.js";
import type { SecretsService } from "../vetra-cloud-secrets/services/secrets-service.js";
import { didForAddress } from "../vetra-licensing/did.js";
import type { StudioLlmBudget } from "../vetra-licensing/studio-access.js";
import { STUDIO_KEY_SECRET_NAMES } from "../vetra-licensing/subscriptions-resolvers.js";
import type { ProvisionResult } from "./broker.js";
import { redactSecrets } from "./redact.js";

const RELEASED_STATUSES = new Set(["TERMINATING", "DESTROYED", "ARCHIVED"]);

export interface ClaimedStudio {
  id: string;
  tenantId: string;
  /** Lowercased owner address. */
  owner: string;
}

/** Owned, live Studio rows of the environments projection (warm pool envs are owner-null). */
export function claimedStudiosFrom(
  rows: Array<{ id: string; tenantId: string | null; owner: string | null; status: string | null; packages: string | null }>,
): ClaimedStudio[] {
  return rows.flatMap((r) =>
    r.owner && r.tenantId && !(r.status && RELEASED_STATUSES.has(r.status)) && isStudioPackagesJson(r.packages)
      ? [{ id: r.id, tenantId: r.tenantId, owner: r.owner.toLowerCase() }]
      : [],
  );
}

export interface MigrationDeps {
  listClaimedStudios(): Promise<ClaimedStudio[]>;
  budgetForDid(did: string): Promise<StudioLlmBudget>;
  provision(input: { environmentId: string; tenantId: string; ownerDid: string }): Promise<ProvisionResult>;
  secrets: Pick<SecretsService, "deleteSecret"> | null;
  logger: Pick<Console, "info" | "warn" | "error">;
}

export interface MigrationReport {
  dryRun: boolean;
  scanned: number;
  /** Provisioned (or, in a dry run, would be). */
  provisioned: string[];
  /** Usable licence, budget 0: connect-a-model mode. */
  noBudget: string[];
  /** No usable studio licence: the sweeper leaves them alone, the card says connect a model. */
  noLicence: string[];
  failed: string[];
  anthropicSecretsRemoved: number;
}

/**
 * Cut-over (spec "Migration and cut-over"):
 * - step 2: give every live, claimed Studio with a usable licence its Vetra
 *   key; the Anthropic secrets stay, so both are present;
 * - step 4 (`removeAnthropicSecrets`, after verification): delete the three
 *   Anthropic secret names.
 *
 * Idempotent: provisioning reuses an env's key, and a missing secret is a no-op.
 */
export async function migrateStudiosToOpenRouter(
  d: MigrationDeps,
  opts: { dryRun: boolean; removeAnthropicSecrets: boolean },
): Promise<MigrationReport> {
  const report: MigrationReport = {
    dryRun: opts.dryRun,
    scanned: 0,
    provisioned: [],
    noBudget: [],
    noLicence: [],
    failed: [],
    anthropicSecretsRemoved: 0,
  };
  for (const s of await d.listClaimedStudios()) {
    report.scanned += 1;
    try {
      const ownerDid = didForAddress(s.owner);
      const budget = await d.budgetForDid(ownerDid);
      if (!budget.allowed) report.noLicence.push(s.id);
      else if (budget.budgetUsd <= 0) report.noBudget.push(s.id);
      else if (opts.dryRun) report.provisioned.push(s.id);
      else {
        const res = await d.provision({ environmentId: s.id, tenantId: s.tenantId, ownerDid });
        (res.connected ? report.provisioned : report.noBudget).push(s.id);
      }
      if (opts.removeAnthropicSecrets && !opts.dryRun && d.secrets) {
        for (const name of STUDIO_KEY_SECRET_NAMES) {
          if (await d.secrets.deleteSecret(s.tenantId, name)) report.anthropicSecretsRemoved += 1;
        }
      }
    } catch (err) {
      report.failed.push(s.id);
      d.logger.warn(`[vetra-llm] migrate ${s.id} failed: ${redactSecrets(String(err))}`);
    }
  }
  d.logger.info(`[vetra-llm] migrateStudiosToOpenRouter: ${JSON.stringify({ ...report, dryRun: opts.dryRun })}`);
  return report;
}
```

`subgraphs/vetra-llm/schema.ts`:

- Add before `type VetraLlmQueries`:

```graphql
  type StudioLlmMigrationReport {
    dryRun: Boolean!
    scanned: Int!
    provisioned: [String!]!
    noBudget: [String!]!
    noLicence: [String!]!
    failed: [String!]!
    anthropicSecretsRemoved: Int!
  }
```

- Add to `type VetraLlmMutations`:

```graphql
    "Platform admins only. Gives every live, claimed Studio with a usable licence its Vetra key; removeAnthropicSecrets also deletes the three Anthropic secrets (cut-over step 4)."
    migrateStudiosToOpenRouter(dryRun: Boolean = true, removeAnthropicSecrets: Boolean = false): StudioLlmMigrationReport!
```

`subgraphs/vetra-llm/resolvers.ts`:

- Add `import type { MigrationReport } from "./migrate.js";`.
- Add to `LlmResolverDeps`: `migrate(opts: { dryRun: boolean; removeAnthropicSecrets: boolean }): Promise<MigrationReport>;`.
- Add to `VetraLlmMutations`:

```ts
      migrateStudiosToOpenRouter: wrap(
        async (a: { dryRun?: boolean | null; removeAnthropicSecrets?: boolean | null }, ctx) => {
          const caller = requireCaller(ctx);
          if (!caller.isAdmin) throw llmError("FORBIDDEN", "platform admins only");
          return deps.migrate({
            dryRun: a.dryRun ?? true,
            removeAnthropicSecrets: a.removeAnthropicSecrets ?? false,
          });
        },
      ),
```

`subgraphs/vetra-llm/index.ts`:

- Add `import { claimedStudiosFrom, migrateStudiosToOpenRouter } from "./migrate.js";` and `import { studioLlmBudgetForDid } from "../vetra-licensing/studio-access.js";` (skip the second if Task 8 already added it).
- In the `createLlmResolvers({...})` call, add:

```ts
      migrate: (opts) =>
        migrateStudiosToOpenRouter(
          {
            listClaimedStudios: async () =>
              claimedStudiosFrom(
                await envDb
                  .selectFrom("environments")
                  .select(["id", "tenantId", "owner", "status", "packages"])
                  .where("owner", "is not", null)
                  .where("tenantId", "is not", null)
                  .execute(),
              ),
            budgetForDid: (did) => studioLlmBudgetForDid(studio, did),
            provision: (input) => broker.provisionVetraKey(input),
            secrets,
            logger: console,
          },
          opts,
        ),
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm vitest run && pnpm tsc && pnpm lint && pnpm exec oxfmt $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard)`

Expected: the whole `vetra-cloud-package` suite passes. This is the full gate for Tasks 1–9. tsc and lint report 0 errors.

- [ ] **Step 5: Commit**

```bash
git add shared subgraphs/vetra-llm
git commit -m "feat(llm): admin-only migrateStudiosToOpenRouter (dry run by default, optional Anthropic secret removal)"
```

---
### Task 10: `llm.ts` factory and OpenRouter config (vetra-cli)

**Files**

- Modify: `vetra-cli/package.json` (devDependencies: add `"@openrouter/ai-sdk-provider": "1.5.4"`)
- Create: `vetra-cli/src/agents/llm.ts`
- Modify: `vetra-cli/src/framework.ts`:
  - `:19` and `:22`: model defaults;
  - after `:47`: new config fields;
  - after `:53`: the `openrouterApiKey` secret.
- Test: `vetra-cli/tests/agents/llm.test.ts`
- Test: `vetra-cli/tests/framework-config.test.ts` (append)
- Test (live, gated): `vetra-cli/tests/agent-eval/openrouter-cache.eval.test.ts`

**Interfaces**

- Consumes:
  - `createOpenRouter` and `OpenRouterProviderSettings` from `@openrouter/ai-sdk-provider@1.5.4` (`dist/index.d.ts:469-510`: `apiKey`, `headers`, `compatibility`, `fetch`);
  - `provider.chat(modelId, { usage, extraBody })`;
  - `Config` (`src/framework.ts:56-57`).
- Produces:
  - `OPENROUTER_ATTRIBUTION_HEADERS`
  - `OPENROUTER_MODELS_URL`
  - `DEFAULT_CONTEXT_LENGTH = 200_000`
  - `CONTEXT_LIMIT_RATIO = 0.8`
  - `MAX_FALLBACKS = 3`
  - `interface LlmSettings { apiKey: string; model: string; subagentModel: string; memoryModel: string; fallbacks: string[]; allowDataCollection: boolean }`
  - `type LlmConfigInput`
  - `resolveOpenRouterKey(config, env?): string | undefined`
  - `parseFallbacks(raw?: string): string[]`
  - `usesAnthropicCache(modelId: string): boolean`
  - `requestExtras(modelId: string, s: { fallbacks: string[]; allowDataCollection: boolean }): Record<string, unknown>`
  - `resolveLlmSettings(config: LlmConfigInput, env?): LlmSettings | null`
  - `createLlmModels(s: LlmSettings, opts?: { fetch?: typeof fetch }): { main; subagent; memory }`
  - `resolveContextTokenLimit(modelId: string, opts?: { fetch?: typeof fetch; timeoutMs?: number }): Promise<number>`
  - `clearContextLimitCache(): void`
  - Config fields:
    - `subagentModel?: string` (`VETRA_SUBAGENT_MODEL`)
    - `modelFallbacks?: string` (`VETRA_MODEL_FALLBACKS`)
    - `llmAllowDataCollection: boolean` (`VETRA_LLM_ALLOW_DATA_COLLECTION`)
    - `openrouterApiKey?: string` (`VETRA_OPENROUTER_API_KEY`, plus `OPENROUTER_API_KEY` through `resolveOpenRouterKey`)

- [ ] **Step 1: Write the failing tests**

`vetra-cli/tests/agents/llm.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "@jest/globals";
import {
  CONTEXT_LIMIT_RATIO,
  DEFAULT_CONTEXT_LENGTH,
  OPENROUTER_ATTRIBUTION_HEADERS,
  clearContextLimitCache,
  createLlmModels,
  parseFallbacks,
  requestExtras,
  resolveContextTokenLimit,
  resolveLlmSettings,
  resolveOpenRouterKey,
  type LlmSettings,
} from "../../src/agents/llm.js";

const BASE = { model: "anthropic/claude-sonnet-4.6", memoryModel: "anthropic/claude-haiku-4.5", llmAllowDataCollection: false };

function captureFetch() {
  const calls: { url: string; headers: Headers; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers as HeadersInit), body: JSON.parse(String(init?.body)) as Record<string, unknown> });
    return new Response(
      JSON.stringify({
        id: "gen-1",
        object: "chat.completion",
        created: 0,
        model: "anthropic/claude-sonnet-4.6",
        choices: [{ index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const PROMPT = [{ role: "user" as const, content: [{ type: "text" as const, text: "hi" }] }];

describe("resolveOpenRouterKey / resolveLlmSettings", () => {
  it("reads the bare OPENROUTER_API_KEY the broker writes (Review Focus 2)", () => {
    expect(resolveOpenRouterKey({}, { OPENROUTER_API_KEY: "sk-or-v1-broker" })).toBe("sk-or-v1-broker");
    expect(resolveLlmSettings(BASE, { OPENROUTER_API_KEY: "sk-or-v1-broker" })?.apiKey).toBe("sk-or-v1-broker");
  });

  it("prefers the configured key (VETRA_OPENROUTER_API_KEY / config files) and ignores blanks", () => {
    expect(resolveOpenRouterKey({ openrouterApiKey: "sk-or-v1-cfg" }, { OPENROUTER_API_KEY: "sk-or-v1-env" })).toBe("sk-or-v1-cfg");
    expect(resolveOpenRouterKey({ openrouterApiKey: "  " }, { OPENROUTER_API_KEY: " " })).toBeUndefined();
  });

  it("is null without a key, and never reads an Anthropic key", () => {
    expect(resolveLlmSettings(BASE, {})).toBeNull();
    expect(resolveLlmSettings(BASE, { VETRA_ANTHROPIC_API_KEY: "sk-ant-x", ANTHROPIC_API_KEY: "sk-ant-y" })).toBeNull();
  });

  it("defaults the sub-agent to the main model and caps fallbacks at 3", () => {
    const s = resolveLlmSettings(
      { ...BASE, modelFallbacks: "openai/gpt-5, google/gemini-3-pro ,x/a,x/b", openrouterApiKey: "k" },
      {},
    )!;
    expect(s.subagentModel).toBe("anthropic/claude-sonnet-4.6");
    expect(s.fallbacks).toStrictEqual(["openai/gpt-5", "google/gemini-3-pro", "x/a"]);
    expect(resolveLlmSettings({ ...BASE, subagentModel: "x/sub", openrouterApiKey: "k" }, {})!.subagentModel).toBe("x/sub");
    expect(parseFallbacks(undefined)).toStrictEqual([]);
  });
});

describe("requestExtras", () => {
  it("denies data collection by default and allows it only when configured", () => {
    expect(requestExtras("openai/gpt-5", { fallbacks: [], allowDataCollection: false })).toStrictEqual({
      provider: { data_collection: "deny" },
    });
    expect(requestExtras("openai/gpt-5", { fallbacks: [], allowDataCollection: true }).provider).toStrictEqual({
      data_collection: "allow",
    });
  });

  it("sends fallbacks as models [primary, ...fallbacks] without repeating the primary", () => {
    expect(requestExtras("openai/gpt-5", { fallbacks: ["openai/gpt-5", "x/a"], allowDataCollection: false }).models).toStrictEqual([
      "openai/gpt-5",
      "x/a",
    ]);
  });

  it("turns on Anthropic prompt caching only for anthropic/ models", () => {
    expect(requestExtras("anthropic/claude-sonnet-4.6", { fallbacks: [], allowDataCollection: false }).cache_control).toStrictEqual({
      type: "ephemeral",
    });
    expect(requestExtras("openai/gpt-5", { fallbacks: [], allowDataCollection: false })).not.toHaveProperty("cache_control");
  });
});

describe("createLlmModels", () => {
  const settings: LlmSettings = {
    apiKey: "sk-or-v1-test",
    model: "anthropic/claude-sonnet-4.6",
    subagentModel: "openai/gpt-5",
    memoryModel: "anthropic/claude-haiku-4.5",
    fallbacks: ["openai/gpt-5"],
    allowDataCollection: false,
  };

  it("sends the key, the attribution headers, privacy, fallbacks, caching and usage accounting", async () => {
    const { calls, fetchImpl } = captureFetch();
    const models = createLlmModels(settings, { fetch: fetchImpl });
    await models.main.doGenerate({ prompt: PROMPT } as unknown as Parameters<typeof models.main.doGenerate>[0]);
    const [call] = calls;
    expect(call.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(call.headers.get("authorization")).toBe("Bearer sk-or-v1-test");
    expect(call.headers.get("http-referer")).toBe("https://vetra.io");
    expect(call.headers.get("x-openrouter-title")).toBe("Vetra Studio");
    expect(OPENROUTER_ATTRIBUTION_HEADERS).toStrictEqual({ "HTTP-Referer": "https://vetra.io", "X-OpenRouter-Title": "Vetra Studio" });
    expect(call.body).toMatchObject({
      model: "anthropic/claude-sonnet-4.6",
      provider: { data_collection: "deny" },
      models: ["anthropic/claude-sonnet-4.6", "openai/gpt-5"],
      cache_control: { type: "ephemeral" },
      usage: { include: true },
    });
  });

  it("builds the sub-agent and memory models on their own ids; memory gets no fallbacks", async () => {
    const { calls, fetchImpl } = captureFetch();
    const models = createLlmModels(settings, { fetch: fetchImpl });
    await models.subagent.doGenerate({ prompt: PROMPT } as unknown as Parameters<typeof models.subagent.doGenerate>[0]);
    await models.memory.doGenerate({ prompt: PROMPT } as unknown as Parameters<typeof models.memory.doGenerate>[0]);
    expect(calls[0].body.model).toBe("openai/gpt-5");
    expect(calls[0].body).not.toHaveProperty("cache_control");
    expect(calls[1].body.model).toBe("anthropic/claude-haiku-4.5");
    expect(calls[1].body).not.toHaveProperty("models");
  });
});

describe("resolveContextTokenLimit", () => {
  beforeEach(() => clearContextLimitCache());

  it("uses 80% of the model's context_length, fetched once per model", async () => {
    let n = 0;
    const fetchImpl = (async () => {
      n += 1;
      return new Response(JSON.stringify({ data: [{ id: "anthropic/claude-haiku-4.5", context_length: 200000 }] }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await resolveContextTokenLimit("anthropic/claude-haiku-4.5", { fetch: fetchImpl })).toBe(160_000);
    expect(await resolveContextTokenLimit("anthropic/claude-haiku-4.5", { fetch: fetchImpl })).toBe(160_000);
    expect(n).toBe(1);
  });

  it("falls back to 80% of 200k when the list is unreachable or lacks the model", async () => {
    const down = (async () => Promise.reject(new Error("offline"))) as unknown as typeof fetch;
    expect(await resolveContextTokenLimit("x/unknown", { fetch: down })).toBe(Math.floor(DEFAULT_CONTEXT_LENGTH * CONTEXT_LIMIT_RATIO));
    clearContextLimitCache();
    const empty = (async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as unknown as typeof fetch;
    expect(await resolveContextTokenLimit("x/unknown", { fetch: empty })).toBe(160_000);
  });
});
```

Append to `vetra-cli/tests/framework-config.test.ts`. Also change its import to `import { configSchema, secretsSchema } from "../src/framework.js";`.

```ts
describe("OpenRouter config", () => {
  it("defaults the main and memory models to verified OpenRouter ids", () => {
    const c = configSchema.parse({});
    expect(c.model).toBe("anthropic/claude-sonnet-4.6");
    expect(c.memoryModel).toBe("anthropic/claude-haiku-4.5");
    expect(c.subagentModel).toBeUndefined();
    expect(c.modelFallbacks).toBeUndefined();
    expect(c.llmAllowDataCollection).toBe(false);
  });

  it("coerces VETRA_LLM_ALLOW_DATA_COLLECTION strings", () => {
    expect(configSchema.parse({ llmAllowDataCollection: "true" }).llmAllowDataCollection).toBe(true);
    expect(configSchema.parse({ llmAllowDataCollection: "false" }).llmAllowDataCollection).toBe(false);
  });

  it("declares openrouterApiKey as a secret", () => {
    expect(secretsSchema.parse({ openrouterApiKey: "sk-or-v1-x" }).openrouterApiKey).toBe("sk-or-v1-x");
  });
});
```

`vetra-cli/tests/agent-eval/openrouter-cache.eval.test.ts`:

```ts
/**
 * Live eval (costs real OpenRouter credits): Anthropic prompt caching through
 * OpenRouter, the top-level cache_control that llm.ts sends for anthropic/
 * models. Opt in with:
 *   RUN_AGENT_EVALS=1 OPENROUTER_API_KEY=sk-or-... pnpm --filter vetra-cli test -- tests/agent-eval/openrouter-cache.eval.test.ts
 */
import { describe, it, expect } from "@jest/globals";
import { createLlmModels, resolveLlmSettings } from "../../src/agents/llm.js";

const optedIn = process.env.RUN_AGENT_EVALS === "1";
const describeIfEnabled = optedIn ? describe : describe.skip;

describeIfEnabled("live eval: Anthropic prompt caching through OpenRouter", () => {
  it(
    "reports cached input tokens on the second identical turn",
    async () => {
      const settings = resolveLlmSettings({
        model: "anthropic/claude-sonnet-4.6",
        memoryModel: "anthropic/claude-haiku-4.5",
        llmAllowDataCollection: false,
      });
      if (!settings) throw new Error("set OPENROUTER_API_KEY to run this eval");
      const { main } = createLlmModels(settings);
      // Well above Sonnet's minimum cacheable prefix (1024 tokens).
      const system = "You are terse. Reference: " + "lorem ipsum dolor sit amet consectetur. ".repeat(400);
      const call = () =>
        main.doGenerate({
          prompt: [
            { role: "system", content: system },
            { role: "user", content: [{ type: "text", text: "Reply with OK." }] },
          ],
        } as unknown as Parameters<typeof main.doGenerate>[0]);
      await call();
      const second = await call();
      expect(second.usage.cachedInputTokens ?? 0).toBeGreaterThan(0);
    },
    120_000,
  );
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm --filter vetra-cli test -- tests/agents/llm.test.ts tests/framework-config.test.ts`

Expected:
- `llm.test.ts` fails with `Cannot find module '../../src/agents/llm.js'`;
- `framework-config.test.ts` fails with `expected "anthropic/claude-sonnet-4-6" to be "anthropic/claude-sonnet-4.6"` and on the missing `llmAllowDataCollection`.

- [ ] **Step 3: Implement**

Run `pnpm --filter vetra-cli add -D @openrouter/ai-sdk-provider@1.5.4`. 1.5.4 is the last release on the AI SDK v5 / provider-spec v2 line, the same as `@ai-sdk/anthropic@2`. 2.x needs `ai@6` and 3.x needs `ai@7`. Then:
- run `pnpm --filter vetra-cli check:deps`; it must report `0 declared runtime deps` (the package is bundled by tsdown, as `@ai-sdk/anthropic` is);
- the pnpm "missing peer ai@^5" warning is expected: the 1.5.4 dist imports only `zod` (checked in its `dist/index.mjs`).

`vetra-cli/src/agents/llm.ts`:

```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { Config } from '../framework.js';

/**
 * Every Mastra model of the agent (main, sub-agents, observational memory)
 * comes from here. OpenRouter is the only provider; the OpenRouter key is the
 * only credential the agent reads.
 */

/** App attribution on every OpenRouter request (header names verified in openrouter.ai/openapi.yaml). */
export const OPENROUTER_ATTRIBUTION_HEADERS = {
  'HTTP-Referer': 'https://vetra.io',
  'X-OpenRouter-Title': 'Vetra Studio',
} as const;
export const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';
export const DEFAULT_CONTEXT_LENGTH = 200_000;
export const CONTEXT_LIMIT_RATIO = 0.8;
export const MAX_FALLBACKS = 3;

export interface LlmSettings {
  apiKey: string;
  model: string;
  subagentModel: string;
  memoryModel: string;
  fallbacks: string[];
  allowDataCollection: boolean;
}

export type LlmConfigInput = Pick<Config, 'model' | 'memoryModel' | 'llmAllowDataCollection'> &
  Partial<Pick<Config, 'subagentModel' | 'modelFallbacks' | 'openrouterApiKey'>>;

/**
 * The OpenRouter key: the configured one (VETRA_OPENROUTER_API_KEY, or the
 * local/user config files setup-auth writes), else the bare
 * OPENROUTER_API_KEY the vetra-llm broker writes into the Studio's tenant
 * secrets (ph-clint only maps VETRA_-prefixed env names onto config fields).
 */
export function resolveOpenRouterKey(
  config: Pick<Partial<Config>, 'openrouterApiKey'>,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const key = config.openrouterApiKey?.trim() || env.OPENROUTER_API_KEY?.trim();
  return key ? key : undefined;
}

export function parseFallbacks(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_FALLBACKS);
}

/** Anthropic prompt caching only applies to Anthropic models. */
export function usesAnthropicCache(modelId: string): boolean {
  return modelId.startsWith('anthropic/');
}

/**
 * The OpenRouter request extras for one model:
 * - provider preferences (privacy: no data collection unless allowed);
 * - fallbacks as `models` [primary, ...fallbacks];
 * - for anthropic/ models, top-level `cache_control`, which turns on automatic
 *   prompt caching (openapi.yaml AnthropicCacheControlDirective).
 *
 * ph-clint's wrapAgent cacheControl is NOT used: it sets
 * providerOptions.anthropic at call level, which the OpenRouter provider ignores.
 */
export function requestExtras(
  modelId: string,
  s: Pick<LlmSettings, 'fallbacks' | 'allowDataCollection'>,
): Record<string, unknown> {
  const extras: Record<string, unknown> = {
    provider: { data_collection: s.allowDataCollection ? 'allow' : 'deny' },
  };
  const fallbacks = s.fallbacks.filter((f) => f !== modelId);
  if (fallbacks.length > 0) extras.models = [modelId, ...fallbacks];
  if (usesAnthropicCache(modelId)) extras.cache_control = { type: 'ephemeral' };
  return extras;
}

/** Null when no OpenRouter key is configured: the agent then serves in connect-a-model mode. */
export function resolveLlmSettings(
  config: LlmConfigInput,
  env: Record<string, string | undefined> = process.env,
): LlmSettings | null {
  const apiKey = resolveOpenRouterKey(config, env);
  if (!apiKey) return null;
  return {
    apiKey,
    model: config.model,
    subagentModel: config.subagentModel?.trim() || config.model,
    memoryModel: config.memoryModel,
    fallbacks: parseFallbacks(config.modelFallbacks),
    allowDataCollection: config.llmAllowDataCollection === true,
  };
}

export function createLlmModels(s: LlmSettings, opts: { fetch?: typeof fetch } = {}) {
  const provider = createOpenRouter({
    apiKey: s.apiKey,
    headers: { ...OPENROUTER_ATTRIBUTION_HEADERS },
    // strict: send stream_options so usage (incl. usage.cost) arrives in the last SSE chunk.
    compatibility: 'strict',
    ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });
  const make = (modelId: string, fallbacks: string[]) =>
    provider.chat(modelId, {
      usage: { include: true },
      extraBody: requestExtras(modelId, { fallbacks, allowDataCollection: s.allowDataCollection }),
    });
  return {
    main: make(s.model, s.fallbacks),
    subagent: make(s.subagentModel, s.fallbacks),
    // Observational memory runs in the background: no fallbacks.
    memory: make(s.memoryModel, []),
  };
}

const contextLimits = new Map<string, number>();

/**
 * The TokenLimiterProcessor ceiling for a model: 80% of its OpenRouter
 * context_length (fetched once per model per process, public endpoint, no
 * key), else 80% of 200k when the list is unreachable or lacks the model.
 */
export async function resolveContextTokenLimit(
  modelId: string,
  opts: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<number> {
  const cached = contextLimits.get(modelId);
  if (cached !== undefined) return cached;
  let contextLength = DEFAULT_CONTEXT_LENGTH;
  try {
    const res = await (opts.fetch ?? fetch)(OPENROUTER_MODELS_URL, {
      signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000),
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: Array<{ id?: unknown; context_length?: unknown }> };
      const hit = body.data?.find((m) => m.id === modelId);
      if (typeof hit?.context_length === 'number' && hit.context_length > 0) contextLength = hit.context_length;
    }
  } catch {
    // Offline or slow: keep the fallback.
  }
  const limit = Math.floor(contextLength * CONTEXT_LIMIT_RATIO);
  contextLimits.set(modelId, limit);
  return limit;
}

export function clearContextLimitCache(): void {
  contextLimits.clear();
}
```

`vetra-cli/src/framework.ts`:

- `:19`: change the `model` default to `'anthropic/claude-sonnet-4.6'` and its description to `'OpenRouter model id for the main agent (env VETRA_MODEL)'`.
- `:22`: change the `memoryModel` default to `'anthropic/claude-haiku-4.5'` (description unchanged).
- After the `packageManager` field (ends `:47`), before `});`, add:

```ts
  subagentModel: z
    .string()
    .optional()
    .describe('OpenRouter model id for the sub-agents (env VETRA_SUBAGENT_MODEL); defaults to the main model'),
  modelFallbacks: z
    .string()
    .optional()
    .describe('Comma list of up to 3 OpenRouter fallback model ids (env VETRA_MODEL_FALLBACKS)'),
  llmAllowDataCollection: z
    .preprocess((v) => (typeof v === 'string' ? v === 'true' : v), z.boolean())
    .default(false)
    .describe('Allow OpenRouter providers that may collect prompt data (env VETRA_LLM_ALLOW_DATA_COLLECTION); default deny'),
```

- In `secretsSchema`, after the `// @clint:end framework-secrets` line (`:53`), add:

```ts
  openrouterApiKey: z
    .string()
    .optional()
    .describe('OpenRouter API key (env VETRA_OPENROUTER_API_KEY; a bare OPENROUTER_API_KEY is read too)'),
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm --filter vetra-cli test -- tests/agents/llm.test.ts tests/framework-config.test.ts tests/agent-eval/openrouter-cache.eval.test.ts && pnpm --filter vetra-cli typecheck && pnpm --filter vetra-cli lint && pnpm --filter vetra-cli check:deps`

Expected:
- `llm.test.ts` and `framework-config.test.ts` pass;
- the live eval is reported as skipped (no `RUN_AGENT_EVALS`);
- typecheck and lint are clean;
- `check:deps` prints `ok`.

The live caching check needs a funded key, so it runs in Task 14, step 5. Its pass criterion is `cachedInputTokens > 0` on the second turn.

- [ ] **Step 5: Commit**

```bash
git add vetra-cli/package.json pnpm-lock.yaml vetra-cli/src/agents/llm.ts vetra-cli/src/framework.ts vetra-cli/tests/agents/llm.test.ts vetra-cli/tests/framework-config.test.ts vetra-cli/tests/agent-eval/openrouter-cache.eval.test.ts
git commit -m "feat(agent): OpenRouter model factory (privacy default, fallbacks, Anthropic cache gating, context limit)"
```

---

### Task 11: Agent on OpenRouter, no-key mode, no hold loop (vetra-cli)

**Files**

- Create: `vetra-cli/src/agents/agent-image.ts` (the avatar data URI, moved out of `demo-agent.ts:14`)
- Create: `vetra-cli/src/agents/no-model-agent.ts`
- Delete: `vetra-cli/src/agents/demo-agent.ts`, `vetra-cli/src/agents/require-key.ts`, `vetra-cli/tests/agents/require-key.test.ts`
- Modify: `vetra-cli/src/agents/agent.ts` (whole file, 149 lines; rewritten below)
- Modify: `vetra-cli/src/framework.ts:21` (drop `requireApiKey`)
- Modify: `vetra-cli/Dockerfile:203-211` (drop the require-key default and the hold loop)
- Modify: `vetra-cli/src/setup-auth.ts` (whole file, 180 lines; rewritten below)
- Modify: `vetra-cli/src/main.ts:7,9` (`ensureModelAuth`)
- Modify: `vetra-cli/src/mastra/index.ts:21-26` (bridge `OPENROUTER_API_KEY`)
- Modify: `vetra-cli/src/commands/agent-run.ts:41,46` (error text)
- Modify: `vetra-cli/powerhouse.manifest.json`:
  - `:11`: the model id;
  - `:37-42`: the key entry.
- Test: `vetra-cli/tests/agents/no-model-agent.test.ts`
- Test: `vetra-cli/tests/framework-config.test.ts:4-23` (delete the `requireApiKey` block)
- Regression: `vetra-cli/tests/setup-auth.test.ts` (unchanged, must stay green); the e2e replay (`VETRA_REPLAY_FIXTURE`) stays the first branch of `createAgent`.

**Interfaces**

- Consumes:
  - `resolveLlmSettings`, `createLlmModels` and `resolveContextTokenLimit` (Task 10);
  - `createReplayAgent` (`src/agents/replay-agent.ts`);
  - `createMastraHelpers` and `WrapAgentOptions` (ph-clint);
  - `configKeyToEnvVar` and `createConfigCommand` (ph-clint).
- Produces:
  - `VETRA_AGENT_IMAGE: string`
  - `NO_MODEL_MESSAGE` (verbatim spec text)
  - `createNoModelAgent(): AgentProvider`
  - `createAgent(ctx)`: unchanged signature;
  - `ensureModelAuth(argv: string[]): Promise<void>` (replaces `ensureClaudeAuth`);
  - `isBareLaunchArgs` and `resolveWorkdir`: unchanged.

The `claude-login`, `claude-logout` and `claude-status` commands (`src/cli.ts:41,71`) and the `@powerhousedao/ph-clint-claude-subscription` and `@ai-sdk/anthropic` devDependencies stay until Phase 3. After this task the agent no longer reads them.

- [ ] **Step 1: Write the failing test**

`vetra-cli/tests/agents/no-model-agent.test.ts`:

```ts
import { describe, it, expect, jest, beforeEach, afterEach } from "@jest/globals";
import type { StreamChunk } from "@powerhousedao/ph-clint";
import { createAgent } from "../../src/agents/agent.js";
import { NO_MODEL_MESSAGE, createNoModelAgent } from "../../src/agents/no-model-agent.js";

const EXACT =
  "No model is connected. Open Studio settings → Model to use the Vetra budget or connect your OpenRouter account.";

async function collect(stream: AsyncIterable<StreamChunk>): Promise<StreamChunk[]> {
  const out: StreamChunk[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

describe("no model connected", () => {
  const saved = { ...process.env };
  let fetchSpy: ReturnType<typeof jest.spyOn>;

  beforeEach(() => {
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.VETRA_OPENROUTER_API_KEY;
    delete process.env.VETRA_REPLAY_FIXTURE;
    process.env.ANTHROPIC_API_KEY = "sk-ant-must-be-ignored";
    fetchSpy = jest.spyOn(globalThis, "fetch").mockImplementation(async () => {
      throw new Error("no network in this test");
    });
  });
  afterEach(() => {
    process.env = { ...saved };
    fetchSpy.mockRestore();
  });

  it("answers every chat with the exact connect-a-model message", async () => {
    expect(NO_MODEL_MESSAGE).toBe(EXACT);
    const agent = createNoModelAgent();
    expect(agent.id).toBe("vetra-agent");
    expect(await collect(agent.stream("hello", { threadId: "t1" }))).toStrictEqual([{ type: "text-delta", text: EXACT }]);
    expect(await collect(agent.stream("again", { threadId: "t1" }))).toStrictEqual([{ type: "text-delta", text: EXACT }]);
  });

  it("createAgent serves it without an OpenRouter key (even with an Anthropic key set) and makes no LLM call", async () => {
    const info = jest.fn();
    const ctx = {
      config: {
        model: "anthropic/claude-sonnet-4.6",
        memoryModel: "anthropic/claude-haiku-4.5",
        llmAllowDataCollection: false,
        agentLogging: false,
        anthropicApiKey: "sk-ant-also-ignored",
      },
      context: { log: { info, debug: jest.fn(), warn: jest.fn(), error: jest.fn() } },
      workdir: "/tmp/vetra-no-model-test",
    };
    const agent = await createAgent(ctx as never);
    expect(await collect(agent.stream("build me an app"))).toStrictEqual([{ type: "text-delta", text: EXACT }]);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith(expect.stringContaining("connect-a-model"));
  });
});
```

- [ ] **Step 2: Run; expect failure**

Run: `pnpm --filter vetra-cli test -- tests/agents/no-model-agent.test.ts`

Expected: it fails with `Cannot find module '../../src/agents/no-model-agent.js'`.

- [ ] **Step 3: Implement**

Move the avatar out of `demo-agent.ts` and delete the old files. Run from the monorepo root:

```bash
node -e '
const fs = require("fs");
const src = fs.readFileSync("vetra-cli/src/agents/demo-agent.ts", "utf8");
const m = src.match(/image: ("data:image\/svg\+xml;base64,[^"]+")/);
if (!m) throw new Error("avatar not found in demo-agent.ts");
fs.writeFileSync("vetra-cli/src/agents/agent-image.ts",
  "/** The Vetra logo, shown as the agent avatar in the chat UI. */\nexport const VETRA_AGENT_IMAGE =\n  " + m[1] + ";\n");
'
git rm -q vetra-cli/src/agents/demo-agent.ts vetra-cli/src/agents/require-key.ts vetra-cli/tests/agents/require-key.test.ts
```

The data URI in `agent.ts:146` is byte-identical to `demo-agent.ts:14` (checked with `diff` while planning), so one constant serves both.

`vetra-cli/src/agents/no-model-agent.ts`:

```ts
import type { AgentProvider, StreamChunk } from '@powerhousedao/ph-clint';
import { VETRA_AGENT_IMAGE } from './agent-image.js';

/** Spec "No key means connect a model": verbatim. */
export const NO_MODEL_MESSAGE =
  'No model is connected. Open Studio settings → Model to use the Vetra budget or connect your OpenRouter account.';

/**
 * The agent of a Studio without an OpenRouter key. It always serves — warm pool
 * pods too, so the observability poller sees READY — and answers every chat
 * with NO_MODEL_MESSAGE. It never calls an LLM. A key arriving later (claim,
 * provisionStudioLlm) restarts the pod through Reloader, and the next boot
 * builds the real agent.
 */
export function createNoModelAgent(): AgentProvider {
  return {
    id: 'vetra-agent',
    name: 'Vetra Agent',
    image: VETRA_AGENT_IMAGE,
    async *stream() {
      yield { type: 'text-delta', text: NO_MODEL_MESSAGE } satisfies StreamChunk;
    },
  };
}
```

`vetra-cli/src/agents/agent.ts`: replace the whole file with:

```ts
import { Agent } from '@mastra/core/agent';
import { TokenLimiterProcessor } from '@mastra/core/processors';
import { MCPClient } from '@mastra/mcp';
import { createMastraHelpers } from '@powerhousedao/ph-clint/mastra';
import { createWorkdirStore } from '@powerhousedao/ph-clint';
import type { AgentSetupContext, AgentProvider } from '@powerhousedao/ph-clint';
import type { WrapAgentOptions } from '@powerhousedao/ph-clint/mastra';
import { CLI_NAME } from '../config.js';
import type { Config } from '../framework.js';
import { VETRA_AGENT_IMAGE } from './agent-image.js';
import { createLlmModels, resolveContextTokenLimit, resolveLlmSettings } from './llm.js';
import { createNoModelAgent } from './no-model-agent.js';
import { createReplayAgent } from './replay-agent.js';

/**
 * Agent factory for the CLI.
 *
 * Builds one Mastra Agent per sub-agent, then a main Agent that exposes them
 * via the `agents: { … }` field (Mastra surfaces each as a tool named
 * `agent-<key>`). Every model comes from OpenRouter (llm.ts); the OpenRouter
 * key is the only credential read. Without it the agent still serves, in
 * connect-a-model mode.
 */
export async function createAgent(ctx: AgentSetupContext<Config>): Promise<AgentProvider> {
  // Deterministic e2e: replay a recorded tool sequence against the real
  // reactor instead of calling an LLM. Gated so it never affects production.
  const replayFixture = process.env.VETRA_REPLAY_FIXTURE;
  if (replayFixture) {
    ctx.context.log?.info(`[agent] replay mode — fixture ${replayFixture}`);
    return createReplayAgent(replayFixture, ctx);
  }

  const settings = resolveLlmSettings(ctx.config);
  if (!settings) {
    ctx.context.log?.info('[agent] No OpenRouter key (OPENROUTER_API_KEY) — serving in connect-a-model mode.');
    return createNoModelAgent();
  }
  const models = createLlmModels(settings);

  // Hard input-token ceiling at every step of the agentic loop: 80% of the
  // model's OpenRouter context_length (200k fallback). Oldest messages are
  // trimmed when exceeded, so a long run degrades instead of failing with
  // "prompt is too long".
  const [mainLimit, subLimit] = await Promise.all([
    resolveContextTokenLimit(settings.model),
    resolveContextTokenLimit(settings.subagentModel),
  ]);

  const m = createMastraHelpers(ctx);
  // Observer/Reflector model for observational memory — compresses long chat
  // histories into observation logs so sessions never hit the context limit.
  const memory = await m.createMemory({
    observationalMemory: { model: models.memory },
  });

  const agentDocumentModel = new Agent({
    id: 'agent-document-model',
    name: "Agent Document Model",
    description: "Assist in developing document model specifications",
    instructions: m.getAgentInstructions('agent-document-model'),
    model: models.subagent,
    tools: async () => {
      ctx.context.log?.debug(`[agent agent-document-model] resolving tools`);
      return m.getTools({ MCPClient, include: [] });
    },
    memory,
    inputProcessors: [new TokenLimiterProcessor({ limit: subLimit })],
  });

  const agentEditor = new Agent({
    id: 'agent-editor',
    name: "Agent Editor",
    description: "Assists in developing document model editors",
    instructions: m.getAgentInstructions('agent-editor'),
    model: models.subagent,
    tools: async () => {
      ctx.context.log?.debug(`[agent agent-editor] resolving tools`);
      return m.getTools({ MCPClient, include: [] });
    },
    memory,
    inputProcessors: [new TokenLimiterProcessor({ limit: subLimit })],
  });

  const agentApp = new Agent({
    id: 'agent-app',
    name: "Agent App",
    description: "Assists in developing drive-level apps (dashboards, kanban boards, custom drive views)",
    instructions: m.getAgentInstructions('agent-app'),
    model: models.subagent,
    tools: async () => {
      ctx.context.log?.debug(`[agent agent-app] resolving tools`);
      return m.getTools({ MCPClient, include: [] });
    },
    memory,
    inputProcessors: [new TokenLimiterProcessor({ limit: subLimit })],
  });

  const subAgents: Record<string, Agent> = { agentDocumentModel, agentEditor, agentApp };

  const main = new Agent({
    id: 'vetra-agent',
    name: "Vetra Agent",
    instructions: m.getAgentInstructions('vetra-agent'),
    model: models.main,
    tools: async () => {
      ctx.context.log?.debug('[agent main] resolving tools');
      return m.getTools({ MCPClient });
    },
    workspace: await m.createWorkspace(),
    memory,
    agents: subAgents,
    inputProcessors: [new TokenLimiterProcessor({ limit: mainLimit })],
  });

  const store = createWorkdirStore(ctx.workdir, CLI_NAME);
  const wrapOpts: WrapAgentOptions = {
    maxSteps: 80,
    enableLogging: ctx.config.agentLogging,
    logDirectory: store.getStoreFolder('logs'),
    // No cacheControl here: ph-clint sends it as providerOptions.anthropic,
    // which the OpenRouter provider ignores. llm.ts requests Anthropic caching
    // (top-level cache_control) for anthropic/ models instead.
    image: VETRA_AGENT_IMAGE,
  };
  return m.wrapAgent(main, wrapOpts);
}
```

`vetra-cli/src/framework.ts:21`: delete the `requireApiKey: z.preprocess(...)` line.

`vetra-cli/tests/framework-config.test.ts:4-23`: delete the `requireApiKey` comment and the `describe("configSchema.requireApiKey", ...)` block.

`vetra-cli/Dockerfile`: delete lines `203-211`, which are:
- the comment `'# Hosted image requires a key by default; ...'`;
- `': "${VETRA_REQUIRE_API_KEY:=true}"'`;
- `'export VETRA_REQUIRE_API_KEY'`;
- the `'# No credential yet: hold ...'` comment;
- the whole `if [ "${VETRA_REQUIRE_API_KEY:-}" = "true" ] ... fi` block.

The script then goes straight from the `SERVICE_ANNOUNCE_URL` `fi` (`:202`) to `'echo "==> vetra: starting prebuilt agent"'`.

`vetra-cli/src/setup-auth.ts`: replace the whole file with:

```ts
// First-run model auth: on a bare interactive launch with no OpenRouter key,
// offer the installer's paths — paste a key or skip.
import fs from 'node:fs';
import readline from 'node:readline/promises';
import {
  configKeyToEnvVar,
  createConfigCommand,
  localConfigPath,
  userConfigPath,
  type CommandContext,
} from '@powerhousedao/ph-clint';
import { CLI_NAME } from './config.js';
import { configSchema, secretsSchema } from './framework.js';

const KEY_ENV = configKeyToEnvVar(CLI_NAME, 'openrouterApiKey'); // VETRA_OPENROUTER_API_KEY

// Value-taking pre-command flags whose following token must be skipped, not read
// as a subcommand (subset of ph-clint's private frameworkFlags, core/cli.ts).
const VALUE_FLAGS = new Set(['--resume', '--workdir', '-w']);

// Pure argv classification (TTY-independent, exported for tests): true when the
// launch is bare — no subcommand, no --version/--help/--meta, no explicit --config.
export function isBareLaunchArgs(argv: string[]): boolean {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--version' || a === '-V' || a === '--help' || a === '-h' || a === '--meta') return false;
    if (a === '-c' || a === '--config') return false; // explicit config: leave auth alone
    if (VALUE_FLAGS.has(a)) { i++; continue; } // skip the flag's value
    if (a.startsWith('-')) continue; // boolean pre-command flag (-i, --verbose, …)
    return false; // first bare token is a subcommand → one-shot
  }
  return true;
}

// A bare launch on a real terminal (both stdio a TTY) that will use the agent.
function isInteractiveLaunch(argv: string[]): boolean {
  return Boolean(process.stdin.isTTY && process.stdout.isTTY) && isBareLaunchArgs(argv);
}

// The workdir the framework resolves config against: --workdir/-w value, else cwd.
export function resolveWorkdir(argv: string[]): string {
  const args = argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--workdir' || args[i] === '-w') && i + 1 < args.length) return args[i + 1];
  }
  return process.cwd();
}

// Resolve the key across the same layers the agent uses (minus --config): env
// (VETRA_OPENROUTER_API_KEY, then the bare OPENROUTER_API_KEY a provisioned
// Studio gets), then the workdir's local config, then the user config file.
function resolveApiKey(workdir: string): string | undefined {
  const fromEnv = process.env[KEY_ENV] || process.env.OPENROUTER_API_KEY;
  if (fromEnv) return fromEnv;
  return readKey(localConfigPath(workdir, CLI_NAME)) ?? readKey(userConfigPath(CLI_NAME));
}

function readKey(file: string): string | undefined {
  try {
    const v = (JSON.parse(fs.readFileSync(file, 'utf8')) as { openrouterApiKey?: unknown }).openrouterApiKey;
    return typeof v === 'string' && v ? v : undefined;
  } catch {
    return undefined;
  }
}

// Persist the key to user config via ph-clint's config command (single source
// of truth for merge + schema validation). Returns the config file path.
async function persistApiKey(key: string): Promise<string> {
  // Set env first so the key works this run even if the write fails.
  process.env[KEY_ENV] = key;
  const configCommand = createConfigCommand({
    cliName: CLI_NAME,
    configSchema: configSchema.merge(secretsSchema),
    sensitiveKeys: new Set(Object.keys(secretsSchema.shape)),
  });
  // scope 'user' targets userConfigPath regardless of workdir; the returned
  // text echoes the value uncensored, so discard it in favor of the path.
  await configCommand.execute(
    { name: 'openrouterApiKey', write: key, scope: 'user' },
    { workdir: process.cwd() } as unknown as CommandContext,
  );
  return userConfigPath(CLI_NAME);
}

// Read a line with echo suppressed via raw mode (no readline private APIs).
// If the TTY can't enter raw mode, warn — the input can't be hidden.
function readSecret(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let raw = false;
    try { stdin.setRawMode?.(true); raw = true; } catch { /* leave cooked */ }
    if (!raw) process.stdout.write('(input will be visible) ');
    process.stdout.write(prompt);
    stdin.resume();
    stdin.setEncoding('utf8');
    let buf = '';
    const finish = (val: string) => {
      stdin.removeListener('data', onData);
      if (raw) try { stdin.setRawMode?.(false); } catch { /* ignore */ }
      stdin.pause();
      process.stdout.write('\n');
      resolve(val);
    };
    const onData = (chunk: string) => {
      for (const ch of chunk) {
        const code = ch.charCodeAt(0);
        if (code === 13 || code === 10 || code === 4) return finish(buf); // enter / EOF
        if (code === 3) { // ctrl-c
          if (raw) try { stdin.setRawMode?.(false); } catch { /* ignore */ }
          process.stdout.write('\n');
          process.exit(130);
        }
        if (code === 127 || code === 8) { buf = buf.slice(0, -1); continue; } // backspace
        buf += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function promptSetup(): Promise<void> {
  process.stdout.write(
    [
      '',
      'Connect a model (OpenRouter).',
      'How do you want to authenticate?',
      '  [1] Paste an OpenRouter API key  (openrouter.ai/keys)',
      '  [2] Skip — set it up later',
      '',
    ].join('\n'),
  );
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  let choice: string;
  try {
    choice = (await rl.question('Choose [1/2]: ')).trim();
  } finally {
    rl.close(); // release stdin before raw read
  }
  if (choice === '1') {
    const key = (await readSecret('Paste your OpenRouter API key (hidden): ')).trim();
    if (!key) { process.stdout.write('No key entered — skipping.\n'); return; }
    try {
      await persistApiKey(key);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`Could not save the API key (${msg}); it is set for this session — export ${KEY_ENV} to persist it.\n`);
    }
    return;
  }
  process.stdout.write(
    `Skipped. Connect a model later with \`export ${KEY_ENV}=sk-or-...\`.\n`,
  );
}

// Prompt for an OpenRouter key on a bare interactive launch when none is
// configured. Best-effort: any failure is swallowed so the CLI always starts
// (without a key the agent answers "No model is connected…").
export async function ensureModelAuth(argv: string[]): Promise<void> {
  try {
    if (!isInteractiveLaunch(argv)) return;
    if (resolveApiKey(resolveWorkdir(argv))) return;
    await promptSetup();
  } catch {
    // the no-model agent still guides the user
  }
}
```

`vetra-cli/src/main.ts`: `:7` becomes `import { ensureModelAuth } from './setup-auth.js';` and `:9` becomes `await ensureModelAuth(process.argv);`.

`vetra-cli/src/mastra/index.ts:21-26`: replace the bridge block with:

```ts
// Workaround: Mastra Studio checks process.env for provider keys directly.
// Bridge the ph-clint resolved OpenRouter key so Studio's provider detection works.
{
  const key = rt.config.openrouterApiKey as string | undefined;
  if (key && !process.env.OPENROUTER_API_KEY) process.env.OPENROUTER_API_KEY = key;
}
```

`vetra-cli/src/commands/agent-run.ts`:
- `:41`: `"Agent not configured. The CLI must be built with an agent factory (OPENROUTER_API_KEY required)."`
- `:46`: `throw new Error("Agent factory returned undefined.");`

`vetra-cli/powerhouse.manifest.json`:
- `:11`: `"id": "anthropic/claude-sonnet-4.6"`.
- Replace the `VETRA_ANTHROPIC_API_KEY` config entry (`:37-42`) with the two entries below. The Anthropic entry stays declared, unread, until Phase 3, so older tenants keep validating.

```json
    {
      "name": "OPENROUTER_API_KEY",
      "type": "secret",
      "description": "OpenRouter API key. Provisioned by Vetra from the licence's monthly LLM budget; without it the agent answers \"No model is connected\".",
      "required": false
    },
    {
      "name": "VETRA_ANTHROPIC_API_KEY",
      "type": "secret",
      "description": "Unused since the OpenRouter agent; removed in phase 3.",
      "required": false
    },
```

- [ ] **Step 4: Run; expect pass**

Run: `pnpm --filter vetra-cli typecheck && pnpm --filter vetra-cli lint && pnpm --filter vetra-cli test && pnpm --filter vetra-cli check:deps && grep -c VETRA_REQUIRE_API_KEY vetra-cli/Dockerfile vetra-cli/src -r`

Expected:
- the full jest suite passes, including `no-model-agent.test.ts`, the unchanged `setup-auth.test.ts` and the `agent-eval/replay.test.ts` replay fixture;
- the live evals are skipped;
- typecheck and lint are clean;
- `check:deps` reports ok;
- `grep` prints `0` for every file.

Then run the replay e2e once: `pnpm --filter vetra-cli test:e2e`. Expect the same pass count as on `origin/main`, because the replay branch is unchanged.

- [ ] **Step 5: Commit**

```bash
git add -A vetra-cli
git commit -m "feat(agent): run on OpenRouter; serve a no-model agent instead of holding without a key"
```

---
### Task 12: Create flow calls `provisionStudioLlm`; no key form, no toast; card says "Connect a model" (vetra.io)

**Files**

- Create: `modules/cloud/studio/llm-client.ts`
- Create: `modules/cloud/studio/use-studio-llm-status.ts`
- Modify: `modules/publisher/graphql.ts`:
  - `:27-44`: the `PublisherErrorCode` union;
  - `:48-63`: `KNOWN_CODES`.
- Modify: `modules/cloud/query/keys.ts:21` (add `studioLlmStatus`)
- Modify: `modules/cloud/studio/use-create-studio-environment.ts` (whole file, 149 lines; rewritten below)
- Modify: `modules/cloud/studio/constants.ts:31-40` (drop `STUDIO_ANTHROPIC_SECRET_NAMES`)
- Modify: `modules/cloud/studio/components/new-product-card.tsx` (whole file, 108 lines; rewritten below)
- Modify: `modules/cloud/studio/use-studio-products.ts`:
  - `:10`, `:13`;
  - `:50-57`;
  - `:131-145`;
  - `:164`, `:189`.
- Modify: `modules/cloud/studio/components/studio-products-grid.tsx`:
  - `:78`;
  - `:85-91`;
  - `:112-116`;
  - `:151-156`.
- Modify: `modules/cloud/studio/components/studio-product-card.tsx`:
  - imports `:3-6`;
  - after `:34`: the status hook;
  - `:94-98`: the footer.
- Modify: `modules/subscriptions/graphql.ts:81-95` (delete `applyStudioKey`; the server keeps it until Phase 3)
- Delete:
  - `modules/cloud/studio/components/studio-create-form.tsx`
  - `modules/cloud/studio/missing-key-notice.tsx`
  - `modules/cloud/__tests__/missing-key-notice.test.tsx`
- Test: `modules/cloud/studio/__tests__/llm-client.test.ts` (new)
- Test: `modules/cloud/__tests__/use-create-studio-environment.test.tsx` (rewritten)
- Test: `modules/cloud/__tests__/new-product-card.test.tsx` (rewritten)
- Test: `modules/cloud/__tests__/studio-product-card.test.tsx` (mock and new cases)
- Test: `modules/cloud/__tests__/studio-products-grid.test.tsx:25,54` (and the mock)
- Test: `modules/subscriptions/__tests__/graphql.test.ts:4,70-82`
- Test: `modules/publisher/__tests__/contract-schema.test.ts:158`

**Interfaces**

- Consumes:
  - `publisherGql`, `PublisherApiError` and `FetchLike` (`modules/publisher/graphql.ts:68-153`);
  - `useAuthedQuery` (`modules/cloud/query/use-authed-query.ts:17`);
  - `getAuthToken`, `claimStudioEnvironment` and `fetchStudioPoolVersion` (unchanged);
  - GraphQL `vetraLlm.provisionStudioLlm(tenantId)` and `vetraLlm.studioLlmStatus(environmentId)` (Task 6).
- Produces:
  - `type StudioLlmProvision = { environmentId: string; connected: boolean; llmBudgetUsd: number }`
  - `type StudioLlmStatus = { environmentId: string; connected: boolean }`
  - `provisionStudioLlm(tenantId: string, token: string | null, fetchImpl?: FetchLike): Promise<StudioLlmProvision | null>` (null when the broker answers `SERVICE_NOT_CONFIGURED`)
  - `fetchStudioLlmStatus(environmentId: string, token: string | null, fetchImpl?: FetchLike): Promise<StudioLlmStatus>`
  - `useStudioLlmStatus(envId: string, enabled: boolean)`
  - `queryKeys.studioLlmStatus(envId)`
  - `useCreateStudioEnvironment()` now returns `() => Promise<CreateStudioResult>` (no arguments). `CreateStudioResult = { documentId; subdomain; tenantId }`.
  - `StudioProductsState.createProduct: () => Promise<string>`; `hasAttachedKey` is removed.
  - `NewProductCard` props: `{ onCreate: () => Promise<void>; createError; variant?; atLimit?; limit? }`.
  - `PublisherErrorCode` gains `'SERVICE_NOT_CONFIGURED' | 'UPSTREAM_ERROR'`.

- [ ] **Step 1: Write the failing tests**

`modules/cloud/studio/__tests__/llm-client.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildSchema, parse, validate } from 'graphql'
import type { FetchLike } from '@/modules/publisher/graphql'
import { fetchStudioLlmStatus, provisionStudioLlm } from '../llm-client'

// The vetraLlm SDL as served by vetra-cloud-package subgraphs/vetra-llm/schema.ts.
const schema = buildSchema(`
  type StudioLlmStatus { environmentId: String! connected: Boolean! }
  type StudioLlmProvision { environmentId: String! connected: Boolean! llmBudgetUsd: Float! }
  type VetraLlmQueries { studioLlmStatus(environmentId: String!): StudioLlmStatus! }
  type VetraLlmMutations { provisionStudioLlm(tenantId: String!): StudioLlmProvision! }
  type Query { vetraLlm: VetraLlmQueries! }
  type Mutation { vetraLlm: VetraLlmMutations! }
`)

const respond = (body: unknown) => {
  const calls: Array<{ query: string; variables: Record<string, unknown>; auth: string | null }> = []
  const fetchImpl: FetchLike = (_url, init) => {
    const sent = JSON.parse(init.body as string) as { query: string; variables: Record<string, unknown> }
    calls.push({ ...sent, auth: (init.headers as Record<string, string>).Authorization ?? null })
    return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
  }
  return { calls, fetchImpl }
}

describe('llm-client', () => {
  it('provisions with the tenant id and a bearer, against the vetraLlm schema', async () => {
    const r = respond({
      data: { vetraLlm: { provisionStudioLlm: { environmentId: 'e1', connected: true, llmBudgetUsd: 20 } } },
    })
    await expect(provisionStudioLlm('t-1', 'tok', r.fetchImpl)).resolves.toEqual({
      environmentId: 'e1',
      connected: true,
      llmBudgetUsd: 20,
    })
    expect(r.calls[0].variables).toEqual({ tenantId: 't-1' })
    expect(r.calls[0].auth).toBe('Bearer tok')
    expect(validate(schema, parse(r.calls[0].query))).toEqual([])
  })

  it('treats an unconfigured broker as "no model yet", and rethrows anything else', async () => {
    const off = respond({
      errors: [{ message: 'OpenRouter is not configured', extensions: { code: 'SERVICE_NOT_CONFIGURED' } }],
    })
    await expect(provisionStudioLlm('t-1', 'tok', off.fetchImpl)).resolves.toBeNull()
    const denied = respond({ errors: [{ message: 'no', extensions: { code: 'FORBIDDEN' } }] })
    await expect(provisionStudioLlm('t-1', 'tok', denied.fetchImpl)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('reads the status', async () => {
    const r = respond({ data: { vetraLlm: { studioLlmStatus: { environmentId: 'e1', connected: false } } } })
    await expect(fetchStudioLlmStatus('e1', 'tok', r.fetchImpl)).resolves.toEqual({
      environmentId: 'e1',
      connected: false,
    })
    expect(validate(schema, parse(r.calls[0].query))).toEqual([])
  })
})
```

`modules/cloud/__tests__/use-create-studio-environment.test.tsx`: replace the whole file with:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('@/modules/cloud/hooks/use-can-sign', () => ({ useCanSign: vi.fn() }))
vi.mock('@/modules/cloud/controller', () => ({ createNewEnvironmentController: vi.fn() }))
vi.mock('@/modules/cloud/config/apply', () => ({
  applyConfigChanges: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@powerhousedao/reactor-browser', () => ({ useRenown: vi.fn(() => ({})) }))
vi.mock('@/modules/cloud/subdomain', () => ({ generateSubdomain: vi.fn(() => 'warm-newt-75') }))
// client.ts calls createClient() at module load; the hook only needs DRIVE_ID.
vi.mock('@/modules/cloud/client', () => ({ DRIVE_ID: 'powerhouse' }))
vi.mock('@/modules/cloud/graphql', () => ({ getAuthToken: vi.fn().mockResolvedValue('tok') }))
vi.mock('@/modules/cloud/studio/pool-client', () => ({
  claimStudioEnvironment: vi.fn(),
  fetchStudioPoolVersion: vi.fn().mockResolvedValue(null),
}))
vi.mock('@/modules/cloud/studio/llm-client', () => ({ provisionStudioLlm: vi.fn() }))

import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { applyConfigChanges } from '@/modules/cloud/config/apply'
import { getAuthToken } from '@/modules/cloud/graphql'
import { claimStudioEnvironment } from '@/modules/cloud/studio/pool-client'
import { provisionStudioLlm } from '@/modules/cloud/studio/llm-client'
import { STUDIO_AGENT_PACKAGE, STUDIO_AGENT_VERSION } from '@/modules/cloud/studio/constants'
import { useCreateStudioEnvironment } from '@/modules/cloud/studio/use-create-studio-environment'

const DOC = 'aa726a95-1111-2222-3333-444455556666'
const TENANT = 'warm-newt-75-aa726a95'

/** Minimal controller whose push() resolves to a fixed remote document id. */
function mockController() {
  const push = vi.fn().mockResolvedValue({ remoteDocument: { id: DOC } })
  const ctrl = {
    setOwner: vi.fn(),
    setLabel: vi.fn(),
    initialize: vi.fn(),
    addPackage: vi.fn(),
    enableService: vi.fn(),
    approveChanges: vi.fn(),
    push,
  }
  vi.mocked(createNewEnvironmentController).mockReturnValue(ctrl as never)
  vi.mocked(useCanSign).mockReturnValue({
    canSign: true,
    loading: false,
    signer: { user: { address: '0xMe' } } as never,
  })
  return ctrl
}

describe('useCreateStudioEnvironment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthToken).mockResolvedValue('tok')
  })

  it('throws without a signer', async () => {
    vi.mocked(useCanSign).mockReturnValue({ canSign: false, signer: null, loading: false })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).rejects.toThrow(/logged in/i)
  })

  it('returns a claimed warm Studio without cold provisioning', async () => {
    const ctrl = mockController()
    vi.mocked(claimStudioEnvironment).mockResolvedValue({ documentId: 'd', subdomain: 's', tenantId: 't' })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).resolves.toEqual({ documentId: 'd', subdomain: 's', tenantId: 't' })
    expect(ctrl.push).not.toHaveBeenCalled()
    expect(provisionStudioLlm).not.toHaveBeenCalled()
  })

  it('cold path: creates the env, provisions its model server-side, writes the vars, approves', async () => {
    const ctrl = mockController()
    vi.mocked(claimStudioEnvironment).mockResolvedValue(null)
    vi.mocked(provisionStudioLlm).mockResolvedValue({ environmentId: DOC, connected: true, llmBudgetUsd: 20 })
    const { result } = renderHook(() => useCreateStudioEnvironment())
    let res: unknown
    await act(async () => {
      res = await result.current()
    })
    expect(ctrl.addPackage).toHaveBeenCalledWith({ packageName: STUDIO_AGENT_PACKAGE, version: STUDIO_AGENT_VERSION })
    expect(provisionStudioLlm).toHaveBeenCalledWith(TENANT, 'tok')
    expect(applyConfigChanges).toHaveBeenCalledOnce()
    const changes = vi.mocked(applyConfigChanges).mock.calls[0][1]
    expect(changes.map((c) => c.name).sort()).toEqual(['VETRA_CLOUD_SWITCHBOARD_URL', 'VETRA_ENVIRONMENT_ID'])
    // No key is ever written client-side.
    expect(changes.some((c) => /ANTHROPIC|OPENROUTER/.test(c.name))).toBe(false)
    expect(ctrl.approveChanges).toHaveBeenCalledOnce()
    expect(res).toEqual({ documentId: DOC, subdomain: 'warm-newt-75', tenantId: TENANT })
  })

  it.each([
    ['no budget', { environmentId: DOC, connected: false, llmBudgetUsd: 0 }],
    ['broker not configured', null],
  ])('still finishes creation with %s (the Studio serves in connect-a-model mode)', async (_label, provision) => {
    const ctrl = mockController()
    vi.mocked(claimStudioEnvironment).mockResolvedValue(null)
    vi.mocked(provisionStudioLlm).mockResolvedValue(provision)
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await act(async () => {
      await result.current()
    })
    expect(ctrl.approveChanges).toHaveBeenCalledOnce()
  })

  it('throws and does not approve when provisioning fails for real', async () => {
    const ctrl = mockController()
    vi.mocked(claimStudioEnvironment).mockResolvedValue(null)
    vi.mocked(provisionStudioLlm).mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).rejects.toThrow('network down')
    expect(ctrl.approveChanges).not.toHaveBeenCalled()
  })

  it('refuses the cold path without a token', async () => {
    const ctrl = mockController()
    vi.mocked(getAuthToken).mockResolvedValue(null as never)
    const { result } = renderHook(() => useCreateStudioEnvironment())
    await expect(result.current()).rejects.toThrow(/authenticate/i)
    expect(ctrl.approveChanges).not.toHaveBeenCalled()
  })
})
```

`modules/cloud/__tests__/new-product-card.test.tsx`: replace the whole file with:

```tsx
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { NewProductCard } from '@/modules/cloud/studio/components/new-product-card'

const noop = () => Promise.resolve()

describe('NewProductCard', () => {
  it('renders a disabled limit-reached notice when atLimit', () => {
    const onCreate = vi.fn(noop)
    const { getByText, container } = render(
      <NewProductCard onCreate={onCreate} createError={null} atLimit limit={3} />,
    )
    getByText('Limit reached — 3 of 3 products')
    expect(container.querySelector('button')).toBeNull()
    fireEvent.click(getByText('Limit reached — 3 of 3 products'))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates on click, with no key form', () => {
    const onCreate = vi.fn(noop)
    const { getByText, queryByLabelText } = render(<NewProductCard onCreate={onCreate} createError={null} />)
    fireEvent.click(getByText(/create new product/i))
    expect(onCreate).toHaveBeenCalledOnce()
    expect(queryByLabelText(/api key/i)).toBeNull()
  })

  it('shows a create error under the card', () => {
    const { getByText } = render(<NewProductCard onCreate={vi.fn(noop)} createError="boom" />)
    getByText('boom')
  })
})
```

`modules/cloud/__tests__/studio-product-card.test.tsx`:

1. After the existing `vi.mock` calls (`:7-11`), add:

```tsx
let llmStatus: { data?: { environmentId: string; connected: boolean } } = {}
const useStudioLlmStatus = vi.fn((_envId: string, _enabled: boolean) => llmStatus)
vi.mock('@/modules/cloud/studio/use-studio-llm-status', () => ({
  useStudioLlmStatus: (envId: string, enabled: boolean) => useStudioLlmStatus(envId, enabled),
}))
```

2. Append inside `describe('StudioProductCard', ...)`:

```tsx
  it('says "Connect a model" on a ready Studio without a model key', () => {
    llmStatus = { data: { environmentId: 'env1', connected: false } }
    const { getByText } = render(<StudioProductCard product={base} href={AGENT_URL} />)
    getByText('Connect a model')
    llmStatus = {}
  })

  it('says nothing extra once the Studio has a model, or while unknown', () => {
    llmStatus = { data: { environmentId: 'env1', connected: true } }
    const { queryByText, rerender } = render(<StudioProductCard product={base} href={AGENT_URL} />)
    expect(queryByText('Connect a model')).toBeNull()
    llmStatus = {}
    rerender(<StudioProductCard product={base} href={AGENT_URL} />)
    expect(queryByText('Connect a model')).toBeNull()
  })

  it('does not ask for the status of a booting Studio', () => {
    render(<StudioProductCard product={{ ...base, status: 'booting' }} href={AGENT_URL} />)
    expect(useStudioLlmStatus).toHaveBeenLastCalledWith('env1', false)
  })
```

`modules/cloud/__tests__/studio-products-grid.test.tsx`:
- Add `vi.mock('@/modules/cloud/studio/use-studio-llm-status', () => ({ useStudioLlmStatus: () => ({}) }))` next to the other mocks (`:6-30`).
- Delete `hasAttachedKey: false,` from `baseState` (`:54`).
- Leave the `useStudioAccess` mock data at `:25` unchanged (the lapsed banner still reads it).

`modules/subscriptions/__tests__/graphql.test.ts`:
- Remove `applyStudioKey,` from the import (`:4`).
- In the test at `:70-82`, rename it to `'cancels with bare arguments'` and delete its `b`-part (`:74-81`).

`modules/publisher/__tests__/contract-schema.test.ts:158`: delete the `applyStudioKey: ...` entry.

- [ ] **Step 2: Run; expect failure**

Run: `npx vitest run --config vitest.unit.config.ts modules/cloud modules/subscriptions modules/publisher/__tests__/contract-schema.test.ts`

Expected:
- `llm-client.test.ts`: `Failed to resolve import "../llm-client"`;
- the use-create tests fail: `provisionStudioLlm` is not called, and the hook still writes the Anthropic secrets;
- `new-product-card`: it still requires `hasAttachedKey` and opens the dialog;
- `studio-product-card`: `Unable to find an element with the text: Connect a model`.

- [ ] **Step 3: Implement**

`modules/publisher/graphql.ts`:
- In the `PublisherErrorCode` union (`:27-44`), add `| 'SERVICE_NOT_CONFIGURED'` and `| 'UPSTREAM_ERROR'` before `| 'PUBLISHER_UNAVAILABLE'`.
- In `KNOWN_CODES` (`:48-63`), add `'SERVICE_NOT_CONFIGURED',` and `'UPSTREAM_ERROR',` after `'NO_IDENTITY',`.
- Update the comment above `KNOWN_CODES` to: `// Codes the vetra-licensing (vetraPublisher + vetraSubscriptions) and vetra-llm (vetraLlm) subgraphs send in extensions.code.`

`modules/cloud/studio/llm-client.ts`:

```ts
import { PublisherApiError, publisherGql, type FetchLike } from '@/modules/publisher/graphql'

// vetraLlm (vetra-cloud-package vetra-llm subgraph) on the cloud switchboard.
// Same transport and error mapping as vetraPublisher / vetraSubscriptions.

type Ns<T> = { vetraLlm: T }

export type StudioLlmProvision = { environmentId: string; connected: boolean; llmBudgetUsd: number }
export type StudioLlmStatus = { environmentId: string; connected: boolean }

/**
 * Provision the new Studio's model key from the caller's licence budget,
 * server-side (the key never reaches this client). `connected: false` means
 * the licence has no LLM budget. Null means the deployment has no OpenRouter
 * broker configured. Either way the Studio still comes up, in
 * connect-a-model mode.
 */
export async function provisionStudioLlm(
  tenantId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<StudioLlmProvision | null> {
  try {
    const data = await publisherGql<Ns<{ provisionStudioLlm: StudioLlmProvision }>>(
      `mutation ($tenantId: String!) { vetraLlm { provisionStudioLlm(tenantId: $tenantId) { environmentId connected llmBudgetUsd } } }`,
      { tenantId },
      token,
      fetchImpl,
    )
    return data.vetraLlm.provisionStudioLlm
  } catch (err) {
    if (err instanceof PublisherApiError && err.code === 'SERVICE_NOT_CONFIGURED') return null
    throw err
  }
}

/** Whether the Studio's tenant holds a model key (cheap: no OpenRouter call). */
export async function fetchStudioLlmStatus(
  environmentId: string,
  token: string | null,
  fetchImpl?: FetchLike,
): Promise<StudioLlmStatus> {
  const data = await publisherGql<Ns<{ studioLlmStatus: StudioLlmStatus }>>(
    `query ($environmentId: String!) { vetraLlm { studioLlmStatus(environmentId: $environmentId) { environmentId connected } } }`,
    { environmentId },
    token,
    fetchImpl,
  )
  return data.vetraLlm.studioLlmStatus
}
```

`modules/cloud/query/keys.ts`: after `:21` (`studioProducts`), add:

```ts
  studioLlmStatus: (envId: string) => ['studio-llm-status', envId] as const,
```

`modules/cloud/studio/use-studio-llm-status.ts`:

```ts
'use client'

import { queryKeys } from '@/modules/cloud/query/keys'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import { fetchStudioLlmStatus, type StudioLlmStatus } from './llm-client'

/** Whether a Studio has a model key. Only asked for a Studio that is up; cached for a minute. */
export function useStudioLlmStatus(envId: string, enabled: boolean) {
  return useAuthedQuery<StudioLlmStatus>(
    queryKeys.studioLlmStatus(envId),
    (token) => fetchStudioLlmStatus(envId, token),
    { enabled, staleTime: 60_000 },
  )
}
```

`modules/cloud/studio/use-create-studio-environment.ts`: replace the whole file with:

```ts
'use client'

import { useCallback } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { DRIVE_ID } from '@/modules/cloud/client'
import { createNewEnvironmentController } from '@/modules/cloud/controller'
import { useCanSign } from '@/modules/cloud/hooks/use-can-sign'
import { applyConfigChanges, type ConfigChange } from '@/modules/cloud/config/apply'
import { getAuthToken } from '@/modules/cloud/graphql'
import { cloudSwitchboardUrl, studioRegistry } from '@/modules/cloud/switchboard-url'
import { claimStudioEnvironment, fetchStudioPoolVersion } from './pool-client'
import { provisionStudioLlm } from './llm-client'
import { generateSubdomain } from '@/modules/cloud/subdomain'
import { deriveTenantId } from './studio-tenant'
import {
  STUDIO_AGENT_PACKAGE,
  STUDIO_AGENT_PREFIX,
  STUDIO_AGENT_SIZE,
  STUDIO_AGENT_VERSION,
  STUDIO_BASE_DOMAIN,
  STUDIO_DEFAULT_ENV_VARS,
  STUDIO_ENV_LABEL,
  STUDIO_SERVICE_COMMAND,
} from './constants'

export type CreateStudioResult = {
  documentId: string
  subdomain: string
  tenantId: string
}

/**
 * Provisions a dedicated Vetra Studio environment: a single vetra-cli CLINT
 * agent (XL). A warm pool env is claimed first (it gets its model key in the
 * claim). Cold path: the env is created, then `vetraLlm.provisionStudioLlm`
 * writes the Studio's OpenRouter key from the caller's licence budget,
 * server-side, and the deploy is approved. Creation always finishes: without a
 * budget the Studio serves in connect-a-model mode and its card says so.
 */
export function useCreateStudioEnvironment() {
  const { signer } = useCanSign()
  const renown = useRenown()
  return useCallback(async (): Promise<CreateStudioResult> => {
    if (!signer) throw new Error('You must be logged in with Renown to create a studio')
    const ownerAddress = signer.user?.address
    if (!ownerAddress) throw new Error('Signer has no user address — cannot claim ownership')

    // Try to claim a pre-provisioned ("warm") env first. On null (pool empty,
    // no studio licence) fall through to cold provisioning.
    const token = await getAuthToken(renown)
    if (token) {
      const claimed = await claimStudioEnvironment(token)
      if (claimed) return claimed
    }

    // Source the version live from the backend so a stale (cached) bundle
    // still cold-provisions the current CLI. Falls back to the bundled
    // constant if the backend is unreachable or predates the query.
    const version = (await fetchStudioPoolVersion()) ?? STUDIO_AGENT_VERSION

    const subdomain = generateSubdomain(crypto.randomUUID())
    // Per-deployment registry (prod → registry.vetra.io, staging → dev).
    const registry = studioRegistry()
    const controller = createNewEnvironmentController({ parentIdentifier: DRIVE_ID, signer })
    controller.setOwner({ address: ownerAddress })
    controller.setLabel({ label: STUDIO_ENV_LABEL })
    controller.initialize({
      genericSubdomain: subdomain,
      genericBaseDomain: STUDIO_BASE_DOMAIN,
      defaultPackageRegistry: registry,
    })
    controller.addPackage({ packageName: STUDIO_AGENT_PACKAGE, version })
    controller.enableService({
      type: 'CLINT',
      prefix: STUDIO_AGENT_PREFIX,
      clintConfig: {
        package: {
          registry,
          name: STUDIO_AGENT_PACKAGE,
          version,
        },
        env: STUDIO_DEFAULT_ENV_VARS.map((v) => ({ ...v })),
        serviceCommand: STUDIO_SERVICE_COMMAND,
        selectedRessource: STUDIO_AGENT_SIZE,
      },
      selectedRessource: STUDIO_AGENT_SIZE,
    })
    const result = await controller.push()
    const documentId = result.remoteDocument.id
    const tenantId = deriveTenantId(subdomain, documentId)

    // The Studio's model key (and session-export secret), server-side. A
    // licence without a budget or a deployment without a broker still finishes;
    // a real failure throws before approving, so nothing half-configured rolls.
    if (!token) throw new Error('Could not authenticate to provision the studio')
    await provisionStudioLlm(tenantId, token)

    const githubChanges: ConfigChange[] = [
      { kind: 'setVar', name: 'VETRA_ENVIRONMENT_ID', value: documentId },
      {
        kind: 'setVar',
        name: 'VETRA_CLOUD_SWITCHBOARD_URL',
        value: cloudSwitchboardUrl().replace(/\/graphql\/?$/, ''),
      },
    ]
    try {
      await applyConfigChanges(tenantId, githubChanges, renown)
    } catch {
      // ignore
    }

    controller.approveChanges({})
    await controller.push()

    return { documentId, subdomain, tenantId }
  }, [signer, renown])
}
```

In the "refuses the cold path without a token" test, `getAuthToken` returns null, so the claim is skipped. The env is then pushed, and the hook throws before provisioning and before approving.

`modules/cloud/studio/constants.ts`: delete `:31-40` (the `STUDIO_ANTHROPIC_SECRET_NAMES` comment and constant).

`modules/cloud/studio/components/new-product-card.tsx`: replace the whole file with:

```tsx
'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/modules/shared/components/ui/button'

export function NewProductCard({
  onCreate,
  createError,
  variant = 'card',
  atLimit = false,
  limit = 0,
}: {
  onCreate: () => Promise<void>
  createError: string | null
  /**
   * `card` — dashed tile sized to sit in the products grid.
   * `button` — solid green CTA for the empty state (no products yet).
   * `row` — short dashed button for the bottom "New Vetra Studio…" action,
   *   matching the sibling "New environment…" button's height.
   */
  variant?: 'card' | 'button' | 'row'
  /** When true, the user hit the create cap — render a disabled limit notice. */
  atLimit?: boolean
  /** The configured cap, shown in the limit-reached copy. */
  limit?: number
}) {
  // Creating provisions immediately: the model key comes from the licence's
  // LLM budget server-side, so there is nothing to ask for.
  const handleClick = () => void onCreate()

  // At the cap: a disabled, non-interactive tile explaining why (no create).
  // Sized per variant so it drops into the same slot as the CTA.
  if (atLimit) {
    const message = `Limit reached — ${limit} of ${limit} products`
    const shape =
      variant === 'card' ? 'min-h-[200px] flex-col rounded-xl' : 'rounded-2xl py-5 flex-row w-full'
    return (
      <div
        role="note"
        title="Delete a product to create a new one."
        className={`border-border text-muted-foreground flex cursor-not-allowed items-center justify-center gap-2 border border-dashed px-4 text-sm font-medium opacity-70 ${shape}`}
      >
        {message}
      </div>
    )
  }

  const card =
    variant === 'button' ? (
      <Button size="lg" onClick={handleClick}>
        <Plus className="h-5 w-5" />
        Create new product
      </Button>
    ) : variant === 'row' ? (
      <button
        onClick={handleClick}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed py-5 text-sm font-medium transition-colors"
      >
        <Plus className="h-5 w-5" />
        New Vetra Studio…
      </button>
    ) : (
      <button
        onClick={handleClick}
        className="border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
      >
        <Plus className="h-7 w-7" />
        <span className="text-sm">Create new product…</span>
      </button>
    )

  // The grid swaps to its "Creating…" state via `creating`; surface any error beneath the card.
  return (
    <div className="flex flex-col gap-2">
      {card}
      {createError && <p className="text-destructive text-sm">{createError}</p>}
    </div>
  )
}
```

`modules/cloud/studio/use-studio-products.ts`:
- Delete `:10` (the `useStudioAccess` import) and `:13` (the `showMissingKeyNotice` import).
- In `StudioProductsState` (`:50-57`), replace the `createProduct` doc and type with `/** Provision a new product env; resolves to the new env id for navigation. */ createProduct: () => Promise<string>`, and delete the `hasAttachedKey` field and its doc.
- Delete `:131-135` (the comment, `useStudioAccess()` and `hasAttachedKey`).
- `:137-138`: the callback becomes `async (): Promise<string> => {`.
- `:145`: `const res = await create()`.
- Delete `:164` (`if (res.missingKey) ...`).
- Delete `hasAttachedKey,` from the returned object (`:189`).

`modules/cloud/studio/components/studio-products-grid.tsx`:
- Delete `hasAttachedKey,` from the destructuring (`:78`).
- Replace `:85-91` with:

```tsx
  // Provision a new product; it surfaces in the list optimistically (as
  // "Provisioning…") immediately, and the 30s poll reconciles it against the
  // server-resolved list. Its model key is provisioned server-side.
  const handleCreate = async () => {
    await createProduct()
  }
```

- Delete the `hasAttachedKey={hasAttachedKey}` prop at `:115` and `:154`.

`modules/cloud/studio/components/studio-product-card.tsx`:
- `:3`: `import { Boxes, Loader2, Moon, PlugZap } from 'lucide-react'`.
- Add `import { useStudioLlmStatus } from '../use-studio-llm-status'` after `:6`.
- After `const canOpen = isReady || isSleeping` (`:34`), add:

```tsx
  // A Studio that is up but has no model key answers "No model is connected…":
  // say so on the card. Not asked while booting, or for a locked (lapsed) card.
  const llm = useStudioLlmStatus(product.envId, canOpen && !locked)
  const needsModel = llm.data?.connected === false
```

- Replace the footer (`:94-98`) with:

```tsx
      <div className="mt-4 flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-2">
          {statusBadge}
          {needsModel && (
            <span
              title="No model is connected, so the agent can't answer yet. Your licence has no monthly LLM budget."
              className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600"
            >
              <PlugZap className="h-3 w-3" aria-hidden />
              Connect a model
            </span>
          )}
        </div>
        {isReady && <span className="text-muted-foreground text-xs">Open →</span>}
        {isSleeping && <span className="text-muted-foreground text-xs">Wake →</span>}
      </div>
```

`modules/subscriptions/graphql.ts`: delete `:81-95` (the `applyStudioKey` doc comment and function).

Delete the files:

```bash
git rm -q modules/cloud/studio/components/studio-create-form.tsx modules/cloud/studio/missing-key-notice.tsx modules/cloud/__tests__/missing-key-notice.test.tsx
```

- [ ] **Step 4: Run; expect pass**

Run: `npm run tsc && npm run lint && npx prettier --write $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard) && npm run format:check && npm run test:unit`

Expected:
- 0 tsc and 0 lint errors;
- prettier is clean;
- the full unit suite passes;
- `grep -rn "applyStudioKey\|STUDIO_ANTHROPIC_SECRET_NAMES\|showMissingKeyNotice\|hasAttachedKey" modules app` only finds `modules/subscriptions/types.ts` (the `StudioAccess` type still carries the server field until Phase 3) and the `useStudioAccess` mock data in `studio-products-grid.test.tsx`.

- [ ] **Step 5: Commit**

```bash
git add -A modules
git commit -m "feat(studio): provision the Studio's model server-side; drop the key form; card says Connect a model"
```

---

### Task 13: Publisher invite codes: "Monthly LLM budget" and "Set budget" (vetra.io)

**Files**

- Modify: `modules/publisher/types.ts`:
  - `:88-98` (`PublisherInviteCode`);
  - `:161-170` (`CreateInviteCodeInput`).
- Modify: `modules/publisher/graphql.ts`:
  - `:220` (`INVITE_CODE_FIELDS`);
  - `:476-481` (replace `setInviteCodeAnthropicKey` with `setInviteCodeLlmBudget`).
- Modify: `modules/publisher/hooks/use-publisher-mutations.ts:150-155`
- Modify: `modules/publisher/lib/invite-codes.ts`:
  - `:35-54`: schema;
  - `:57-69`: input;
  - append `budgetText`.
- Modify: `modules/publisher/components/invite-codes/create-invite-code-dialog.tsx`:
  - `:45-52`;
  - `:106-107`;
  - `:133-137`;
  - `:255-276`.
- Create: `modules/publisher/components/invite-codes/set-invite-code-budget-dialog.tsx`
- Delete: `modules/publisher/components/invite-codes/set-invite-code-key-dialog.tsx` and `modules/publisher/__tests__/set-invite-code-key-dialog.test.tsx`
- Modify: `modules/publisher/components/invite-codes/invite-codes-tab.tsx`:
  - `:3`;
  - `:28`;
  - `:35`;
  - `:111-119`;
  - `:140-148`;
  - `:175-182`.
- Modify: `modules/publisher/__tests__/fixtures/licensing-contract.graphql`:
  - `:123`;
  - `:211`;
  - after `:242`;
  - after `:308`.
- Test: `modules/publisher/__tests__/set-invite-code-budget-dialog.test.tsx` (new)
- Test: `modules/publisher/__tests__/invite-codes-lib.test.ts:79-113`
- Test: `modules/publisher/__tests__/create-invite-code-dialog.test.tsx`:
  - `:40`, `:59`;
  - `:71-90`;
  - `:160`;
  - `:181-186`.
- Test: `modules/publisher/__tests__/invite-codes-tab.test.tsx`:
  - `:33`, `:46`;
  - `:87`;
  - add a new case.
- Test: `modules/publisher/__tests__/mutations.test.ts`:
  - `:95-103`;
  - `:133-144`.
- Test: `modules/publisher/__tests__/use-publisher-mutations.test.tsx`:
  - `:10`, `:18`, `:26`;
  - `:96-108`.
- Test: `modules/publisher/__tests__/contract-schema.test.ts:127,134-135`

**Interfaces**

- Consumes:
  - GraphQL (Task 3):
    - `PublisherInviteCode.llmBudgetUsd: Float`
    - `CreateInviteCodeInput.llmBudgetUsd: Float`
    - `setInviteCodeLlmBudget(appId: String!, code: String!, llmBudgetUsd: Float): Boolean!`
  - `argsWrite` and `usePublisherMutation` (existing);
  - `runWithToast` (`modules/publisher/lib/run`).
- Produces:
  - `PublisherInviteCode.llmBudgetUsd: number | null` (`hasAnthropicKey` is removed from the client type)
  - `CreateInviteCodeInput.llmBudgetUsd?: number | null` (`anthropicKey` is removed)
  - `setInviteCodeLlmBudget({ appId, code, llmBudgetUsd }, token, fetchImpl?)`
  - `useSetInviteCodeLlmBudget(appId)`
  - `InviteCodeForm.llmBudgetUsd: string`
  - `budgetText(c: Pick<PublisherInviteCode, 'llmBudgetUsd'>): string`
  - `SetInviteCodeBudgetDialog({ appId, code, current, open, onOpenChange })`

- [ ] **Step 1: Write the failing tests**

`modules/publisher/__tests__/set-invite-code-budget-dialog.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const setBudget = vi.fn()
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-publisher-mutations', () => ({
  useSetInviteCodeLlmBudget: () => ({ mutateAsync: setBudget, isPending: false }),
}))

import { SetInviteCodeBudgetDialog } from '../components/invite-codes/set-invite-code-budget-dialog'

function setup(current: number | null = null) {
  const onOpenChange = vi.fn()
  render(
    <SetInviteCodeBudgetDialog appId="app-1" code="VIP-2026" current={current} open onOpenChange={onOpenChange} />,
  )
  return onOpenChange
}

describe('SetInviteCodeBudgetDialog', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('prefills the current budget, saves a new one in USD, then closes', async () => {
    setBudget.mockResolvedValue(true)
    const onOpenChange = setup(20)
    const input = screen.getByLabelText(/monthly llm budget/i) as HTMLInputElement
    expect(input.value).toBe('20')
    fireEvent.change(input, { target: { value: '35.50' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save budget/i }))
    })
    expect(setBudget).toHaveBeenCalledWith({ code: 'VIP-2026', llmBudgetUsd: 35.5 })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('goes back to the plan default by sending null', async () => {
    setBudget.mockResolvedValue(true)
    setup(20)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /use plan default/i }))
    })
    expect(setBudget).toHaveBeenCalledWith({ code: 'VIP-2026', llmBudgetUsd: null })
  })

  it('refuses a malformed or over-cap amount without sending', async () => {
    setup()
    const input = screen.getByLabelText(/monthly llm budget/i)
    for (const bad of ['-1', 'abc', '10000.01', '1.234']) {
      fireEvent.change(input, { target: { value: bad } })
      expect((screen.getByRole('button', { name: /save budget/i }) as HTMLButtonElement).disabled).toBe(true)
    }
    expect(setBudget).not.toHaveBeenCalled()
  })
})
```

`modules/publisher/__tests__/invite-codes-lib.test.ts`:
- Replace the tests at `:79-113`. In every `form` literal, replace `anthropicKey: ''` with `llmBudgetUsd: ''`.
- The second case of the first test becomes:

```ts
    expect(inviteCodeInput({ ...form, code: ' VIP-2026 ', maxUses: '50', llmBudgetUsd: ' 20.5 ' })).toMatchObject({
      code: 'VIP-2026',
      maxUses: 50,
      llmBudgetUsd: 20.5,
    })
```

- Rename it to `'omits the code and the budget when left empty, so the server generates the code and the plan default applies'`.
- Append:

```ts
  it('accepts a dollar budget from 0 to 10,000 with at most cents', () => {
    const form = { kind: 'conf', label: '', code: '', maxUses: '', expiresOn: '', llmBudgetUsd: '' }
    for (const ok of ['0', '20', '20.5', '20.55', '10000']) {
      expect(inviteCodeSchema.safeParse({ ...form, llmBudgetUsd: ok }).success).toBe(true)
    }
    for (const bad of ['-1', 'abc', '1.234', '10000.01']) {
      expect(inviteCodeSchema.safeParse({ ...form, llmBudgetUsd: bad }).success).toBe(false)
    }
    expect(budgetText({ llmBudgetUsd: null })).toBe('Plan default')
    expect(budgetText({ llmBudgetUsd: 20 })).toBe('$20.00 / month')
    expect(budgetText({ llmBudgetUsd: 0 })).toBe('No LLM budget')
  })
```

  Add `budgetText` to that file's import from `../lib/invite-codes`.

`modules/publisher/__tests__/create-invite-code-dialog.test.tsx`:
- In the fixtures at `:40`, `:59` and `:160`, replace `hasAnthropicKey: false,` with `llmBudgetUsd: null,`. In the one at `:80`, replace `hasAnthropicKey: true,` with `llmBudgetUsd: 20,`.
- Replace the test at `:71-90` with:

```tsx
  it('sends the monthly LLM budget and shows it on the ready view', async () => {
    create.mockResolvedValue({
      code: 'K-1234',
      kind: 'conf',
      label: null,
      active: true,
      expiresAt: null,
      maxUses: null,
      redemptions: 0,
      llmBudgetUsd: 20,
      createdAt: '2026-10-08T00:00:00Z',
    })
    render(<CreateInviteCodeDialog appId="app-1" plans={plans} open onOpenChange={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Monthly LLM budget (USD, optional)'), { target: { value: '20' } })
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create code' })))
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ llmBudgetUsd: 20 }))
    expect(screen.getByText(/\$20\.00 \/ month of LLM usage/i)).toBeTruthy()
  })
```

- Replace the test at `:181-186` with:

```tsx
  it('has no Claude key field any more', () => {
    render(<CreateInviteCodeDialog appId="app-1" plans={plans} open onOpenChange={vi.fn()} />)
    expect(screen.queryByLabelText(/claude api key/i)).toBeNull()
  })
```

`modules/publisher/__tests__/invite-codes-tab.test.tsx`:
- `:33`: `useSetInviteCodeLlmBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),`.
- `:46`: `llmBudgetUsd: 20,`.
- `:87`: `expect(within(row).getByText('$20.00 / month')).toBeTruthy()`.
- Append:

```tsx
  it('offers Set budget instead of Set Claude key', () => {
    codes = [code()]
    render(<InviteCodesTab appId="app-1" />)
    const row = screen.getByTestId('code-LFC_2026-vip')
    expect(within(row).getByRole('button', { name: 'Set budget for LFC_2026-vip' })).toBeTruthy()
    expect(within(row).queryByRole('button', { name: /claude key/i })).toBeNull()
  })
```

`modules/publisher/__tests__/mutations.test.ts`:
- In `:95`, replace `hasAnthropicKey: true` with `llmBudgetUsd: 20`.
- `:99`: `const input = { appId: 'a', kind: 'conf', llmBudgetUsd: 20, maxUses: 50 }`.
- `:103`: `expect(calls[0].query).toContain('llmBudgetUsd')`.
- Replace the two `setInviteCodeAnthropicKey` rows (`:133-144`) with:

```ts
  [
    'setInviteCodeLlmBudget',
    { appId: 'a', code: 'C', llmBudgetUsd: 20 },
    '($appId: String!, $code: String!, $llmBudgetUsd: Float)',
    'setInviteCodeLlmBudget(appId: $appId, code: $code, llmBudgetUsd: $llmBudgetUsd)',
  ],
  [
    'setInviteCodeLlmBudget',
    { appId: 'a', code: 'C', llmBudgetUsd: null },
    '($appId: String!, $code: String!, $llmBudgetUsd: Float)',
    'setInviteCodeLlmBudget(appId: $appId, code: $code, llmBudgetUsd: $llmBudgetUsd)',
  ],
```

`modules/publisher/__tests__/use-publisher-mutations.test.tsx`:
- Rename `setInviteCodeAnthropicKey` to `setInviteCodeLlmBudget` and `useSetInviteCodeAnthropicKey` to `useSetInviteCodeLlmBudget` (`:10`, `:18`, `:26`).
- Replace the test at `:96-108` with:

```tsx
  it('setting a code budget binds the appId and refreshes invite codes', async () => {
    setInviteCodeLlmBudget.mockResolvedValue(true)
    const { Wrapper, invalidated } = setup()
    const { result } = renderHook(() => useSetInviteCodeLlmBudget('app-1'), { wrapper: Wrapper })
    await act(async () => {
      await result.current.mutateAsync({ code: 'C', llmBudgetUsd: null })
    })
    expect(setInviteCodeLlmBudget).toHaveBeenCalledWith({ appId: 'app-1', code: 'C', llmBudgetUsd: null }, 'tok')
    expect(invalidated()).toEqual([['publisher', 'inviteCodes', 'app-1']])
  })
```

`modules/publisher/__tests__/contract-schema.test.ts`:
- `:127`: replace `anthropicKey: 'k',` with `llmBudgetUsd: 20,`.
- Replace `:134-135` with:

```ts
  setInviteCodeLlmBudget: (f) =>
    publisher.setInviteCodeLlmBudget({ appId: A, code: 'VIP-2026', llmBudgetUsd: null }, 't', f),
```

- [ ] **Step 2: Run; expect failure**

Run: `npx vitest run --config vitest.unit.config.ts modules/publisher`

Expected:
- `Failed to resolve import "../components/invite-codes/set-invite-code-budget-dialog"`;
- `budgetText is not a function`;
- the contract test fails with `Cannot query field "llmBudgetUsd" on type "PublisherInviteCode"` (fixture not yet updated) and `missing a call for setInviteCodeLlmBudget`;
- the tab test is missing `$20.00 / month`.

- [ ] **Step 3: Implement**

`modules/publisher/__tests__/fixtures/licensing-contract.graphql` (it mirrors Tasks 3 and 4):
- `:123`: after `hasAnthropicKey: Boolean!`, add `llmBudgetUsd: Float`.
- `:211`: after `anthropicKey: String`, add `llmBudgetUsd: Float`.
- After `:242`, add `setInviteCodeLlmBudget(appId: String!, code: String!, llmBudgetUsd: Float): Boolean!`.
- After `:308` (`hasAttachedKey: Boolean!`), add `llmBudgetUsd: Float!`.

`modules/publisher/types.ts`:
- In `PublisherInviteCode` (`:88-98`), replace `hasAnthropicKey: boolean` with:

```ts
  /** Monthly LLM budget (USD) for Studios redeemed from this code; null = the plan default. */
  llmBudgetUsd: number | null
```

- In `CreateInviteCodeInput` (`:161-170`), replace the `anthropicKey` doc and field with:

```ts
  /** Monthly LLM budget (USD); omit for the plan default. */
  llmBudgetUsd?: number | null
```

`modules/publisher/graphql.ts`:
- `:220`: `export const INVITE_CODE_FIELDS = \`code kind label active expiresAt maxUses redemptions llmBudgetUsd createdAt\``.
- Replace `:476-481` with:

```ts
/** A null `llmBudgetUsd` puts the code back on the plan default. */
export const setInviteCodeLlmBudget = argsWrite<{
  appId: string
  code: string
  llmBudgetUsd: number | null
}>('setInviteCodeLlmBudget', { appId: 'String!', code: 'String!', llmBudgetUsd: 'Float' })
```

`modules/publisher/hooks/use-publisher-mutations.ts:150-155`: replace with:

```ts
export const useSetInviteCodeLlmBudget = (appId: string) =>
  usePublisherMutation<{ code: string; llmBudgetUsd: number | null }, boolean>(
    appId,
    (v, t) => api.setInviteCodeLlmBudget({ appId, ...v }, t),
    ['inviteCodes'],
  )
```

`modules/publisher/lib/invite-codes.ts`:
- After `MAX_USES_LIMIT` (`:11`), add:

```ts
/** Mirrors the server (shared/llm-budget.ts MAX_LLM_BUDGET_USD). */
export const MAX_LLM_BUDGET_USD = 10_000

/** A dollar amount with at most cents, 0 to MAX_LLM_BUDGET_USD. */
export function isBudgetText(v: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(v) && Number(v) <= MAX_LLM_BUDGET_USD
}

export function budgetText(c: Pick<PublisherInviteCode, 'llmBudgetUsd'>): string {
  if (c.llmBudgetUsd == null) return 'Plan default'
  if (c.llmBudgetUsd === 0) return 'No LLM budget'
  return `$${c.llmBudgetUsd.toFixed(2)} / month`
}
```

- In `inviteCodeSchema` (`:35-54`), replace `anthropicKey: z.string().trim(),` with:

```ts
  llmBudgetUsd: z
    .string()
    .trim()
    .refine(
      (v) => v === '' || isBudgetText(v),
      'A dollar amount from 0 to 10,000 (cents at most), or empty for the plan default',
    ),
```

- In `inviteCodeInput` (`:57-69`):
  - replace `const key = f.anthropicKey.trim()` with `const budget = f.llmBudgetUsd.trim()`;
  - replace `...(key ? { anthropicKey: key } : {}),` with `...(budget ? { llmBudgetUsd: Number(budget) } : {}),`;
  - change the comment to `// Omitted, not null: "omit to generate a random code" / "omit for the plan default".`

`modules/publisher/components/invite-codes/create-invite-code-dialog.tsx`:
- `:51`: `llmBudgetUsd: '',`.
- `:106-107`: replace the comment and reset with `form.reset({ ...EMPTY, kind: only })` (drop the "Claude key is write-only" comment).
- `:133-137`: replace with:

```tsx
              {created.llmBudgetUsd != null && created.llmBudgetUsd > 0 && (
                <p className="text-muted-foreground text-center text-sm">
                  Includes {budgetText(created)} of LLM usage for Vetra Studio plans.
                </p>
              )}
```

  Add `budgetText` to the `../../lib/invite-codes` import.
- `:255-276`: replace the `anthropicKey` `FormField` with:

```tsx
                <FormField
                  control={form.control}
                  name="llmBudgetUsd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly LLM budget (USD, optional)</FormLabel>
                      <FormControl>
                        <Input inputMode="decimal" placeholder="Plan default" {...field} />
                      </FormControl>
                      <FormDescription>
                        For Vetra Studio plans: each Studio redeemed from this code gets a model key
                        capped at this amount per month. 0 means no Vetra key.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
```

`modules/publisher/components/invite-codes/set-invite-code-budget-dialog.tsx`:

```tsx
'use client'

import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/modules/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/modules/shared/components/ui/dialog'
import { Input } from '@/modules/shared/components/ui/input'
import { Label } from '@/modules/shared/components/ui/label'
import { useSetInviteCodeLlmBudget } from '../../hooks/use-publisher-mutations'
import { isBudgetText } from '../../lib/invite-codes'
import { runWithToast } from '../../lib/run'

export function SetInviteCodeBudgetDialog({
  appId,
  code,
  current,
  open,
  onOpenChange,
}: {
  appId: string
  code: string
  /** The code's budget now; null = plan default. */
  current: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const setBudget = useSetInviteCodeLlmBudget(appId)
  const [value, setValue] = useState(current == null ? '' : String(current))

  // Each opening starts from the code's current budget.
  useEffect(() => {
    if (open) setValue(current == null ? '' : String(current))
  }, [open, current])

  const text = value.trim()
  const valid = text !== '' && isBudgetText(text)

  const send = async (llmBudgetUsd: number | null, ok: string) => {
    const done = await runWithToast(() => setBudget.mutateAsync({ code, llmBudgetUsd }), ok)
    if (done) onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>LLM budget for {code}</DialogTitle>
          <DialogDescription>
            Each Vetra Studio redeemed from this code gets a model key capped at this amount per
            month. Existing Studios pick up a change within 15 minutes.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (valid) void send(Number(text), 'Budget saved')
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="invite-code-llm-budget">Monthly LLM budget (USD)</Label>
            <Input
              id="invite-code-llm-budget"
              inputMode="decimal"
              placeholder="20"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={setBudget.isPending}
              onClick={() => void send(null, 'Back on the plan default')}
            >
              Use plan default
            </Button>
            <Button type="submit" disabled={setBudget.isPending || !valid}>
              {setBudget.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

`modules/publisher/components/invite-codes/invite-codes-tab.tsx`:
- `:3`: `import { Coins, Plus, RefreshCw, Ticket } from 'lucide-react'`.
- `:23`: add `budgetText` to the `../../lib/invite-codes` import.
- `:28`: `import { SetInviteCodeBudgetDialog } from './set-invite-code-budget-dialog'`.
- `:35`: `const [budgetCode, setBudgetCode] = useState<string | null>(null)`.
- Replace the key chip (`:111-119`) with:

```tsx
                        <span className="text-muted-foreground text-xs">{budgetText(c)}</span>
```

- Replace the "Set Claude key" button (`:140-148`) with:

```tsx
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Set budget for ${c.code}`}
                          onClick={() => setBudgetCode(c.code)}
                        >
                          <Coins className="h-4 w-4" aria-hidden />
                          Set budget
                        </Button>
```

- Replace the dialog (`:175-182`) with:

```tsx
      <SetInviteCodeBudgetDialog
        appId={appId}
        code={budgetCode ?? ''}
        current={list.find((c) => c.code === budgetCode)?.llmBudgetUsd ?? null}
        open={budgetCode !== null}
        onOpenChange={(o) => {
          if (!o) setBudgetCode(null)
        }}
      />
```

Delete the old dialog and its test:

```bash
git rm -q modules/publisher/components/invite-codes/set-invite-code-key-dialog.tsx modules/publisher/__tests__/set-invite-code-key-dialog.test.tsx
```

- [ ] **Step 4: Run; expect pass**

Run: `npm run tsc && npm run lint && npx prettier --write $(git diff --name-only --diff-filter=AM HEAD; git ls-files --others --exclude-standard) && npm run format:check && npm run test:unit`

Expected:
- 0 tsc and 0 lint errors;
- prettier is clean;
- the full unit suite passes;
- `grep -rn "anthropicKey\|hasAnthropicKey\|Claude key" modules/publisher app` finds only the contract fixture (the server still has those fields until Phase 3).

- [ ] **Step 5: Commit**

```bash
git add -A modules
git commit -m "feat(publisher): monthly LLM budget on invite codes, Set budget replaces Set Claude key"
```

---
### Task 14: Ops: OpenRouter org, secrets, config, migration and cut-over (human, staging then prod)

This task changes no product code. Every step needs a person with:
- OpenRouter org admin rights;
- OpenBao write access to `kv/powerhouse/shared/*`;
- push to `powerhouse-k8s-hosting`;
- npmjs auth for `pnpm publish:dev`;
- a platform-admin Renown address (`ADMINS`).

**Files**

- Modify: `powerhouse-k8s-hosting/tenants/staging/powerhouse-values.yaml`:
  - `:103-115`: `switchboard.extraExternalSecret.sources`;
  - the switchboard `env` block (`:133`ff, next to `STUDIO_POOL_VERSION` at `:293`);
  - `:143`: the `PH_REGISTRY_PACKAGES` pin.
- Modify: `powerhouse-k8s-hosting/tenants/vetra/powerhouse-values.yaml`:
  - `:77-89`: `extraExternalSecret.sources`;
  - the `env` block at `:107`ff;
  - `:155` and `:315`: `PH_REGISTRY_PACKAGES`;
  - `:223`: `STUDIO_POOL_VERSION`.
- Modify: `vetra.io/modules/cloud/studio/constants.ts:15` (`STUDIO_AGENT_VERSION`, kept in lockstep with the pool)

**Interfaces**

- Consumes:
  - the env read by Tasks 1–9: `OPENROUTER_MANAGEMENT_KEY`, `OPENROUTER_WORKSPACE_ID`, `VETRA_LLM_DEFAULT_BUDGET_USD`, `VETRA_LLM_DEFAULT_MODEL` (optional), `STUDIO_POOL_LEGACY_ANTHROPIC_KEY`;
  - the GraphQL `vetraLlm.migrateStudiosToOpenRouter` (Task 9);
  - the vetra.io deploys of Tasks 12 and 13.
- Produces: a running OpenRouter-backed Studio fleet on staging, then prod.

**Ordering rule.** Deploy vetra.io Task 12 (the cold path with no key form and no client Anthropic write) only after the agent cut-over in step 8. Before that, a cold-created Studio runs the old agent image. Without an Anthropic secret, the old image's hold loop (`vetra-cli/Dockerfile:203-211` on the old build) keeps it "provisioning" forever. Task 13 (the publisher budget UI) can deploy as soon as step 4 is live.

- [ ] **Step 1: OpenRouter organisation**
  - In the Powerhouse OpenRouter organisation, create two workspaces, `vetra-staging` and `vetra-prod`. Note both workspace ids (UUIDs).
  - Create one management (provisioning) key per deployment, scoped to its workspace if the UI offers it.
  - Fund the org's credits.
  - Confirm the endpoint and enum assumptions the code relies on:
    - `curl -s https://openrouter.ai/api/v1/models | jq -r '.data[] | select(.id=="anthropic/claude-sonnet-4.6" or .id=="anthropic/claude-haiku-4.5") | .id'` must print both ids.
    - With the staging management key, `curl -s -H "Authorization: Bearer $KEY" "https://openrouter.ai/api/v1/keys?workspace_id=$WS" | jq '.data | length'` must answer (0 is fine).

- [ ] **Step 2: OpenBao.** Write each path with exactly these property names, which become the env var names:

```bash
bao kv put kv/powerhouse/shared/openrouter-staging OPENROUTER_MANAGEMENT_KEY="<staging key>" OPENROUTER_WORKSPACE_ID="<vetra-staging workspace id>"
bao kv put kv/powerhouse/shared/openrouter        OPENROUTER_MANAGEMENT_KEY="<prod key>"    OPENROUTER_WORKSPACE_ID="<vetra-prod workspace id>"
bao kv get -format=json kv/powerhouse/shared/openrouter-staging | jq '.data.data | keys'
```

  The paths sit under `powerhouse/shared/`, which the `external-secrets` role's `powerhouse-shared-read` policy already reads (memory: GitHub App secrets use the same prefix).

- [ ] **Step 3: Release the cloud package and wire the config (staging).** Merge `feat/studio-openrouter` (Tasks 1–9) and publish it as the staging line. In `tenants/staging/powerhouse-values.yaml`:
  - bump `PH_REGISTRY_PACKAGES` (`:143`) to the new `@powerhousedao/vetra-cloud-package@<version>`;
  - add to `switchboard.extraExternalSecret.sources`:

```yaml
      # OpenRouter (vetra-llm key broker): staging workspace + management key.
      - key: powerhouse/shared/openrouter-staging
        properties: [OPENROUTER_MANAGEMENT_KEY, OPENROUTER_WORKSPACE_ID]
```

  - add to the switchboard `env` block, next to `STUDIO_POOL_VERSION`:

```yaml
    # Monthly LLM budget (USD) of a Studio whose invite code sets none; 0 = no Vetra key.
    VETRA_LLM_DEFAULT_BUDGET_USD: "5"
    # Keep writing the licence's Anthropic key on claim until the agent cut-over (step 9).
    STUDIO_POOL_LEGACY_ANTHROPIC_KEY: "true"
```

  Commit and push, then let ArgoCD sync. Pass criteria:
  - the switchboard log shows no `OPENROUTER_MANAGEMENT_KEY unset` and no `OPENROUTER_WORKSPACE_ID unset`;
  - `query { vetraLlm { studioLlmStatus(environmentId: "<an existing Studio id you own>") { connected } } }` answers `false`.

- [ ] **Step 4: Budgets.** Deploy vetra.io Task 13. In Publisher → vetra-studio → Invite codes, use "Set budget" on each active Studio code with the amount the product owner signs off.
  - The sweeper reaches existing holders within 15 minutes.
  - Codes left empty use `VETRA_LLM_DEFAULT_BUDGET_USD`.

- [ ] **Step 5: Live checks with one fresh Studio (staging).**
  - Redeem a budgeted code with a test wallet and create a Studio. The pool claim path is in place since step 3.
  - Then:
    - `studioLlmStatus` must be `connected: true`;
    - the OpenRouter dashboard must show one `studio:<envId>` key in `vetra-staging` with the code's limit and a monthly reset.
  - Run the caching eval from Task 10 with that key, from `/home/f/projects/vetra-cli-openrouter`:

```bash
RUN_AGENT_EVALS=1 OPENROUTER_API_KEY="<the studio:<envId> key, read once from the tenant secret by an admin>" pnpm --filter vetra-cli test -- tests/agent-eval/openrouter-cache.eval.test.ts
```

  Pass means `cachedInputTokens > 0` on the second turn. On failure, stop here: the agent cut-over (step 8) waits until caching works. The fallback is message-level `providerOptions.openrouter.cacheControl`, which the provider reads at `@openrouter/ai-sdk-provider@1.5.4` `dist/index.mjs:1165-1176`.

- [ ] **Step 6: Migration, step 2 of the spec (staging).** As a platform admin, against `https://switchboard.staging.vetra.io/graphql` with a Renown bearer, run:

```graphql
mutation { vetraLlm { migrateStudiosToOpenRouter { dryRun scanned provisioned noBudget noLicence failed } } }
```

  Review the dry-run lists. Then run it for real (it is idempotent, so re-run until `failed` is empty):

```graphql
mutation { vetraLlm { migrateStudiosToOpenRouter(dryRun: false) { scanned provisioned noBudget noLicence failed } } }
```

  - Old agents keep running on their Anthropic secret; the OpenRouter secret sits next to it.
  - Each secret write triggers one Reloader restart of that Studio's pod, which is harmless.
  - Tell the owners in `noBudget` and `noLicence` that their Studio will show "Connect a model" after the cut-over.

- [ ] **Step 7: Publish the OpenRouter agent.** Merge the `vetra-cli` branch (Tasks 10–11) and run `pnpm publish:dev` from `/home/f/projects/vetra-cli` (it needs npmjs auth). Note the published `0.0.1-dev.N`.

- [ ] **Step 8: Cut-over, step 3 of the spec (staging).**
  - Set `STUDIO_POOL_VERSION` (`tenants/staging/powerhouse-values.yaml:293`) to the new version. Set `STUDIO_AGENT_VERSION` in `vetra.io/modules/cloud/studio/constants.ts:15` to the same.
  - Push, and let ArgoCD sync. Warm pods recycle, and with the new agent they serve READY even without a key.
  - Deploy vetra.io Task 12 now (see the ordering rule).
  - Claimed Studios keep their pinned version. For each id in the step 6 report, the owner or an admin updates the `vetra` package to the new version on the environment page (`SET_PACKAGE_VERSION` + approve), which restarts it on the new agent.
  - Verify:
    - a freshly claimed Studio answers a chat;
    - a Studio with no budget answers exactly "No model is connected. Open Studio settings → Model to use the Vetra budget or connect your OpenRouter account." and its card shows "Connect a model";
    - `https://staging.vetra.io/health` reports the new vetra.io build.

- [ ] **Step 9: Remove the Anthropic secrets, step 4 of the spec (staging, after a day of verification).**
  - Set `STUDIO_POOL_LEGACY_ANTHROPIC_KEY: "false"` and sync.
  - Run:

```graphql
mutation { vetraLlm { migrateStudiosToOpenRouter(dryRun: false, removeAnthropicSecrets: true) { scanned anthropicSecretsRemoved failed } } }
```

- [ ] **Step 10: Prod.** Repeat steps 3–9 against `tenants/vetra/powerhouse-values.yaml`:
  - read the secret from `powerhouse/shared/openrouter`;
  - bump the `PH_REGISTRY_PACKAGES` pins at `:155` and `:315`;
  - set `STUDIO_POOL_VERSION` at `:223`;
  - use the switchboard at `https://switchboard.vetra.io/graphql`;
  - start prod with `VETRA_LLM_DEFAULT_BUDGET_USD: "0"`, so only codes with an explicit budget provision keys, and raise it when the product owner decides.
  - Prod lags until staging has run a full day after step 9.
