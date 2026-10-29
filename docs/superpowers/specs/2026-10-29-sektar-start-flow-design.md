# Sektar start flow: free, local, cloud

Date: 2026-10-29. Status: approved by Frank in chat ("users go to landing page
and choose one of those 3 options... all 3 should work", "only with invite code
or plan").

## Intent

Someone lands on the Sektar site (sektar.vetra.io), picks one of three ways to
run Sektar, and ends up working in Sektar. All three must work end to end:

| Option | What it is | Who can use it |
|---|---|---|
| **Free** | Sektar in the browser: Wouter's Sektar Connect (`calm-bat-b4qzzqbb-connect.vetra.io`), documents kept in the visitor's own browser | anyone, no sign-in |
| **Local** | Download the Sektar desktop app (the `desktop` host: switchboard + Connect in a Tauri window) | anyone |
| **Cloud** | Their own always-on Sektar: the `cli` host container on Vetra, owned by them | signed in with Renown **and** holding an invite code or plan |

Why now: monorepo 6.2.3-dev.81 made the hosts usable (a served Connect proxies
its switchboard), Vetra can run a host image (FUSION host mode, `PH_HOST`), and
Vetra already provisions one dedicated environment per licence from an App
template. The pieces exist; the path through them does not.

## Goals

- Free: one click from the landing page opens Sektar in the browser.
- Local: the landing page offers installers for macOS, Windows and Linux,
  built by CI from a Sektar release tag.
- Cloud: a signed-in person with a code redeems it on the site, Vetra creates
  their Sektar host (owned by them, they are its admin), the site waits until
  it answers and opens it. Next visit, the directory lists it.

## Non-goals

- Payments and plan pricing (invite codes only; plans = Vetra licence terms,
  issued by code).
- Code signing / notarisation of the desktop app (unsigned builds; the OS warns).
- Portle setup from the site ("My computer" forwarding stays as built).
- A Sektar-branded free web app (the free path reuses Wouter's Connect).
- Moving a cloud Sektar home (the key is kept with the data so it can be done
  later; no export flow now).

## Anti-goals

- Touching Wouter's personal environment or his app's production deploys:
  main pushes keep deploying the package to it exactly as today.
- Any Vetra-side copy of a person's master key.
- A cloud Sektar anyone else can operate: `ADMINS` is the holder only.

## Design

### 1. Releases (Sektar repo + vetra-deploy-action)

- A Sektar release is a `v*` tag. On a tag, `vetra.yml` builds
  `hosts/cli/Dockerfile` as the App's FUSION image named `host` and the action
  records it on the **LATEST** channel. Main pushes do not build the image
  (`fusion-dockerfile` empty off tags), so Wouter's production env is untouched.
- vetra-deploy-action: release tags currently return before building images.
  Change: on a release tag, build/push/record FUSION images (channel LATEST),
  then return without deploying. (Publish-only stays publish-only.)
- New Sektar workflow `desktop.yml` on `v*` tags: matrix macOS/Windows/Ubuntu,
  Rust + Tauri CLI + Linux WebKitGTK deps, `ph run desktop build`, upload the
  bundles to the tag's GitHub Release.

### 2. The host image (Sektar repo)

- Image defaults for production access: `AUTH_ENABLED=true`,
  `REQUIRE_AUTHENTICATED_CALLER=true`, `RESOLVE_CALLER_IDENTITY=true`
  (overridable by env).
- Entrypoint: when `PH_WORKFLOWS_SECRETS_MASTER_KEY` is unset, use
  `$PH_USER_DATA_DIR/workflows-master-key`, generating it (64 hex, mode 600) on
  first start. The key lives with the instance's data volume. An explicitly set
  key still wins.

### 3. Vetra (vetra-cloud-package)

- **Host templates.** A FUSION template service whose artifact is named `host`
  is a Powerhouse host: provisioning sets the FUSION env `PH_HOST=cli` and
  `ADMINS=<holder address>` (create and floor-update both keep them). Convention
  over a document-model change: the image name is the App's own choice,
  recorded with every artifact.
- **Image access for licensed envs.** The app-image-project resolver also
  answers for an environment in `license_environments`: it may pull its
  licence's App's Harbor project (read from the relational tables, never the
  document).
- The directory (#112/#113) already lists the holder's licensed env (owner =
  holder, image in the App's project) with the host's own address.

### 4. Sektar on Vetra (operations, via the admin publisher API)

- Template "Sektar cloud" on App `43622402-…`: mode DEDICATED, service FUSION,
  artifact `host`, channel LATEST.
- Licence term (plan) "Sektar cloud" on that template.
- Invite codes of that term (single use) for whoever should get a cloud Sektar.
- Cut the first release tag so the image exists on LATEST.

### 5. The site (sektar-marketing-site)

- **Free card**: the disabled "At launch" button becomes "Open in your browser"
  → `NEXT_PUBLIC_FREE_URL` (Wouter's Connect).
- **Local card**: a "Download" control → `NEXT_PUBLIC_DOWNLOAD_URL`
  (the Sektar repo's latest release page).
- **Cloud**: in the "Where does your Sektar run?" step with "Sektar cloud"
  selected and nothing in the directory, offer "Have an invite code?" → the site
  calls `vetraSubscriptions.redeemInviteCode({ code, label })` with the person's
  Renown bearer, then polls the directory (and reachability) until the new
  environment answers, then opens it.

## Already in place (answers to the builder check)

- **Storage of a cloud Sektar.** FUSION host mode (vetra-cloud-package 0.0.84+,
  powerhouse-chart `app.database` / `app.persistence`, on hosting main since
  34d60034) gives a host env the tenant Postgres (`PH_SWITCHBOARD_DATABASE_URL`)
  and a kept `/data` PVC (Recreate rollout, `Prune=false`); previews get none.
  A licensed env is not a preview, so its key and identity survive restarts and
  image updates.
- **Signing in to one's own Sektar.** Connect signs the person in to Renown
  itself (one approval, `site.html` notes); the holder is in `ADMINS`. Verified
  end to end as part of the rollout, not assumed.
- **Who changes the Sektar repo.** Frank: "do everything on your own"; changes
  go through PRs that are merged as part of this work.
- **Free depends on Wouter's Connect.** Frank's choice ("free... which is just
  the connect instance from wouter").

## Calls I made (Frank skipped these)

- Master key generated inside each instance, kept on its `/data` volume; Vetra
  never sees it.
- Free = Wouter's existing Connect, not a new static deployment.
- Host-ness by artifact name `host`, not a template field.
- Unsigned desktop builds.
- Cloud Sektars follow LATEST: a new release tag floor-updates every holder's
  instance (the template's channel semantics), no per-holder opt-in.
- Release tags build FUSION images for every App that configures a fusion
  Dockerfile (additive: tags still never deploy).

## Left to the builder

- Exact copy/labels in the site's new controls.
- Polling intervals and timeouts while a cloud Sektar starts.
