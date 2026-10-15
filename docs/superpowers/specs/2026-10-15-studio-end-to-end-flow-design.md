# Vetra Studio, end to end: from first prompt to production

Status: draft for review, 2026-10-15
Builds on: `2026-10-14-studio-integration-exploration.md` (a solution is an App plus its environments)

## The problem in one paragraph

Today there are two ways from code to a running app, and they never meet.

**Studio path.** A Studio agent (vetra-cli) writes code into a workdir that does not persist. Pushing to GitHub is optional and on request only: it creates one repo per environment through the `vetra-studio` GitHub App and pushes the whole workdir to `main`. Deploys go straight from the registry into an environment (`deployProject` / `deploy-create`), with no CI in between.

**Apps path.** This path is mature and live:
- an App is linked to an _existing_ repo through a different GitHub App (`vetra-deploy`)
- a setup PR adds `.github/workflows/vetra.yml`
- `vetra-deploy-action@v1` uses GitHub OIDC to get Renown tokens (no secrets), then publishes packages and FUSION images, records artifacts on the `vetra-app` doc, and calls `ci/deploy`
- PR previews, a watcher, PR comments and webhook cleanup all work

Nothing moves a Studio project onto the Apps path. If both paths target the same environment, `createApp` refuses it, because the environment already has an app link.

## The idea

**Studio becomes the front door to the Apps path. It is not a second deploy system.**

There is one invariant: **every Studio project is an App from its first second, and its repo is the source of truth.** Everything else follows from that:

| Question                         | Answer                                                                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| When is the repo created?        | When the project is created, in the same step that creates the App. Not at "deploy" time.                                                                  |
| When do we push?                 | Continuously. The agent checkpoints to a work branch; nothing goes to `main` without a PR.                                                                 |
| Where does the deploy action fit? | It is the _only_ way anything reaches a preview or production environment. Studio never deploys directly.                                                  |
| What is a "preview"?             | A PR. The existing PR preview machinery gives a shareable URL.                                                                                             |
| What is "ship"?                  | Merging the PR. A push to the production branch triggers the production deploy.                                                                           |
| What is "publish to others"?     | A `v*` tag. The deploy action already publishes it to `registry.vetra.io` as `latest` and moves the LATEST channel. Listing makes the App visible in the catalog. |

Why create the repo eagerly:
- the Studio workdir does not persist, so git _is_ the persistence layer;
- an App without a repo has no CI identity, because the OIDC claims bind to the repo;
- deciding later is exactly the gap that splits the two paths today.

## Three feedback loops, one pipeline

```
inner loop   seconds   agent edits → Studio's in-env preview server (exists today)
middle loop  minutes   checkpoint branch → PR → vetra-deploy-action → PREVIEW env + sticky PR comment
outer loop   minutes   merge PR → push to main → action → PRODUCTION env
release      minutes   tag v* → registry.vetra.io latest + LATEST channel → installable by others
```

Speed stays where it matters (the inner loop needs no CI). Every environment outside the Studio itself comes from a commit, with a run URL, sha and actor recorded by `ciDeployApp`.

## The journey

1. **Start.** On `/user/studio` the user describes the project and picks a name. This replaces the separate `/user/apps/new` wizard for new projects; the wizard stays for importing existing repos.

2. **Create the App and repo, in one server action.** A new `createStudioApp` in `vetra-apps`, which reuses most of `createApp`:
   - create the repo from the Powerhouse template (step 3) through the GitHub App:
     - in the user's account or org if they installed it;
     - otherwise in the Vetra-managed org `vetra-apps/<slug>`, which can be transferred to the user later (see "No GitHub account");
   - register the Renown workload DID. The user is already signed in with Renown, so identity confirmation becomes part of this flow's single signature rather than a separate wizard step;
   - create the Harbor project `app-<slug>` and its robot;
   - set the repo variable `VETRA_APP_ID`, so the workflow template stays generic (it matches `vars.VETRA_APP_ID` in the unmerged codegen branch);
   - link the environments:
     - the claimed Studio environment, with a new role `STUDIO`;
     - the production environment, created lazily on the first merge rather than up front, so nobody pays for an empty prod;
   - the App is `private` by default (as in the exploration spec).

3. **Repo contents from day one.** `ph init` emits `.github/workflows/vetra.yml`. This means landing `feat/codegen-vetra-workflow` in powerhouse and retiring `sync-and-publish.yml` for Vetra projects. With the workflow in the first commit, Studio-born Apps need **no setup PR**; the setup PR remains only for imported repos.

   The repo root is the project, not the agent workdir: one repo is one App. The agent's scratch state (`.ph/`, notes) stays out of git. A multi-package App uses the action's existing `package-dirs`.

4. **Working.** The agent works on `studio/<session-id>`:
   - it commits a checkpoint after each turn that changes files (a short message generated from the turn), pushed in the background;
   - `github-push` changes from "commit the whole workdir to `main`" to "commit the project and push the work branch";
   - a fresh Studio environment runs `github-clone` of the work branch on boot. This turns the non-persistent workdir from a liability into a non-issue.

5. **Preview.** The Studio "Preview" button opens or updates a PR from the work branch. The deploy action runs, `ensurePreview` creates the PREVIEW environment, and the watcher posts the URL to the PR. Studio shows the same status by reading `ci/deployments` / the App's previews, which `PreviewsSection` already renders.

6. **Ship.** The "Ship" button merges the PR, which uses the GitHub App's merge permission. The push to `main` deploys PRODUCTION; if no production environment exists yet, `ciDeployApp` creates it (the lazy creation from step 2), sized from the packages. Pricing follows the existing linear €40 unit model.

7. **Release and listing** (optional). "Release" creates a `v*` tag. Making the App `listed` with plans comes from the exploration spec: publish means flipping an App from private to listed, and the tag provides the installable version.

8. **Leave Studio.** The App keeps working without Studio. Anyone can clone the repo, use their own editor and push; the same pipeline runs. Studio is a client of the App, not its owner. This is the property that would impress a CS purist: the system has **one write path (git) and one deploy path (CI)**, and Studio is just a very good author.

## Component changes

| Area                                             | Change                                                                                                                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub Apps                                      | **Merge into one App.** `vetra-deploy` gains repo creation (Administration: write, Variables: write, Contents: write). `vetra-studio` and `vetra-github-auth`'s device flow are retired. One install, one webhook, one setup URL; fix the staging setup URL that points at prod. |
| `vetra-cloud-package` / `vetra-apps`             | `createStudioApp`. Env link role `STUDIO`. Lazy production environment on the first PRODUCTION deploy. Store the GitHub installation on the App row (it already lives in relational tables).                                        |
| `vetra-cli` (agent)                              | Work-branch checkpointing, `github-clone` on boot, "preview" opens a PR, "ship" merges. **Remove** `deploy-create` / `deploy-update` / `deployProject` from the agent's toolset (or gate them to non-App sandboxes).               |
| `powerhouse` codegen                             | Land `vetra.yml` in `ph init` (branch `feat/codegen-vetra-workflow`).                                                                                                                                                              |
| vetra.io                                         | Studio start screen creates an App. The Studio Deploy tab shows PR, preview and production status from the App. `/user/apps/new` becomes "Import a repo". Delete the dead `NEXT_PUBLIC_GITHUB_APP_SLUG`.                         |
| `vetra-deploy-action`                            | No change is needed for the main flow. Optional follow-up: deploy on tag to an opt-in "release" environment.                                                                                                                       |

## No GitHub account

Many Studio users will not have GitHub. The default is therefore a **Vetra-managed org**: repos are created in `vetra-apps/<slug>` and the user is invited as a collaborator if they ever add a GitHub handle. "Take ownership" transfers the repo to their account or org later; the App keeps the same id, and only `repository.fullName` and the installation change.

Costs: private-repo Actions minutes in the managed org are billed to Vetra. Mitigation: a GitHub Enterprise or org plan, or self-hosted runners (ARC on our cluster). The action is already runner-agnostic.

## Failure handling

- **Repo creation fails:** create nothing. `createStudioApp` is all or nothing in order: repo, then DID, then Harbor, then env links, with compensation on failure (delete repo or project). There are no half-Apps. This is the opposite of today's `catch { // ignore }` in Studio provisioning.
- **Push fails** (network, token): checkpoints queue locally and the Studio UI shows "unsaved to GitHub". The workdir is not deleted while unpushed commits exist.
- **CI fails:** the PR comment and Studio show the run URL. The agent can read the failed run's log (GitHub API) and propose a fix. This closes the loop autonomously.
- **Known holes from the audit** to fix along the way:
  - a failed `ci/artifacts` call only warns, so the doc drifts: make it fail the run;
  - `isPullRequestClosed` fails open on a GitHub outage;
  - only the first FUSION image is deployed.

## Migration

- **Existing Studio environments with a `vetra-studio` repo:** offer "Turn into App". It reuses the repo, opens the setup PR (the existing path) and switches the environment link to `STUDIO`.
- **Studio environments without a repo:** "Turn into App" creates one and pushes the current workdir as the first commit.
- **Retire `vetra-studio`** once there are no active device-flow bindings.

## Delivery order

Each step is independently shippable.

1. **One GitHub App.** Add the permissions to `vetra-deploy` and move repo creation into `vetra-apps`. Fix the staging setup URL.
2. **`vetra.yml` in `ph init`.** Land the codegen branch.
3. **`createStudioApp` and the `STUDIO` role, plus the vetra.io start screen.** This is the minimum viable end-to-end flow: a new Studio project becomes an App with a repo and a working workflow.
4. **Agent git loop.** Checkpoints, clone on boot, Preview opens a PR, Ship merges.
5. **Retire direct deploy from the agent.** Lazy production environment.
6. **Managed org and "Take ownership".**
7. **Migration of existing Studio environments.**

## Open questions

1. Managed org name and Actions billing: GitHub org plan vs self-hosted runners?
2. Should "Ship" require a passing preview, or only a green CI?
3. Does the agent get to merge, or only the human pressing Ship? Recommendation: human only. The agent has no App principal yet (an open gap from the exploration).
4. The relationship of host files to the repo: should the repo carry the host file (the App's runtime projection) that CI records? Align with Wouter first.
