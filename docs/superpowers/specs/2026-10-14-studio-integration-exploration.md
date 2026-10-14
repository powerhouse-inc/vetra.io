# Studio integration: what we evaluated and what we want

Status: exploration (2026-10-14). Not yet an approved design spec. Updated the same
day after reading the Powerhouse monorepo (main at `a479fded5c`).
Branch: `explore/studio-integration` (worktree `../vetra.io-studio`).

## Goal

Vetra is first a cloud for hosting apps, and it also offers Studio, the app builder.
Studio today feels bolted on, and the builder lacks key capabilities. We want an
integration that gets the most out of the latest Renown (identity, organisations)
and Vetra (apps, licensing, console landing, add-ons) work. A radical rethink is in
scope.

## What we evaluated

### 1. How Studio is integrated today

- **Runtime.** A studio is a cloud environment running one `vetra-cli` agent (CLINT,
  `VETRA_AGENT_XXL`). It is served from a warm pool (`vetra-studio-pool`) or provisioned
  cold. The user works in a Connect editor called "Vetra Studio": a chat pane plus the
  phases ideate → specify → build → deploy.
- **Launch.** vetra.io opens `https://<sub>.vetra.io/?user=<did>` in a new tab on
  another origin. There is no shared chrome and no way back to vetra.io.
- **Studio has no single home.** It is split across three places:
  - instances: `/user/studio`, where they are called "products"
  - licensing: `/user/apps/:id?tab=plans`
  - infrastructure: environment detail pages
- **Naming drift.** "Studio", "product", "studio env" and "Vetra Studio environment"
  all mean the same thing.
- **Studio environments leak into other lists.** They show up under "Standalone
  environments" and in `/user/environments`.
- **Overloaded gate.** The Studio licence also gates app creation and manual
  environment creation, so it is in effect a builder licence.
- **Long paths.** Getting from the landing page to a running studio takes about 4–5
  clicks for a licensed user and 7 or more for a new one.
- **Dead ends.**
  - A successful redeem lands on Subscriptions, not Studio.
  - A logged-in user visiting `/studio` sees the marketing page.
- **Orgs.** The org switcher scopes Apps and Environments but not Studio, and the UI
  doesn't say so. This follows orgs C2 Ruling 5: "studio environments are never
  created in an org".

### 2. Framing options

| Option | Idea                                                              | Verdict                  |
| ------ | ----------------------------------------------------------------- | ------------------------ |
| A      | Studio is the product; vetra.io becomes the Studio shell           | Rejected                 |
| B      | Studio is the front door of an idea → app → environment pipeline | Deferred                 |
| C      | Cloud first; Studio is the builder, properly integrated          | **Chosen** as base frame |

### 3. Apps vs packages (today's model)

- **Package**: code. A Reactor npm package (document models, editors, subgraphs,
  processors) in the Powerhouse registry, installed into an environment with
  `addPackage`. It has no owner, no licence and no opinion about hosting.
- **App**: product identity. The `vetra-app` document holds:
  - a Renown DID, an owner and a status
  - a repo
  - `artifacts[]` of kind `PACKAGE` or `FUSION_IMAGE`
  - `templates[]` (services, packages, size; SHARED or DEDICATED)
  - `terms[]` (licences)
  - a production environment and previews
- **Environment**: one running instance, with `services[]`, `packages[]`, a `fusion`
  config and size.

Gap: Studio skips the App layer. It publishes a package and installs it into an
environment, so most things users build are "a package in an environment" without
an App around them.

### 4. Capabilities: Speckle, Docling, Knowledge Vault

| Capability      | What it is                                                                                        | Usable today?                          | Gap                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Speckle         | `SPECKLE` service; auto-installs `speckle-package`; own host with Renown sign-in                  | Yes, as an add-on on the environment page | Studio cannot enable it; not part of templates or licensing                         |
| Docling         | `DOCLING` service; injects `CONVERT_SERVICE_URL`                                                  | Yes, as the "Document Conversion" add-on | Doesn't install `docling-package`; Studio cannot enable it                          |
| Knowledge Vault | Package `@powerhousedao/knowledge-note` (11 models, graph processor, `convert` subgraph → Docling) | Yes, assembled by hand                 | No bundle; licence → environment delivery is off in prod (keeper trusts unauthenticated docs) |

Root cause on the Studio side: the CLI's deploy service enum is hard-coded to
`CONNECT | SWITCHBOARD | FUSION`. The platform can run more than Studio can build
for.

### 5. Custom app images (Fusion)

The plumbing exists:

- the `FUSION` service type
- the environment's `fusion { image, env, autoUpdate }`
- App artifacts of kind `FUSION_IMAGE`
- a per-App Harbor project
- in vetra.io, the fusion config dialog and the "App image" tab

What is missing:

- Studio cannot build a Fusion app. vetra-cli's `fusion-studio` branch has 15 commits,
  unmerged since 2026-07-18: a build-type chooser, a fusion scaffold, its own
  Switchboard, a Renown app shell and `compose`.
- No concept ties "front end + back end + capabilities" together.
- An environment holds only one `fusion` config.

### 6. Ideas explored

1. **Launcher.** An environment shows its installed apps behind one sign-in and one
   search.
2. **Studio as composer.** The agent combines installed apps into a new experience: a
   Fusion shell plus glue processors.
3. **Blueprints.** Ready-made, pre-sized solutions you can fork. This would replace
   the old packages page.
4. **Solution-wide intelligence.** Knowledge Vault indexes everything, an agent gets
   every installed model as a tool, and workflows provide cross-app automation.
5. **Org-owned solutions.** A Renown org owns the solution, and members get per-app
   access through `appScope`.

These collapse into one approach, described below.

## What we want: a solution is a document

**In one sentence:** describe each Vetra solution as a single typed Powerhouse
document (a manifest), and let Studio, vetra.io and Cloud all be clients of it.
Studio writes it, vetra.io edits and prices it, and Cloud reconciles to it. The runtime
underneath is the Powerhouse monorepo's own: host files, workflows and the
multi-reactor router (see "Builds on the Powerhouse monorepo").

### Model

```
Package   = code: document models, editors, drive apps, subgraphs, processors, pieces, aiTools
App       = identity + licence + packages + optional Fusion image
            provides: the package manifest (exists today)
            requires: { platform range, documentTypes, capabilities }   (new)
Solution  = { apps: [App@version], drives, glue: [workflows], shell?: FusionImage, size }
            runtime part = a host-core host file; one reactor by default
Blueprint = a published Solution manifest (fork = copy the document)
```

### Operations (examples)

- `INSTALL_APP(knowledge-vault@1.4)`, `UNINSTALL_APP`, `UPGRADE_APP`
- `ADD_CAPABILITY(docling)`
- `ADD_WORKFLOW(task-to-note)`, `SET_SHELL(image)`
- `SET_SIZE`, or a size derived from the manifest

### Why it holds up

1. **The platform uses its own primitive.** The manifest is a Powerhouse document, so
   it gets an operation log, history, diff, undo and signatures for free. There is no
   second config system.
2. **Composition is type-checked before anything runs.** Apps declare `provides` and
   `requires`, and a resolver checks them like a package manager. A missing capability
   or a conflicting shell is an error at edit time, not a broken deployment.
3. **Integration comes from the architecture.** All apps share one event-sourced
   reactor. Glue is a workflow over typed document events, with durable runs,
   retries and park-on-failure. No adapters or sync jobs between silos.
4. **It is declarative and reproducible.** The same manifest yields the same
   runtime, in the cloud or locally. Documents are state with their own lifecycle
   (see "Risks and gaps"). Blueprints, forks and preview branches fall out of that.
5. **Agent output can be checked.** Studio emits operations on a typed document, so
   every change it makes can be reviewed, validated and reverted.
6. **Baseline price follows from the manifest.**
   `price = units(size(manifest)) × €40/month`, where one unit is 2 vCPU, 4 GB RAM
   and 80 GB NVMe, priced linearly. Real size also depends on data and load.

### Roles

| Piece                            | Role                                                                     |
| -------------------------------- | ------------------------------------------------------------------------ |
| Studio                           | Turns intent into manifest operations and workflows; builds Apps         |
| vetra.io                         | Editor and price view for the manifest: install apps, see the size       |
| Cloud                            | Reconciles the environment to the manifest and runs its host file        |
| Renown                           | Identity: an org owns the solution, `appScope` gives per-app access, risky changes use 2-owner proposals |
| Knowledge Vault, Speckle, Docling | Ordinary catalog entries (Apps and capabilities), nothing special-cased  |

### Builds on the Powerhouse monorepo

Most of the runtime already exists in the Powerhouse monorepo (main at `a479fded5c`,
2026-10-14), so Vetra owns the composition layer on top. One reactor hosting all of a
solution's packages is what the reactor is for, so a solution runs on one reactor by
default.

| Our concept                  | Monorepo piece                                                                                                                                              | State (2026-10-14)                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Runtime part of the manifest | Host files (`host-core`, uniform runners): reactor backends, storage, packages, workflows, auth flags; compound hosts; `profile` as an app-store listing | On main behind `FEATURE_UNIFORM_RUNNERS_ENABLED`; run by `ph run`, desktop and clint runners; not read by Cloud yet |
| App `provides`               | Package manifest: document models, editors, drive apps, subgraphs, processors, pieces, `aiTools`                                                           | Exists                                                                                                                 |
| App `requires`               | Registry `/packages/by-document-type`; document-model upgrade manifests                                                                                    | No platform-compat metadata on packages yet                                                                            |
| Glue                         | Workflows (`reactor-workflow`): durable runs on document events, schedules and webhooks; retries, timeouts, park-on-failure; pieces with scoped reactor access | On main, Switchboard only, behind a flag                                                                               |
| Access inside a solution     | Per-document grants to anyone, an address, a group or a match; `reactor-group` documents                                                                   | Shipped behind flags, off by default; no app or agent principal; no link to Renown orgs                               |
| Local-first and isolation    | Router (`reactor-router`): routes by drive between reactors, with capability facts per backend                                                             | Client-side in Connect behind `multiReactor`; more remotes and per-drive placement planned; server-side deferred      |
| Agents                       | `clint`, mastra-runner (OpenAI-compatible API), `reactor-mcp` (12 generic tools)                                                                           | Runner has no tools wired in; MCP is admin-only once auth is on; no agent principal                                   |

Two design rules follow:

- Each app's data lives in its own drives from day one, because the router places by
  drive.
- Documents that link or batch across apps stay on one reactor, because the router
  refuses cross-backend relationships and batches.

### Already exists vs. to build

**Already exists:**

- environment `services`, `packages` and `fusion`
- App templates, plans and artifacts
- package manifest (`provides`) and registry `by-document-type`
- host files and uniform runners (`host-core`)
- workflows and pieces (glue)
- per-document grants and `reactor-group`
- router by drive (`reactor-router`)
- gitops reconciliation, add-ons, licensing
- Renown orgs (`appScope`, proposals)
- vetra-cli `fusion-studio` (unmerged)

**To build:**

- the Solution manifest document model
- `requires` metadata on packages (platform range, document types)
- the resolver
- a Cloud runner that executes host files
- a Renown org → `reactor-group` bridge
- app and agent principals
- the vetra.io solution editor and live price view
- Studio support for emitting manifest operations and workflows
- a shell that combines several apps

### First demo slice

**"Knowledge Ops"**: Knowledge Vault + Projects + one Studio-generated workflow ("a
completed task becomes a note"). It is installed from vetra.io, priced live, deployed
by reconciliation, and shown with its operation history.

## Risks and gaps

Reading the monorepo removed one risk and shrank three; six remain open.

- **Dropped:** loading many apps into one reactor. That is the reactor's purpose; the
  host supplies the platform once.
- **Smaller:**
  - Composition guarantees: workflows already give durable, retried, journaled runs.
    Idempotency keys and cycle detection (task → note → task) are still missing.
  - Local-first and exit: the same host file runs on Vetra Cloud or locally with
    `ph run` and the desktop runner, so customers can take the manifest and their
    documents elsewhere. Vetra Cloud's ops layer stays closed.
  - UI composition: drive apps and editors are Connect's extension points; a shell
    that combines several apps does not exist yet.
- **Still open:**
  - Per-app isolation inside one reactor: all packages share one process, and per the
    subgraph-collision follow-ups plan one unparseable model schema breaks every
    subgraph.
  - No app or agent principal that grants can name.
  - Renown orgs are not mapped to reactor groups.
  - Packages carry no platform-compat metadata, so the resolver has nothing to check
    yet.
  - Data lifecycle: what uninstall does to an app's documents, backup and export.
  - Customers and catalog: about five apps and add-ons today; first buyers and
    marketplace economics are unnamed.

## Open questions

- **Naming:** "Solution", or an existing Powerhouse term (workspace, drive)?
- **Licensing for third-party apps inside a solution:** who pays whom, and how do App
  terms combine?
- **Shell:** one Fusion shell per solution, or several front ends? Today an
  environment holds a single `fusion` config.
- **Org ownership:** an org can own a solution while the studio stays personal (Ruling
  5). Is that the intended split?
- **Scope of this round:** does it include merging vetra-cli `fusion-studio`, or is it
  vetra.io plus the manifest only?
- **Licence delivery:** the licensing keeper must be secured before blueprints or
  licensed apps can deliver environments automatically.

**Align with Wouter** (owner of the router, host files and the planned runner
plugins):

- Is `profile` in `host.js` meant to be the App listing, and should its `appId` be
  the `vetra-app` id or the Renown DID?
- Should Vetra Cloud run host files through a uniform runner, so cloud and local run
  the same definition?
- What does "plugins" mean in his plan, and does it overlap with what we call apps
  and capabilities?

## Constraints to respect

- Vetra Cloud's ops layer (ArgoCD) is not open source. Only the Powerhouse platform and
  the packages Studio generates are open. Never claim "open end to end".
- Pricing: €40/month per unit of 2 vCPU, 4 GB RAM and 80 GB NVMe, linear. Size depends
  on the installed apps and the solution.
