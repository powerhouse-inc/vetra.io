# Vetra Studio on OpenRouter

Status: design approved in conversation 2026-10-15; written spec for review
Repos: `vetra-cli` (agent), `vetra-cloud-package` (broker, licensing, pool), `vetra.io` (UI), `powerhouse-k8s-hosting` (config)

## Why

The Studio agent is Anthropic-only today. That causes four problems.

- **Keys.** A key comes either from an invite code, through the publisher's Anthropic key, or from the user pasting one. It is then written under three Anthropic secret names.
- **Dead Studios.** A Studio without a key never serves. The pod runs `while true; sleep 5` and the UI shows "provisioning" forever. This happened on staging on 2026-10-15.
- **No spend control.** Nobody can see or cap spend, and there is no metering anywhere.
- **No model choice.** Users can only run Claude.

## Decisions (user, 2026-10-15)

1. **Who pays: both.** By default Vetra provisions a capped OpenRouter key for each Studio from the licence's monthly LLM budget. Users can also connect their own OpenRouter account and use it instead.
2. **Model choice: any OpenRouter model**, for everyone, on either budget. The picker lists only models that OpenRouter reports as supporting tools, because the agent cannot work without tool calls.
3. **The Anthropic integration is removed:**
   - `@ai-sdk/anthropic`;
   - the Claude.ai subscription login (`claude-login`, `ph-clint-claude-subscription`);
   - the Anthropic secret names, the invite-code Anthropic key, `applyStudioKey`, and the Anthropic-specific copy.

## Facts this builds on (verified 2026-10-15)

- The agent is Mastra-only: `vetra-agent` plus three sub-agents with tools, MCP, LibSQL memory and observational memory. Models are configured in `src/framework.ts` (`VETRA_MODEL` and `VETRA_MEMORY_MODEL`). The sub-agent model is hard-coded in `src/agents/agent.ts:19`, and `cacheControl: true` is hard-coded at `agent.ts:145`.
- The agent reads the key from `VETRA_ANTHROPIC_API_KEY` (`anthropicApiKey`). The hold loop is in `vetra-cli/Dockerfile:194-200`, and `require-key.ts` throws when the key is missing.
- OpenRouter offers the following (docs, 2026-10-15):
  - management keys: `POST/GET/PATCH/DELETE /api/v1/keys`, with `limit`, `limit_reset`, `disabled` and per-key usage windows;
  - `GET /api/v1/key` for a key's own usage;
  - an OAuth PKCE flow (`https://openrouter.ai/auth`, then `POST /api/v1/auth/keys`) that returns a key owned by the user;
  - provider preferences (`data_collection`, `zdr`, `order`, `only`) and model fallbacks (`models`);
  - `usage.cost` in every response, including the last SSE chunk;
  - Anthropic prompt caching through `cache_control`;
  - the AI SDK provider `@openrouter/ai-sdk-provider`, which Mastra supports.
- There is no metering today, so nothing has to be migrated on that side.

## Architecture

```
vetra.io ──GraphQL──▶ vetra-llm subgraph (broker) ──management key──▶ OpenRouter /api/v1/keys
   │                       │  provisions/limits/disables per-Studio keys
   │ OAuth PKCE            │  writes OPENROUTER_API_KEY + VETRA_MODEL* via vetra-cloud-secrets
   ▼                       ▼
OpenRouter /auth      tenant <id>-secrets / <id>-env ──envFrom──▶ Studio pod (vetra-cli)
                                                                   └─ @openrouter/ai-sdk-provider ──▶ OpenRouter
```

### 1. Agent (`vetra-cli`)

- **Model layer.** Every Mastra agent (main, sub-agents, memory) gets its model from one factory, `llm.ts`:
  - `createOpenRouter({ apiKey, headers: { "HTTP-Referer": "https://vetra.io", "X-OpenRouter-Title": "Vetra Studio" } })`;
  - `extraBody.provider` comes from config: the privacy default is `{ data_collection: "deny" }`, and `VETRA_LLM_ALLOW_DATA_COLLECTION=true` relaxes it;
  - `extraBody.models` carries the optional fallbacks from `VETRA_MODEL_FALLBACKS`, a comma list of at most 3;
  - the same `llm.ts` is used by `agent-run.ts` and `src/mastra/index.ts`.
- **Configuration.**

  | Setting           | Env                       | Default                     |
  | ----------------- | ------------------------- | --------------------------- |
  | key               | `OPENROUTER_API_KEY`      | none                        |
  | main model        | `VETRA_MODEL`             | `anthropic/claude-sonnet-4.6` |
  | sub-agent model   | `VETRA_SUBAGENT_MODEL`    | the main model              |
  | memory model      | `VETRA_MEMORY_MODEL`      | `anthropic/claude-haiku-4.5`  |
  | fallbacks         | `VETRA_MODEL_FALLBACKS`   | empty                       |

  The exact OpenRouter model ids are confirmed against `/api/v1/models` during implementation.
- **Caching.** `cacheControl` is set only when the model id starts with `anthropic/`, through the OpenRouter provider's cache options. A live eval (`RUN_AGENT_EVALS=1`) asserts that cached-token usage is above zero on the second turn.
- **Context limit.** At boot the agent fetches the model's `context_length` from `GET https://openrouter.ai/api/v1/models` (cached, with a 200k fallback). `TokenLimiterProcessor` uses 80% of that value.
- **Cost.** `mapMastraStream` copies `usage.cost` from the finish chunk into the chat-session usage (`costUsd`, accumulated). The chat UI shows the cost per conversation.
- **No key means "connect a model", not a dead pod.**
  - The Dockerfile hold loop and `VETRA_REQUIRE_API_KEY` go away. The agent always serves.
  - With no key, the chat trigger answers with a system message: "No model is connected. Open Studio settings → Model to use the Vetra budget or connect your OpenRouter account." No LLM call is made.
  - Warm pool pods also serve, so the observability poller sees READY.
- **Removed:**
  - `@ai-sdk/anthropic`;
  - `@powerhousedao/ph-clint-claude-subscription`;
  - `claude-login` and the subscription branch of `resolveClaudeAgentModel`;
  - `anthropicApiKey` and the three Anthropic env names;
  - "console.anthropic.com" in `setup-auth.ts`, which now points to openrouter.ai/keys.

  `setup-auth` stores `openrouterApiKey` in the same local config files as before.

### 2. LLM key broker (`vetra-cloud-package`, new subgraph `vetra-llm`)

**Configuration.**

- `OPENROUTER_MANAGEMENT_KEY` comes from OpenBao (`kv/powerhouse/shared/openrouter`) through an ExternalSecret.
- `OPENROUTER_OAUTH_CALLBACK_URL` is set per tenant.
- If the key is missing, the broker refuses with `SERVICE_NOT_CONFIGURED`. No other subgraph breaks.

**Table `studio_llm_keys`** (Kysely builder only; no raw `sql` table references in subgraph code):

| column                      | notes                                                   |
| --------------------------- | ------------------------------------------------------- |
| `environment_id`            | PK                                                      |
| `source`                    | `VETRA` or `BYO`                                        |
| `key_hash`                  | OpenRouter hash; `VETRA` only                           |
| `key_ciphertext`            | the key, encrypted with the existing keyVault (transit) |
| `limit_usd`, `limit_reset`  | `monthly` by default                                    |
| `model`                     |                                                         |
| `owner_did`                 |                                                         |
| `status`                    | `ACTIVE`, `DISABLED` or `DELETED`                       |
| `created_at`, `updated_at`  |                                                         |

**Budget source.** A licence's monthly budget comes from the invite code it was redeemed from (`invite_codes.llm_budget_usd`, nullable) and follows the licence chain, as `keyCiphertext` does today. A plan default (`VETRA_LLM_DEFAULT_BUDGET_USD`, per tenant) applies when the code has none. A budget of 0 means no Vetra key. The Studio then serves in "connect a model" mode.

**Operations.**

| Operation | Called by | What it does |
| --- | --- | --- |
| `provisionVetraKey(envId)` | the pool claim (replacing the key check and the Anthropic write) and cold creation (replacing `applyStudioKey`) | `POST /api/v1/keys {name: "studio:<envId>", limit, limit_reset: "monthly"}`. Stores the hash and ciphertext. Writes the `OPENROUTER_API_KEY` secret and the `VETRA_MODEL` var through `SecretsService`. Idempotent per env. |
| `connectOpenRouter(envId, code, codeVerifier)` | the vetra.io OAuth callback | Exchanges the code at `POST /api/v1/auth/keys` for a key the user owns. Sets `source=BYO` and writes the secret. Disables the env's Vetra key, which is kept so the user can switch back. |
| `useVetraBudget(envId)` | Studio settings | Re-enables the Vetra key and rewrites the secret. The user's own key is forgotten: its ciphertext is deleted. Revoking it is the user's job on openrouter.ai, and the UI says so. |
| `setStudioModel(envId, model, fallbacks?)` | Studio settings | Validates the model against the tool-capable list, then writes `VETRA_MODEL` / `VETRA_MODEL_FALLBACKS`. Reloader restarts the pod, as for any env change. |
| `studioLlmUsage(envId)` | the Studio card and settings | `{source, model, usageUsd, limitUsd, resetsAt}`. Read from `GET /api/v1/keys/{hash}` for `VETRA`, or `GET /api/v1/key` with the user's key for `BYO`. Cached for 60 seconds. |
| `llmModels` | the picker | The OpenRouter `/api/v1/models` list filtered to `supported_parameters` that include `tools`, with price, context and name. Cached for 1 hour. |

**Who may call.** All mutations require the caller to operate the env, through the existing `canOperate`, and the env must be a Studio (`isStudioAgentPackage`).

**Lifecycle sweeper** (every 15 minutes, like the Apps watcher):

- Studio deleted → delete the key.
- Licence no longer usable → `PATCH disabled: true` and remove the secret.
- Licence renewed → re-enable the key and update `limit`.
- Budget changed on the code → `PATCH limit`.
- Keys found on OpenRouter with the `studio:` prefix and no matching row → delete them (orphans).

**Errors and safety.**

- OpenRouter 4xx/5xx are mapped to clean GraphQL errors.
- Provisioning is undone on failure: if the key was created but the secret write failed, the key is deleted.
- Keys and ciphertext are never logged. The redaction pattern grows from `sk-ant-` to `sk-or-`.

### 3. Licensing and invite codes

- `invite_codes.llm_budget_usd` is added (nullable numeric). The fields `createInviteCode.input.llmBudgetUsd` and `setInviteCodeLlmBudget(appId, code, llmBudgetUsd)` take the place of the Anthropic key fields.
- `PublisherInviteCode` gets `llmBudgetUsd`, and `hasAnthropicKey` is removed.
- `StudioAccess.hasAttachedKey` becomes `llmBudgetUsd` (the effective monthly budget, or 0).
- Retired:
  - `anthropicKey` on create;
  - `setInviteCodeAnthropicKey` (shipped 2026-10-15; it is replaced, never released to prod users);
  - `applyStudioKey`;
  - `STUDIO_KEY_SECRET_NAMES`.

  The `anthropic_key_ciphertext` column stays, unread, and is dropped in phase 3.

### 4. vetra.io

- **Create Studio.** There is no key field. Creation always finishes. If the licence has a budget, the key is provisioned server-side. If not, the Studio comes up in "connect a model" mode, and the card says "Connect a model". The earlier missing-key toast is removed.
- **Studio card.** It shows the model chip and a budget meter ("€3.20 of €20 this month", resetting on date X), or "Your OpenRouter account" for a user-owned key.
- **Studio settings → Model.**
  - A searchable picker shows the name, provider, price per 1M input and output tokens, context size and a "great for coding" hint (a curated tag list, display only). Fallbacks are an optional multi-select of up to 3.
  - The source switch offers **Vetra budget** or **Connect OpenRouter**. Connecting uses OAuth PKCE: the `code_verifier` is kept in sessionStorage, the callback is `/user/studio/openrouter/callback`, and the callback calls `connectOpenRouter`.
- **Publisher → Invite codes.** A "Monthly LLM budget" field, plus a "Set budget" action that replaces "Set Claude key".
- **Copy.** Every Anthropic and Claude reference is replaced. For example, the landing page says "Any model. Our budget or yours."

### 5. Config (`powerhouse-k8s-hosting`)

- The OpenBao entry `kv/powerhouse/shared/openrouter` holds `OPENROUTER_MANAGEMENT_KEY`. One OpenRouter organisation is used, with separate keys for staging and prod.
- Switchboard env: `OPENROUTER_OAUTH_CALLBACK_URL` and `VETRA_LLM_DEFAULT_BUDGET_USD`, set per tenant.
- `STUDIO_POOL_VERSION` is bumped to the OpenRouter agent build, staging first.

## Migration and cut-over (staging, then prod)

1. Deploy the broker and licensing changes. The old agent keeps running, still reading the Anthropic secrets.
2. Run the one-time job `migrateStudiosToOpenRouter`. For every live, claimed Studio with a usable licence, it calls `provisionVetraKey`. It does not yet remove the Anthropic secrets, so both secrets are present. Studios whose users had pasted their own Anthropic key get a Vetra key (if a budget exists) or come up in "connect a model" mode, and their owners are told through the Studio card.
3. Publish the OpenRouter agent build and bump `STUDIO_POOL_VERSION`. Warm pods recycle. Claimed Studios pick up the new agent when they are re-provisioned or restarted. The plan lists the restart step.
4. After verification, delete the three Anthropic secrets from every tenant. This is a script through `SecretsService`.

## Testing

- **Agent.**
  - Unit tests for the `llm.ts` factory: headers, provider preferences, fallbacks, cache-control gating.
  - The "no key" chat reply.
  - The context-limit fallback.
  - Cost accumulation in `mapMastraStream`.
  - e2e keeps the replay fixture, with no live LLM.
  - A live eval runs only behind `RUN_AGENT_EVALS=1`.
- **Broker.**
  - A fake OpenRouter covering keys, auth/keys, key and models.
  - Provisioning: idempotent, undone on secret failure.
  - Switching BYO ↔ VETRA.
  - Sweeper rules.
  - Permissions: non-operators are refused.
  - A namespaced migration test (`withSchema`) for the new table and column.
- **vetra.io.** The picker filtering, the meter rendering, the OAuth callback (state and verifier), the invite-code budget dialog, and Studio creation with no key field.

## Phases (each shippable)

1. **OpenRouter core.**
   - The agent's `llm.ts`, the no-key mode and cost tracking.
   - The broker with a Vetra budget: provisioning, sweeper, `studioLlmUsage`.
   - The licensing budget field.
   - The pool and cold creation switched to the broker.
   - The migration job and the cut-over.
2. **Choice and control.**
   - OAuth "Connect OpenRouter" and `useVetraBudget`.
   - The model picker with `llmModels` / `setStudioModel` and fallbacks.
   - The meter on the card and in settings.
   - The invite-code budget UI.
3. **Removal.**
   - Delete the Anthropic code paths, packages, secret names and copy.
   - Drop `anthropic_key_ciphertext`.
   - Remove `claude-login`.

## Open points, resolved during implementation

- Confirm the exact OpenRouter model ids (`anthropic/claude-sonnet-4.6` etc.) and the `limit_reset` values (`monthly`) against the live API before coding the defaults.
- Confirm that Anthropic caching works through `@openrouter/ai-sdk-provider` (a known historical issue). If it does not, set `cache_control` through `extraBody` / `providerOptions.openrouter` instead.
- Decide whether OAuth keys should be created in a specific OpenRouter workspace (`workspace_id`). The default is no.
