# Studio → App flow, delivery steps 1–3, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user on `/user/studio` can turn a Studio into an App. One click creates:

- a private repo in the Vetra-managed GitHub org, with the Vetra deploy workflow in its first commit;
- the `VETRA_APP_ID` repo variable;
- the Harbor project, the Renown identity and the production environment;
- a link from the App back to the Studio environment.

**Architecture:**

- A new `createStudioApp` service in `vetra-cloud-package/subgraphs/vetra-apps`. It reuses `createApp`'s internals, extracted first with no behaviour change.
- The single GitHub App `vetra-deploy` gains four installation-token calls: create an org repo, delete a repo, set a repo variable, commit a file.
- `ph init` in powerhouse scaffolds the same workflow, so projects the agent creates match the server's template.
- vetra.io gets a "Make it an App" action on each Studio card.

**Tech Stack:**

- vetra-cloud-package: TypeScript, Kysely, GraphQL subgraph, vitest, oxlint
- powerhouse codegen: `@tmpl/core`, vitest
- vetra.io: Next.js 16, React Query, vitest

**Spec:** `docs/superpowers/specs/2026-10-15-studio-end-to-end-flow-design.md` (worktree `/home/f/projects/vetra.io-studio`)

**Repos and worktrees:**

| Repo                | Worktree                                          | Branch                                               |
| ------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| vetra-cloud-package | `/home/f/projects/vetra-cloud-package-studioflow` | `feat/studio-app-flow` (from `origin/main` 449a134)  |
| powerhouse          | `/home/f/projects/powerhouse-vetra-yml`           | `feat/codegen-vetra-workflow` (rebase onto `origin/main`) |
| vetra.io            | `/home/f/projects/vetra.io-studio`                | `explore/studio-integration`                         |

## Spec amendment (made while planning)

The spec said the Studio environment gets an env app-link role `STUDIO`. **This plan uses an `apps.studio_environment_id` column instead.** Reasons:

- an app link makes the environment App-operated: CI may deploy into it, and the FUSION allowlist widens to the App's project;
- CI must never deploy into the agent's workshop;
- the env link also stays free for the later `installed[]` work;
- the role enum change would need doc-model codegen, and the column needs none.

Task 9 updates the spec line.

**Also out of scope here, as delivery steps 4–5:**

- The agent pushing code to the new repo.
- The lazy production environment. `apps.production_environment_id` is `NOT NULL`, so this plan keeps the eager creation that `createApp` already does.

## Global Constraints

- Commits: small and incremental. **No `Co-Authored-By` or any AI attribution trailer.**
- vetra-cloud-package gate before each push: `pnpm tsc && pnpm lint && pnpm test`.
- vetra.io gate before each push: `npm run tsc && npm run lint && npm run format:check && npm run test:unit`.
- powerhouse: `pnpm --filter @powerhousedao/codegen test` plus the repo's `test/codegen` suite.
- Repo creation only in the managed org (decision 1). User-owned repos come later with "Take ownership".
- Only the human merges (decision 3). Nothing in this plan merges PRs.
- Never put the GitHub App private key in git; OpenBao only (`kv/powerhouse/shared/...`).
- The managed org's repos are **private**.

## Review Focus

1. **Repo name collision in the managed org** (a GitHub 422 on create). Expected: take the next slug suffix, as Harbor 409 already does, and never fail the user. → Task 4 test.
2. **Failure after the repo exists** (Renown refuses, the env dispatch throws). Expected: the repo, Harbor project, robot and row are all removed, and a retry with the same name succeeds. → Task 4 test.
3. **The same Studio turned into an App twice** (double click, two tabs). Expected: the second call gets `BAD_USER_INPUT` "This Studio is already an App", and no second repo is created. → Task 4 test (sequential) plus a unique index (concurrent).
4. **A non-Studio or foreign environment passed as `studioEnvironmentId`.** Expected: `BAD_USER_INPUT` / `FORBIDDEN`, and nothing created. → Task 4 test.
5. **The initial workflow commit triggering a CI run on an empty repo.** Expected: the commit message carries `[skip ci]`, so no run starts. → Task 3 asserts the message.

---

### Task 1: Extract `createApp` internals (no behaviour change)

`createStudioApp` must reuse the access checks, the slug and Harbor reservation, the row insert and the env dispatch. Extract them now, with the existing 15 `createApp` tests as the safety net.

**Files:**

- Modify: `subgraphs/vetra-apps/service.ts` (`createApp`, around lines 585–810)

**Interfaces:**

- Produces, all module-private and exported for tests only where noted:
  - `assertCreatePreconditions(deps, caller, name: string, orgId: string | null): Promise<string>`, which returns the trimmed name. It covers the workload refusal, name validation, the org role check and the Harbor/Renown/encryptionKey/handover config checks.
  - `reserveSlugAndProject(deps, harbor, name, made: CreateMade): Promise<string>`, which returns the slug and sets `made.project`.
  - `provisionProductionEnv(deps, caller, { appId, name, harborProject, productionBranch, orgId, attach: { envId, state } | null }, made): Promise<string>`, which returns the env id.

- [ ] **Step 1: Run the baseline**

  Run: `cd /home/f/projects/vetra-cloud-package-studioflow && pnpm install --frozen-lockfile && pnpm vitest run subgraphs/vetra-apps`

  Expected: all pass. Record the count.

- [ ] **Step 2: Extract the three helpers**

  Move the code verbatim from `createApp`:
  - lines from `await assertNotWorkload` to the `orgHandoverDb` check go into `assertCreatePreconditions`;
  - the Harbor slug loop goes into `reserveSlugAndProject`;
  - the `link`/`attach`/`dispatch` block goes into `provisionProductionEnv`.

  `createApp` calls them in the same order. `requireGithub(deps)` stays in `createApp`, because `createStudioApp` uses the managed installation instead.

- [ ] **Step 3: Re-run the suite and type-check**

  Run: `pnpm vitest run subgraphs/vetra-apps && pnpm tsc`

  Expected: same pass count as Step 1, and no type errors.

- [ ] **Step 4: Commit**

  ```bash
  git add subgraphs/vetra-apps/service.ts
  git commit -m "refactor(apps): extract createApp preconditions, slug reservation and env provisioning"
  ```

### Task 2: Managed-org config

**Files:**

- Modify: `subgraphs/vetra-apps/config.ts`
- Modify: `subgraphs/vetra-apps/__tests__/harness.ts` (`testConfig`)
- Test: `subgraphs/vetra-apps/__tests__/config.test.ts` (create)

**Interfaces:**

- Produces: `VetraAppsConfig.managedGithub: { org: string; installationId: string } | null`

- [ ] **Step 1: Write the failing test**

  ```ts
  import { describe, expect, it } from "vitest";
  import { loadAppsConfig } from "../config.js";

  describe("managed GitHub org", () => {
    it("is set only when both org and installation are given", () => {
      expect(loadAppsConfig({}).managedGithub).toBeNull();
      expect(
        loadAppsConfig({ VETRA_APPS_MANAGED_GITHUB_ORG: "vetra-apps" })
          .managedGithub,
      ).toBeNull();
      expect(
        loadAppsConfig({
          VETRA_APPS_MANAGED_GITHUB_ORG: " vetra-apps ",
          VETRA_APPS_MANAGED_INSTALLATION_ID: "123",
        }).managedGithub,
      ).toStrictEqual({ org: "vetra-apps", installationId: "123" });
    });
  });
  ```

- [ ] **Step 2: Run it**

  Run: `pnpm vitest run subgraphs/vetra-apps/__tests__/config.test.ts`

  Expected: FAIL (`managedGithub` is undefined).

- [ ] **Step 3: Implement**

  In `VetraAppsConfig`, add:

  ```ts
  /** Vetra-managed GitHub org where Studio Apps get their repos; null = Studio Apps disabled. */
  managedGithub: { org: string; installationId: string } | null;
  ```

  In `loadAppsConfig`, next to `studioAppSlug`:

  ```ts
  const managedOrg = trimmed(env.VETRA_APPS_MANAGED_GITHUB_ORG);
  const managedInstallation = trimmed(env.VETRA_APPS_MANAGED_INSTALLATION_ID);
  // ...in the returned object:
  managedGithub:
    managedOrg && managedInstallation
      ? { org: managedOrg, installationId: managedInstallation }
      : null,
  ```

  In `testConfig`, add `managedGithub: { org: "vetra-apps", installationId: "88" },` before `...over`.

- [ ] **Step 4: Run it**

  Run: `pnpm vitest run subgraphs/vetra-apps`

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add subgraphs/vetra-apps/config.ts subgraphs/vetra-apps/__tests__/
  git commit -m "feat(apps): config for the Vetra-managed GitHub org"
  ```

### Task 3: GitHub API: org repo, delete, variable, commit file

**Files:**

- Modify: `subgraphs/vetra-apps/github.ts` (the `GithubDeployApi` interface and `createGithubDeployApi`)
- Modify: `subgraphs/vetra-apps/__tests__/harness.ts` (`fakeGithub`)
- Test: `subgraphs/vetra-apps/__tests__/github.test.ts` (extend; it already tests the real client against a fake `fetch`. Follow its existing `fetchImpl` pattern.)

**Interfaces:**

- Produces, on `GithubDeployApi`:

  ```ts
  /** Create a private repo in `org` (POST /orgs/{org}/repos, auto_init). Throws RepoNameTakenError on 422 "name already exists". */
  createOrgRepo(installationId: string, org: string, name: string, description: string): Promise<GithubRepo>;
  /** DELETE /repos/{full}; 404 counts as done. */
  deleteRepo(installationId: string, repoFullName: string): Promise<void>;
  /** Create or update an Actions variable (POST, then PATCH on 409). */
  setRepoVariable(installationId: string, repoFullName: string, name: string, value: string): Promise<void>;
  /** PUT /repos/{full}/contents/{path} on the default branch. */
  commitFile(installationId: string, repoFullName: string, input: { path: string; content: string; message: string }): Promise<void>;
  ```

  ```ts
  export class RepoNameTakenError extends Error {}
  ```

- [ ] **Step 1: Write the failing tests** in `github.test.ts`. Use the file's existing fake-fetch helper to assert method, path and body:
  - `createOrgRepo` → `POST /orgs/vetra-apps/repos` with body `{ name: "shop", private: true, auto_init: true, description: "…" }`; it maps `{id: 5, full_name: "vetra-apps/shop", private: true, default_branch: "main"}` to `{ id: "5", fullName: "vetra-apps/shop", private: true, defaultBranch: "main" }`.
  - `createOrgRepo` on 422 whose body contains `name already exists` → rejects with `RepoNameTakenError`.
  - `deleteRepo` → `DELETE /repos/vetra-apps/shop`, and 404 resolves.
  - `setRepoVariable` → `POST /repos/vetra-apps/shop/actions/variables` with `{name, value}`. On 409 it sends `PATCH /repos/vetra-apps/shop/actions/variables/VETRA_APP_ID` with `{name, value}`.
  - `commitFile` → `PUT /repos/vetra-apps/shop/contents/.github/workflows/vetra.yml` with `{ message, content: base64(content) }`.

- [ ] **Step 2: Run them**

  Run: `pnpm vitest run subgraphs/vetra-apps/__tests__/github.test.ts`

  Expected: FAIL (`createOrgRepo` is not a function).

- [ ] **Step 3: Implement** in `createGithubDeployApi`, using the existing `inst<T>(installationId, method, path, body, okStatuses)` helper:

  ```ts
  async createOrgRepo(installationId, org, name, description) {
    const r = await inst<{ id: number; full_name: string; private: boolean; default_branch: string; message?: string; errors?: { message?: string }[] }>(
      installationId, "POST", `/orgs/${encodeURIComponent(org)}/repos`,
      { name, description, private: true, auto_init: true }, [422],
    );
    if (r.status === 422) {
      const text = JSON.stringify(r.data ?? "");
      if (/already exists/i.test(text)) throw new RepoNameTakenError(`${org}/${name} exists`);
      throw new GithubHttpError(422, `GitHub POST /orgs/${org}/repos → 422: ${text.slice(0, 300)}`);
    }
    return { id: String(r.data.id), fullName: r.data.full_name, private: r.data.private, defaultBranch: r.data.default_branch };
  },
  async deleteRepo(installationId, repoFullName) {
    await inst(installationId, "DELETE", `/repos/${repoFullName}`, undefined, [404]);
  },
  async setRepoVariable(installationId, repoFullName, name, value) {
    const r = await inst(installationId, "POST", `/repos/${repoFullName}/actions/variables`, { name, value }, [409]);
    if (r.status === 409)
      await inst(installationId, "PATCH", `/repos/${repoFullName}/actions/variables/${encodeURIComponent(name)}`, { name, value });
  },
  async commitFile(installationId, repoFullName, input) {
    await inst(installationId, "PUT", `/repos/${repoFullName}/contents/${input.path.split("/").map(encodeURIComponent).join("/")}`, {
      message: input.message,
      content: Buffer.from(input.content, "utf8").toString("base64"),
    });
  },
  ```

  In `fakeGithub`, add the following, and expose `takenRepoNames` and `repoCounter` on the returned type:

  ```ts
  takenRepoNames: new Set<string>(),
  createOrgRepo: rec("createOrgRepo", (_i: string, org: string, name: string) => {
    if (takenRepoNames.has(name)) throw new RepoNameTakenError(`${org}/${name} exists`);
    takenRepoNames.add(name);
    return { id: String(9000 + ++repoSeq), fullName: `${org}/${name}`, private: true, defaultBranch: "main" };
  }),
  deleteRepo: rec("deleteRepo", () => undefined),
  setRepoVariable: rec("setRepoVariable", () => undefined),
  commitFile: rec("commitFile", () => undefined),
  ```

- [ ] **Step 4: Run them**

  Run: `pnpm vitest run subgraphs/vetra-apps && pnpm tsc`

  Expected: all pass.

- [ ] **Step 5: Commit**

  ```bash
  git add subgraphs/vetra-apps/github.ts subgraphs/vetra-apps/__tests__/
  git commit -m "feat(apps): GitHub calls to create, delete and configure a managed repo"
  ```

### Task 4: `createStudioApp` service

**Files:**

- Modify: `subgraphs/vetra-apps/db/schema.ts` (`AppsTable.studio_environment_id: string | null`)
- Modify: `subgraphs/vetra-apps/db/migrations.ts`: add an idempotent `ensureAppsStudioColumn(db)` in the `ensureAppsOrgColumn` style, plus a partial unique index. Call it at the end of `up()`.
- Modify: `subgraphs/vetra-apps/service.ts`
- Test: `subgraphs/vetra-apps/__tests__/studio-apps.test.ts` (create)

**Interfaces:**

- Consumes:
  - `assertCreatePreconditions`, `reserveSlugAndProject`, `provisionProductionEnv` (Task 1)
  - `cfg.managedGithub` (Task 2)
  - `createOrgRepo`, `deleteRepo`, `setRepoVariable`, `commitFile`, `RepoNameTakenError` (Task 3)
  - `workflowTemplate` (`workflow-template.ts`)
  - `isStudioAgentPackage` (`shared/studio-package.ts`)
- Produces:

  ```ts
  export interface CreateStudioAppInput { name: string; studioEnvironmentId: string; orgId?: string | null }
  export async function createStudioApp(deps: AppsDeps, caller: Caller, input: CreateStudioAppInput): Promise<AppRow>;
  ```

  `CreateMade` gains `repo: string | null` (the full name). `undoFailedCreate` deletes it.

- [ ] **Step 1: Write the failing tests** in `studio-apps.test.ts`:

  ```ts
  import { afterEach, beforeEach, describe, expect, it } from "vitest";
  import { createStudioApp } from "../service.js";
  import { addPackage, approveChanges } from "../../../document-models/vetra-cloud-environment/v1/gen/creators.js";
  import { APP_DID, OWNER, makeHarness, owner, stranger, testConfig, type Harness } from "./harness.js";

  let h: Harness;
  beforeEach(async () => { h = await makeHarness(); });
  afterEach(async () => { await h.close(); });

  const code = (p: Promise<unknown>) =>
    p.then(() => "OK", (e: { extensions?: { code?: string } }) => e.extensions?.code ?? String(e));

  async function seedStudio(address = OWNER) {
    const id = await h.envs.seedStandalone(address);
    await h.envs.execute(id, [
      addPackage({ packageName: "vetra", version: "0.0.1-dev.27", registry: "https://registry.dev.vetra.io" }),
      approveChanges({}),
    ]);
    return id;
  }

  describe("createStudioApp", () => {
    it("creates a managed repo with the workflow and variable, the App, and links the studio", async () => {
      const studio = await seedStudio();
      const app = await createStudioApp(h.deps, owner, { name: "My Shop", studioEnvironmentId: studio });
      expect(app).toMatchObject({
        slug: "my-shop",
        status: "PENDING_IDENTITY",
        installation_id: "88",
        repository_full_name: "vetra-apps/my-shop",
        studio_environment_id: studio,
        identity_did: APP_DID,
      });
      expect(h.github.calls.createOrgRepo[0].slice(1, 3)).toStrictEqual(["vetra-apps", "my-shop"]);
      expect(h.github.calls.setRepoVariable[0]).toStrictEqual(["88", "vetra-apps/my-shop", "VETRA_APP_ID", app.id]);
      const [, repo, file] = h.github.calls.commitFile[0] as [string, string, { path: string; content: string; message: string }];
      expect(repo).toBe("vetra-apps/my-shop");
      expect(file.path).toBe(".github/workflows/vetra.yml");
      expect(file.content).toContain(`app-id: ${app.id}`);
      expect(file.message).toContain("[skip ci]");
      // The studio env is NOT app-linked (CI must never deploy into it).
      expect((await h.envs.getState(studio))!.app).toBeNull();
      expect((await h.envs.getState(app.production_environment_id))!.app).toMatchObject({ appId: app.id, role: "PRODUCTION" });
    });

    it("takes the next name when the repo name is taken in the managed org", async () => {
      h.github.takenRepoNames.add("my-shop");
      const app = await createStudioApp(h.deps, owner, { name: "My Shop", studioEnvironmentId: await seedStudio() });
      expect(app.repository_full_name).toBe("vetra-apps/my-shop-2");
      expect(app.slug).toBe("my-shop-2");
      expect(h.harbor.projects).toStrictEqual(["app-my-shop-2"]);
    });

    it("refuses a second App for the same studio without creating another repo", async () => {
      const studio = await seedStudio();
      await createStudioApp(h.deps, owner, { name: "A", studioEnvironmentId: studio });
      expect(await code(createStudioApp(h.deps, owner, { name: "B", studioEnvironmentId: studio }))).toBe("BAD_USER_INPUT");
      expect(h.github.calls.createOrgRepo).toHaveLength(1);
    });

    it("refuses a non-studio env and a studio of someone else", async () => {
      const plain = await h.envs.seedStandalone();
      expect(await code(createStudioApp(h.deps, owner, { name: "A", studioEnvironmentId: plain }))).toBe("BAD_USER_INPUT");
      const studio = await seedStudio();
      expect(await code(createStudioApp(h.deps, stranger, { name: "A", studioEnvironmentId: studio }))).toBe("FORBIDDEN");
      expect(h.github.calls.createOrgRepo ?? []).toHaveLength(0);
    });

    it("removes the repo, Harbor project and row when a later step fails, and a retry works", async () => {
      const studio = await seedStudio();
      h.renown.failNextRegistration = true;
      await expect(createStudioApp(h.deps, owner, { name: "Shop", studioEnvironmentId: studio })).rejects.toThrow();
      expect(h.github.calls.deleteRepo[0]).toStrictEqual(["88", "vetra-apps/shop"]);
      expect(h.harbor.projects).toStrictEqual([]);
      h.github.takenRepoNames.delete("shop"); // the fake does not model deletion
      const app = await createStudioApp(h.deps, owner, { name: "Shop", studioEnvironmentId: studio });
      expect(app.slug).toBe("shop");
    });

    it("is unavailable without a managed org", async () => {
      const h2 = await makeHarness({ cfg: testConfig({ managedGithub: null }) });
      try {
        expect(await code(createStudioApp(h2.deps, owner, { name: "A", studioEnvironmentId: "x" }))).toBe("SERVICE_NOT_CONFIGURED");
      } finally { await h2.close(); }
    });
  });
  ```

  Before writing, check two things in `harness.ts`:
  - whether `fakeRenown` has a failure switch. If not, add `failNextRegistration` (a boolean that makes the next `registerAppIdentity` throw once).
  - whether `makeHarness` accepts a config override. If it takes another shape, use that shape.

  Also check that `fakeHarbor().deleteProject` removes the project from `projects`.

- [ ] **Step 2: Run them**

  Run: `pnpm vitest run subgraphs/vetra-apps/__tests__/studio-apps.test.ts`

  Expected: FAIL (`createStudioApp` is not exported).

- [ ] **Step 3: Add the column and index** in `db/migrations.ts`:

  ```ts
  /** The Studio env an App was created from (null: imported repo). One App per Studio. */
  export async function ensureAppsStudioColumn(db: Kysely<any>): Promise<void> {
    try {
      await db.schema.alterTable("apps").addColumn("studio_environment_id", "varchar(255)").execute();
    } catch {
      // Column already exists
    }
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS apps_studio_env_live ON apps (studio_environment_id) WHERE status <> 'DELETED' AND studio_environment_id IS NOT NULL`.execute(db);
  }
  ```

  Call it at the end of `up()`, and add `import { sql } from "kysely"`. Add `studio_environment_id: string | null;` to `AppsTable`, and set `studio_environment_id: null` in `createApp`'s insert.

- [ ] **Step 4: Implement `createStudioApp`** in `service.ts`, below `createApp`:

  ```ts
  export interface CreateStudioAppInput {
    name: string;
    studioEnvironmentId: string;
    orgId?: string | null;
  }

  const WORKFLOW_PATH = ".github/workflows/vetra.yml";

  export async function createStudioApp(
    deps: AppsDeps,
    caller: Caller,
    input: CreateStudioAppInput,
  ): Promise<AppRow> {
    const managed = deps.cfg.managedGithub;
    if (!managed || !deps.github) throw notConfigured("The Vetra-managed GitHub org (VETRA_APPS_MANAGED_*)");
    const orgId = input.orgId?.trim() || null;
    const name = await assertCreatePreconditions(deps, caller, input.name, orgId);

    const studio = await deps.envs.getState(input.studioEnvironmentId);
    if (!studio || !studio.packages.some((p) => isStudioAgentPackage(p.packageName)))
      throw appsError("BAD_USER_INPUT", "Not a Vetra Studio");
    const mayUse = await canOperate(
      deps.orgs ?? null,
      { address: caller.address, isAdmin: false },
      { owner: studio.owner ?? null, ownerOrgId: studio.ownerOrgId ?? null, appDid: null },
    );
    if (!mayUse) throw appsError("FORBIDDEN", "You do not own this Studio");
    const taken = await deps.db
      .selectFrom("apps").select("id")
      .where("studio_environment_id", "=", input.studioEnvironmentId)
      .where("status", "!=", "DELETED")
      .executeTakeFirst();
    if (taken) throw appsError("BAD_USER_INPUT", "This Studio is already an App");

    const github = deps.github;
    const harbor = deps.harbor!;
    const made: CreateMade = { project: null, robotId: null, appId: null, announced: null, repo: null };
    let did: string | null = null;
    try {
      // Slug, Harbor project and repo name are the same word; a taken repo name
      // releases the project and takes the next suffix.
      let repo: GithubRepo | null = null;
      let slug = "";
      const conflicts = new Set<string>();
      for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS && !repo; attempt++) {
        slug = await reserveSlugAndProject(deps, harbor, name, made, conflicts);
        try {
          repo = await github.createOrgRepo(managed.installationId, managed.org, slug, `${name} — built with Vetra Studio`);
          made.repo = repo.fullName;
        } catch (err) {
          if (!(err instanceof RepoNameTakenError)) throw err;
          conflicts.add(slug);
          await harbor.deleteProject(made.project!);
          made.project = null;
        }
      }
      if (!repo) throw appsError("BAD_USER_INPUT", "Could not reserve a repository for this name; pick another name");

      did = await registerAppIdentity(deps, deps.renown!, {
        repositoryId: repo.id, repository: repo.fullName, productionBranch: "main",
        ownerAddress: caller.address, chainId: caller.chainId, orgId,
      });
      const robot = await harbor.createPushRobot(made.project!);
      made.robotId = robot.id;

      const appId = deps.newId();
      made.appId = appId;
      await insertAppRow(deps, {
        appId, slug, name, caller, orgId, did, robot,
        installationId: managed.installationId, repo, productionBranch: "main",
        harborProject: made.project!, productionEnvironmentId: null,
        studioEnvironmentId: input.studioEnvironmentId,
      });
      await provisionProductionEnv(deps, caller, {
        appId, name, harborProject: made.project!, productionBranch: "main", orgId, attach: null,
      }, made);

      await github.setRepoVariable(managed.installationId, repo.fullName, "VETRA_APP_ID", appId);
      await github.commitFile(managed.installationId, repo.fullName, {
        path: WORKFLOW_PATH,
        content: workflowTemplate(appId, "main", { packageManager: "pnpm", declaresPackageManager: false }),
        message: "chore: add the Vetra deploy workflow [skip ci]",
      });
    } catch (err) {
      await undoFailedCreate(deps, harbor, deps.renown!, did, made);
      throw err;
    }
    const created = (await getApp(deps.db, made.appId!))!;
    await mirrorAppRow(deps, created);
    return created;
  }
  ```

  Adjust the Task 1 helpers so this compiles:
  - `reserveSlugAndProject` takes the `conflicts` set (`createApp` passes a fresh one);
  - the row insert is extracted as `insertAppRow` (move the `.insertInto("apps")` block from `createApp`; `productionEnvironmentId: null` means "set by `provisionProductionEnv`");
  - `provisionProductionEnv` updates `production_environment_id` on the row after `envs.create()`.

  `undoFailedCreate` takes `did: string | null` and gains:

  ```ts
  if (made.repo && deps.github && deps.cfg.managedGithub)
    await step("deleting the repository", () =>
      deps.github!.deleteRepo(deps.cfg.managedGithub!.installationId, made.repo!));
  ```

  Skip the identity deletion when `did` is null.

  **Refinement before coding:** `production_environment_id` is `NOT NULL`. So either insert the row with a placeholder and update it, or keep `createApp`'s order (create the env id first, then insert the row) and pass the env id in. **Prefer the latter**: call `deps.envs.create()` before `insertAppRow`, exactly as `createApp` does today, and drop the `null` parameter. Implement whichever keeps `createApp`'s tests green without a schema change.

- [ ] **Step 5: Run the suite**

  Run: `pnpm vitest run subgraphs/vetra-apps && pnpm tsc && pnpm lint`

  Expected: all pass, including `migrations.test.ts`. If `migrations.test.ts` snapshots the schema, add the new column there.

- [ ] **Step 6: Commit**

  ```bash
  git add subgraphs/vetra-apps
  git commit -m "feat(apps): createStudioApp creates a managed repo with the deploy workflow for a Studio"
  ```

### Task 5: GraphQL: `createStudioApp` mutation and `App.studioEnvironmentId`

**Files:**

- Modify: `subgraphs/vetra-apps/schema.ts`, `subgraphs/vetra-apps/resolvers.ts`
- Test: `subgraphs/vetra-apps/__tests__/resolvers.test.ts`

- [ ] **Step 1: Write the failing test** in the style of the file's existing `createApp` resolver test. Call `mutation { createStudioApp(input: { name: "Shop", studioEnvironmentId: $studio }) { id slug studioEnvironmentId repository { fullName } } }` and expect `studioEnvironmentId` equal to the seeded studio and `repository.fullName` equal to `"vetra-apps/shop"`.

- [ ] **Step 2: Run it**

  Expected: FAIL (`Cannot query field "createStudioApp"`).

- [ ] **Step 3: Implement**

  In `schema.ts`:

  ```graphql
  input CreateStudioAppInput {
    name: String!
    studioEnvironmentId: String!
    orgId: String
  }
  # in type App:
  studioEnvironmentId: String
  # in type Mutation:
  createStudioApp(input: CreateStudioAppInput!): App!
  ```

  In `resolvers.ts`, next to `createApp`:

  ```ts
  createStudioApp: (_: unknown, { input }: { input: CreateStudioAppInput }, ctx: Ctx) =>
    guard(deps, "createStudioApp", async () =>
      mapApp(deps, await createStudioApp(deps, requireCaller(ctx), input)),
    ),
  ```

  In `mapApp`, add `studioEnvironmentId: row.studio_environment_id ?? null`.

- [ ] **Step 4: Run it**

  Run: `pnpm vitest run subgraphs/vetra-apps && pnpm tsc && pnpm lint`

  Expected: pass.

- [ ] **Step 5: Commit**

  ```bash
  git add subgraphs/vetra-apps
  git commit -m "feat(apps): createStudioApp mutation and App.studioEnvironmentId"
  ```

### Task 6: Ops: one GitHub App with repo-creation rights, managed org, staging setup URL

These are manual steps (GitHub UI and k8s values). The human with org-owner rights does them. **Do this before deploying Task 5 to staging.**

**Files:**

- Modify: `/home/f/projects/powerhouse-k8s-hosting/tenants/staging/powerhouse-values.yaml`
- Modify: `/home/f/projects/powerhouse-k8s-hosting/tenants/vetra/powerhouse-values.yaml`

- [ ] **Step 1: Widen the GitHub App** (GitHub → Settings → Developer settings → GitHub Apps → vetra-deploy → Permissions)

  Repository permissions:
  - **Administration: Read & write** (create and delete repos)
  - **Variables: Read & write**
  - **Contents: Read & write**

  Existing installations must accept the new permissions.

- [ ] **Step 2: Create the managed org** `vetra-apps` (or the chosen name) and install `vetra-deploy` on it with "All repositories". Note the installation id from the URL `.../installations/<id>`.

- [ ] **Step 3: Set the env vars** for the switchboard in both tenants:

  ```yaml
  VETRA_APPS_MANAGED_GITHUB_ORG: vetra-apps
  VETRA_APPS_MANAGED_INSTALLATION_ID: "<id>"
  ```

  While there, fix the staging App's setup URL so it points at `https://staging.vetra.io/user/apps/github/callback`, not prod (audit finding). That is either the values entry at `tenants/staging/powerhouse-values.yaml:100-102`, or a separate staging GitHub App if the setup URL is per App.

- [ ] **Step 4: Commit in powerhouse-k8s-hosting**

  ```bash
  git commit -am "feat(apps): managed GitHub org for Studio Apps"
  ```

### Task 7: `ph init` scaffolds `vetra.yml` (powerhouse)

The branch `feat/codegen-vetra-workflow` already replaces `sync-and-publish.yml` with `vetra.yml`, but it is 1026 commits behind `main`.

**Files:**

- Modify: `packages/codegen/src/templates/boilerplate/github/vetra.yml.ts`
- Test: `test/codegen/tests/ci-templates.test.ts`

- [ ] **Step 1: Rebase**

  ```bash
  cd /home/f/projects/powerhouse-vetra-yml && git fetch origin && git rebase origin/main
  ```

  Resolve conflicts in `generated-project-files.ts` and `templates/index.mts` by keeping `main`'s structure and swapping `sync-and-publish` for `vetra`.

- [ ] **Step 2: Write the failing test** in `ci-templates.test.ts`:

  ```ts
  it("skips PRs from other repositories by full name, like the server template", () => {
    expect(vetraWorkflowTemplate).toContain(
      "if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository",
    );
    expect(vetraWorkflowTemplate).not.toContain("head.repo.fork");
  });
  ```

- [ ] **Step 3: Run it**

  Run: `pnpm vitest run test/codegen/tests/ci-templates.test.ts`

  Expected: FAIL.

- [ ] **Step 4: Implement**

  Replace the `if:` line in `vetra.yml.ts` with the server template's condition and its comment (`vetra-cloud-package/subgraphs/vetra-apps/workflow-template.ts`). Update the header comment: "Studio Apps get VETRA_APP_ID set automatically; for an imported repo, create the App on https://vetra.io/user/apps/new."

  Check that the `ph init` output's `package.json` has a `packageManager` field. `pnpm/action-setup@v4` without `version` fails without it. If the field is absent, add `with: { version: 10 }`, matching `DEFAULT_PNPM_VERSION` in the server template.

- [ ] **Step 5: Run the codegen tests**

  Run: `pnpm vitest run test/codegen && pnpm --filter @powerhousedao/codegen tsc --noEmit`

  Expected: pass.

- [ ] **Step 6: Commit and push the branch**

  ```bash
  git commit -am "fix(codegen): match the server's same-repository guard in vetra.yml"
  git push --force-with-lease
  ```

  Open the PR to `main`, and request review from the codegen owners.

### Task 8: vetra.io: "Make it an App" on Studio cards

**Files:**

- Modify: `modules/apps/graphql.ts` (add `createStudioApp`, add `studioEnvironmentId` to the App fields as an optional field in `withAppFields`)
- Modify: `modules/apps/types.ts` (`CreateStudioAppInput`, `App.studioEnvironmentId?: string | null`)
- Modify: `modules/apps/hooks/use-apps.ts` (`useCreateStudioApp`)
- Create: `modules/cloud/studio/components/make-app-dialog.tsx`
- Modify: `modules/cloud/studio/components/studio-product-card.tsx`
- Test: `modules/apps/__tests__/graphql.test.ts`, `modules/cloud/studio/components/__tests__/make-app-dialog.test.tsx` (create)

**Interfaces:**

- Consumes: the GraphQL `createStudioApp(input: CreateStudioAppInput!): App!` (Task 5).
- Produces:
  - `createStudioApp(input: CreateStudioAppInput, token: string | null): Promise<App>`
  - `useCreateStudioApp()`
  - `<MakeAppDialog studioEnvironmentId label />`

- [ ] **Step 1: Write the failing GraphQL test** in `graphql.test.ts`:

  ```ts
  it('creates a Studio App with the studio environment id', async () => {
    resetOptionalAppFields()
    const bodies = captureBodies({ createStudioApp: { id: 'a1' } })
    await createStudioApp({ name: 'Shop', studioEnvironmentId: 'env-1' }, 'tok')
    expect(bodies[0].query).toContain('createStudioApp(input: $input)')
    expect(bodies[0].variables.input).toStrictEqual({ name: 'Shop', studioEnvironmentId: 'env-1' })
  })
  ```

- [ ] **Step 2: Run it**

  Run: `npx vitest run modules/apps/__tests__/graphql.test.ts`

  Expected: FAIL.

- [ ] **Step 3: Implement** in `graphql.ts`, mirroring `createApp`:

  ```ts
  export async function createStudioApp(input: CreateStudioAppInput, token: string | null): Promise<App> {
    const { orgId, ...rest } = input
    const sent = orgId ? { ...rest, orgId } : rest
    const data = await withAppFields((fields) =>
      appsGql<{ createStudioApp: App }>(
        `mutation ($input: CreateStudioAppInput!) { createStudioApp(input: $input) { ${fields} } }`,
        { input: sent },
        token,
      ),
    )
    return data.createStudioApp
  }
  ```

  Add `useCreateStudioApp` in `use-apps.ts`, a copy of `useCreateApp` that calls `createStudioApp`.

- [ ] **Step 4: Write the failing dialog test**

  Render `<MakeAppDialog studioEnvironmentId="env-1" label="My Shop" />` with the repo's React Query test wrapper, and mock `useCreateStudioApp` to resolve `{ id: 'a1' }` and the router. Then:
  - click "Make it an App";
  - check the name input is prefilled with "My Shop";
  - submit, and expect `mutateAsync` to be called with `{ name: 'My Shop', studioEnvironmentId: 'env-1' }` and `router.push('/user/apps/a1')`.

  A second case: the mutation rejects with `AppsApiError('BAD_USER_INPUT', 'This Studio is already an App')`, and the dialog shows that message.

- [ ] **Step 5: Implement `make-app-dialog.tsx`**

  Use the repo's existing Radix `Dialog`, `Input` and `Button` from `modules/shared/components/ui`; copy the imports from `new-app-wizard.tsx`. Copy (shown in the dialog):

  > "Creates a private GitHub repository for this Studio, with Vetra deploys set up: every pull request gets a preview, and merging to main ships to production."

  On success, `router.push(`/user/apps/${app.id}`)`. The App page already runs the Renown identity step for `PENDING_IDENTITY`. Add the trigger to `studio-product-card.tsx`. Check the `StudioProduct` type in `use-studio-products.ts` for the environment id field name first.

  Hide the trigger when the user has no Studio licence. The card already renders inside `StudioLicenseGate` in its locked variant; pass `locked` through if the card receives it.

- [ ] **Step 6: Run the vetra.io gate**

  Run: `npm run tsc && npm run lint && npm run format:check && npm run test:unit`

  Expected: all pass.

- [ ] **Step 7: Commit**

  ```bash
  git add modules/apps modules/cloud/studio
  git commit -m "feat(studio): make a Studio into an App with a managed repo and deploys"
  ```

### Task 9: Spec amendment and end-to-end staging check

- [ ] **Step 1: Update the spec**

  In the spec's journey step 2 and component table, replace "new role `STUDIO`" with "`apps.studio_environment_id` (the Studio is not app-linked, so CI can never deploy into it)".

  ```bash
  git commit -am "docs(studio): studio link is an apps column, not an env role"
  ```

- [ ] **Step 2: Release**

  Publish vetra-cloud-package to staging (its usual staging release flow), then bump the staging pin in `powerhouse-k8s-hosting/tenants/staging/powerhouse-values.yaml`.

  Push vetra.io to `staging`, and wait for `staging-<sha7>` on `https://staging.vetra.io/health`.

- [ ] **Step 3: Run the end-to-end check on staging**

  On a staging Studio:
  1. Click "Make it an App".
  2. Check that `vetra-apps/<slug>` exists, is private, has `.github/workflows/vetra.yml` and the variable `VETRA_APP_ID`, and that **no Actions run** was triggered.
  3. Finish the Renown identity step on the App page.
  4. Push a branch with a trivial package (`ph init` output) and open a PR. Check that the deploy action creates a PREVIEW env and posts the PR comment.
  5. Merge. The PRODUCTION env deploys.

  Record the run URLs in the PR description.

## Self-review notes

- **Spec coverage:** delivery steps 1–3 map to Tasks 3 and 6 (one GitHub App), Task 7 (`ph init`) and Tasks 2, 4, 5 and 8 (Studio App). Deliberately out of scope, as spec steps 4–7: the agent git loop, lazy production, retiring the direct deploy, retiring `vetra-studio`, "Take ownership" and migration.
- **Known risk:** `deleteRepo` needs Administration: write. If org policy forbids repo deletion by apps, failed creates leave an empty repo. `undoFailedCreate` only warns, and the next attempt takes the next suffix (the repo name is taken), so the user is never blocked.
