# Console backend designs: roles, API tokens, schedules, health history

The console proposals (sidebar, pending changes, logs, directory, …) shipped as vetra.io PRs.
Four proposals need backend work in `vetra-cloud-package` and decide who can do what, so they
are written up here for a decision before anyone builds them. Each section ends with the
questions that block it.

## 16 · Team roles: Owner, Admin, Viewer

**Today.** Teams (Renown organisations) have members, and every member has the same rights.
Organisation environments check `canOperate` through the org-sync contract
(`modules/cloud/org-sync.ts`). Environment *creation* is gated only in the client
(`EarlyAccessGate`): any authenticated wallet can create an environment through the API,
because reactor-api has no creation hook (`AuthorizationService` is document- and
parent-based, there is no `canCreate(type, user)`).

**Proposal.**
- Roles live on the organisation, not the environment: `OWNER` (billing, delete, hand-over,
  roles), `ADMIN` (deploy, config, packages, agents), `VIEWER` (read: logs, metrics, settings).
- The environment document keeps `SYNC_ORG_OPERATORS` as the list of addresses allowed to
  sign. Extend it to carry the role per address, and have the reducer reject owner-only and
  admin-only actions from lower roles (the reducer already enforces owner-gated actions, so
  this extends an existing check rather than adding a new layer).
- Viewers never sign, so they need no operator entry: read access stays as it is.
- Creation stays the hard part. Two options, as already analysed for the invite-code gate:
  1. **Dedicated environment drive** that is write-protected, with WRITE granted on redeem or
     to organisation admins. True prevention, but a migration of every environment document
     out of the shared `powerhouse` drive.
  2. **Reactive reaper**: a processor deletes environments created by addresses without the
     right. Small and local, with a benign window (reaping takes seconds, provisioning
     minutes).

**Decide.** Role names and rights as above? Creation enforcement: drive migration (1) or
reaper (2)? Who may change roles: owners only?

## 17 · API tokens for CI and agents

**Today.** Every write is a Renown-signed action; reads use the Renown bearer. The CLI
reuses the same login. There is no token a CI job or an MCP client can hold.

**Proposal.** Two shapes, pick one:
- **Delegated Renown keys (recommended).** A token is a key pair whose public DID is added to
  the environment's operator list with a scope (`read`, `deploy`) and an expiry, signed by the
  owner. Actions signed with it go through the same reducer checks as a person, so the
  security model stays "who signed this action". Revoking removes the DID. The console shows
  the private key once.
- **Bearer tokens in a subgraph.** Random secrets stored hashed, checked by the switchboard
  before dispatching on the holder's behalf. Simpler for CI, but the switchboard then signs
  for users, which breaks "every action is signed by its author".

**Decide.** Delegated keys or bearer tokens? Scopes (`read`, `deploy`, `admin`)? Default and
maximum expiry? Per environment only, or per organisation too?

## 18 · Scheduled tasks

**Today.** Backups already run on a schedule (`SET_BACKUP_SCHEDULE`). Agents (CLINT services)
are long-running pods, not jobs, so "run an agent every 15 minutes" has no meaning yet.
Auto-update follows a channel, with no time window.

**Proposal.**
- A `SCHEDULES` list on the environment: `{ id, cron, target, enabled }` where `target` is one
  of `backup` (moves the existing schedule here), `agent-message` (send a prompt to a running
  agent's endpoint) or `mutation` (a GraphQL mutation against the environment's switchboard,
  run with a delegated key from 17).
- A processor evaluates due schedules and records each run's result for the console's last
  ten runs.

**Decide.** Is `agent-message` the right meaning of "scheduling an agent"? May scheduled
mutations exist before API tokens (17)? Do auto-update windows belong here?

## 20 · Health history and public status pages

**Today.** Environment health is polled live (`fetchEnvironmentOverview`: Argo health, sync,
domain, TLS) and not stored. The observability pull-worker already writes Studio identity to
obsDB, so a store exists next to the right data.

**Proposal.**
- The pull-worker records one health sample per environment per minute (service, ok/degraded/
  down) into obsDB, rolled up to daily uptime after 7 days.
- A public `environmentStatus(slug)` query returns daily uptime per opted-in service for 90
  days, with no internal names. The page `status.<env>.vetra.io` (or `/status/<slug>`) renders
  it. Opt-in per environment, and the owner chooses which services appear.

**Decide.** Retention (7 days raw, 90 days daily)? Opt-in default off? Host the page on
vetra.io or on the environment's own domain?

## Status of the rest

| Proposal | Where it stands |
|---|---|
| 05 rollback to any approval | vetra.io PR: restore an earlier configuration from the operation history (no backend change) |
| 15 notifications | cloud-package PR: one webhook per environment (works with Slack and Discord incoming webhooks). Email needs a sender domain and SMTP credentials |
| 19 CLI environment commands | vetra-cli PR: `vetra env list/show/add-package/remove-package/approve` |
| 28 install counts | cloud-package PR: `packageInstallCounts` query. The directory's Most used tab follows once it is pinned on staging |
