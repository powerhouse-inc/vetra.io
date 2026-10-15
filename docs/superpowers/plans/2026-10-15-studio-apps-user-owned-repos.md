# Studio Apps in the user's own GitHub: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** "Make it an App" creates the repo in a GitHub account or org that the user has connected (where Vetra Deploy is installed), not in a Vetra-managed org. This is the same model as importing an existing repo in the Apps wizard.

**Architecture:**

- `createStudioApp` takes the user's `installationId`.
- The server checks that the caller connected that installation (`github_deploy_connections`).
- It creates the repo **with the user's GitHub token**, so GitHub enforces the user's own right to create repos there:
  - for an org account: `POST /orgs/{login}/repos`;
  - for a user account: `POST /user/repos`.
- If the installation covers selected repos only, the new repo is added to it (`PUT /user/installations/{id}/repositories/{repoId}`, user token).
- The variable, the workflow commit and the undo delete use the installation token, as before.
- The managed-org config (`managedGithub`, `VETRA_APPS_MANAGED_*`) is removed.

**Spec:** `docs/superpowers/specs/2026-10-15-studio-end-to-end-flow-design.md`. This plan supersedes its "Vetra-managed org" default (user decision, 2026-10-15).

## Contract (fixed; both repos build against it)

```graphql
input CreateStudioAppInput {
  name: String!
  studioEnvironmentId: String!
  installationId: String!
  orgId: String
}
```

New error: `GITHUB_NOT_CONNECTED`, already a known code with a frontend reconnect flow. It is raised when the installation is not among the caller's connections, or the user token cannot be refreshed. `FORBIDDEN` is raised when GitHub refuses repo creation (403): "You cannot create repositories in <login> on GitHub".

## Global Constraints

- Commits are small, with NO Co-Authored-By or AI attribution trailer.
- vetra-cloud-package gate: `pnpm tsc && pnpm lint && pnpm vitest run` and oxfmt on the changed files.
- vetra.io gate: `npm run tsc && npm run lint && npm run format:check && npm run test:unit`.
- Raw `sql\`\`` table references are forbidden in subgraph code. Use the Kysely builder (the namespace schema).
- Keep everything `createStudioApp` already guarantees:
  - the per-Studio lock;
  - the unique-index backstop;
  - provision last;
  - the org / terminated checks;
  - undo deletes the repo, Harbor, robot, identity and row;
  - the repo must come back private.

## Review Focus

1. The caller passes someone else's `installationId` → `GITHUB_NOT_CONNECTED`, and nothing is created.
2. The user lacks the right to create repos in the org (GitHub 403) → `FORBIDDEN` with a clear message, and nothing is left behind.
3. A selected-repos installation → the new repo is added to it before the installation-token calls (variable, commit) run.
4. A name taken in the user's account (422) → next suffix, as before.
5. A user-account installation (`accountType: "User"`) uses `/user/repos`; an org uses `/orgs/{login}/repos`.

---

### Task 1: Backend: create the repo in the user's connected installation (vetra-cloud-package)

**Files:**

- `subgraphs/vetra-apps/github.ts`:
  - replace `createOrgRepo(installationId, org, …)` with `createRepoAsUser(userToken, account: {login, type}, name, description): Promise<GithubRepo>`. Use `/orgs/{login}/repos` for `type === "Organization"` and `/user/repos` otherwise. Keep `RepoNameTakenError` on a 422 "already exists" and the private check;
  - add `addRepoToInstallation(userToken, installationId, repositoryId): Promise<void>` (204/304 = ok);
  - add `getInstallationRepositorySelection(installationId): Promise<"all" | "selected">` (`GET /app/installations/{id}` with the app JWT), or fetch it once with an equivalent call that already exists.
- `subgraphs/vetra-apps/service.ts` `createStudioApp`:
  - `input.installationId` is required;
  - load the caller's connection row (account login/type) or throw `GITHUB_NOT_CONNECTED`;
  - `userTokenFor()` → `createRepoAsUser`;
  - map a GitHub 403 to `FORBIDDEN` "You cannot create repositories in <login> on GitHub";
  - add the repo to the installation when it is `selected`;
  - store `installation_id` = `input.installationId`;
  - undo deletes with that installation's token.
- `subgraphs/vetra-apps/config.ts`: remove `managedGithub` and its env, test and harness entries.
- `schema.ts` / `resolvers.ts`: `installationId: String!` in `CreateStudioAppInput`.
- Tests: `__tests__/studio-apps.test.ts`, `__tests__/github.test.ts`, `__tests__/resolvers.test.ts`, `__tests__/config.test.ts`. Update the fakes (`fakeGithub`: `createRepoAsUser` recording `(token, account, name)`, `addRepoToInstallation`, and the repository selection per installation id). Cover every Review Focus item.

Commit(s) end with "feat(apps): create Studio App repos in the user's connected GitHub".

### Task 2: Frontend: pick where the repo lives (vetra.io)

**Files:**

- `modules/apps/types.ts`: `CreateStudioAppInput.installationId: string`.
- `modules/cloud/studio/components/make-app-dialog.tsx`:
  - load `useMyGithubDeployInstallations()`;
  - with none, show the existing connect/install flow (reuse what `new-app-wizard.tsx` / `repo-picker.tsx` / `github-flow-link.tsx` render for "connect GitHub"), and disable submit;
  - with one or more, show a select "Repository owner" (`accountLogin`, defaulting to the first) and send its `installationId`;
  - on `GITHUB_NOT_CONNECTED`, render `ReconnectGithub`.
- Copy: "Creates a private GitHub repository in <accountLogin> for this Studio, with Vetra deploys set up: every pull request gets a preview, and merging to main ships to production. It also creates the App's production environment."
- Tests in `modules/cloud/studio/components/__tests__/make-app-dialog.test.tsx`:
  - no installations → connect shown, submit disabled;
  - two installations → the selected one's id is sent;
  - `GITHUB_NOT_CONNECTED` → reconnect shown.

Commit: "feat(studio): create the Studio App repo in the user's connected GitHub".

### Task 3: Deploy

1. Staging: release the backend and frontend together, because the contract changed. Remove `VETRA_APPS_MANAGED_*` from the staging values, and keep `NEXT_PUBLIC_STUDIO_APPS_ENABLED`.
2. Test end to end with the `web3-berlin` installation.
3. Prod: release, then enable `NEXT_PUBLIC_STUDIO_APPS_ENABLED`.
