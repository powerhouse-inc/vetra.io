# Auth Admin View

**Status:** ready
**Date:** 2026-05-22
**Driver:** liberuum built a working Auth Dashboard editor at
[powerhouse-inc/auth-editor](https://github.com/powerhouse-inc/auth-editor)
and wants the same surface inside Vetra so env owners can manage per-document
permissions, groups, and ownership for THEIR switchboard without leaving the
Vetra UI.

## Problem

The reactor-api's `DocumentPermissionService` already exposes the full
permission surface (per-doc protection, owner transfer, READ/WRITE/ADMIN
grants, group membership, per-operation grants). Every switchboard
running reactor-api carries that GraphQL surface for free. Today Vetra
has no UI for any of it — owners would have to use the standalone
auth-editor app, point it at their tenant switchboard, and run grants from
there.

## Goal

Add a new **Auth** tab to the switchboard service detail drawer in Vetra.
The tab mirrors the auth-editor demo's 3-sub-tab IA (My Permissions /
Groups / Document Permissions) but uses Vetra's design tokens (Tabs,
Table, Button, Badge from `modules/shared/components/ui/*`) instead of
the demo's inline styles.

The tab targets the **tenant's own switchboard** (not the admin one) —
`service.url` from the env state is the base URL; we POST to `<url>/graphql`
with the Renown bearer the user already minted to view Vetra.

## Non-goals

- Building a new GraphQL surface for permissions — reactor-api already
  exposes everything we need.
- A standalone Vetra page for cross-env permission management. This is
  per-env, lives inside the switchboard drawer.
- Per-operation grants for arbitrary document models in v1. The demo
  supports it; we'll ship the user/group/protection/ownership surface
  first and add op-level grants in a follow-up if requested.
- Enabling `AUTH_ENABLED` / `DOCUMENT_PERMISSIONS_ENABLED` on tenant
  switchboards via Vetra UI. Today these are chart values; the chart
  defaults are set in a separate commit on `powerhouse-k8s-hosting`.
- Renown sign-in flow. The viewer is already authenticated via the
  existing Vetra auth context.

---

## Components

### Frontend — `vetra.to`, branch `staging`

#### New module `modules/cloud/lib/switchboard-auth-client.ts`

A small factory that returns a `query` function bound to one tenant's
switchboard. Mirrors the demo's `useAuthApi` but takes the URL as a
parameter (Vetra already knows it) and gets the token from the renown
context.

```ts
export function createSwitchboardAuthClient(
  switchboardUrl: string,
  renown: ReturnType<typeof useRenown>,
): {
  query: <T>(gql: string, variables?: Record<string, unknown>) => Promise<T>
}
```

Implementation: POST to `${switchboardUrl}/graphql` with
`Authorization: Bearer ${await renown.getBearerToken({ expiresIn: 600 })}`.
**Important**: mint the token WITHOUT an `aud` claim (the demo hook
documents this — `did-jwt` rejects aud-bearing tokens on switchboards
that don't have an app address configured). Use the same `expiresIn: 600`
the demo uses.

#### New components under `modules/cloud/components/switchboard-auth/`

```
switchboard-auth/
├── auth-tab.tsx               # 3-sub-tab container (entry point)
├── my-permissions-tab.tsx
├── groups-tab.tsx
├── document-permissions-tab.tsx
├── permission-panel.tsx       # shared per-document panel
└── ens-address.tsx            # ENS-aware address chip (port of demo's EnsAddress)
```

Each component ports its demo counterpart but uses:

- `<Tabs>` / `<TabsList>` / `<TabsTrigger>` / `<TabsContent>` from
  `modules/shared/components/ui/tabs`
- `<Badge>` from `modules/shared/components/ui/badge` (use the existing
  `size="xs"` variant for compact permission badges) — semantic palette:
  READ = `variant="secondary"` blue-info, WRITE = `bg-warning/15 text-warning`,
  ADMIN = `bg-destructive/15 text-destructive`
- `<Button>` (size sm/xs, variant outline/destructive)
- `<Input>` from `modules/shared/components/ui/input`
- `<Collapsible>` for the document tree expand/collapse
- Tables use a simple `<table>` with the same sticky-header pattern as
  the explorer result panel (no need for a new design-system primitive)
- Toast: `import { toast } from 'sonner'`

`PermissionPanel` is shared across sub-tabs; keep it pure (props in,
events out) for testability.

#### Wiring into `modules/cloud/components/service-detail-drawer.tsx`

Add an "Auth" tab to the existing tabs row when
`service.type === 'SWITCHBOARD'`. The tab content mounts `<AuthTab
switchboardUrl={service.url} viewerAddress={viewerAddress}
canEdit={canEdit} />`.

When `service.url` is null (env in PROVISIONING / CHANGES_PENDING), the
tab body shows "Switchboard not yet running" placeholder instead of the
sub-tabs.

When `canEdit` is false (non-owner viewer), the My Permissions sub-tab
renders normally (it's read-only by design), but Groups and Document
Permissions show a "Owner-only" placeholder — the underlying mutations
would 403 anyway; we just surface that upfront.

The tab is owner-only by default. The dashboard's My Permissions sub-tab
remains useful for non-owners (it shows what they personally have access
to on this switchboard), but the bulk admin work (Groups, Document
Permissions) is owner-gated.

### Backend — none

Every GraphQL query/mutation the UI calls is provided by reactor-api
running inside the tenant's switchboard:

**Queries:**

- `viewer` (already on Vetra's admin switchboard; tenant switchboards
  expose it too via reactor-api)
- `userDocumentPermissions`
- `userGroups(userAddress: String!)`
- `groups`
- `documentAccess(documentId: String!)`
- `documentProtection(documentId: String!)`
- `findDocuments(search, paging)` — for the drive listing in the
  Document Permissions tab
- `document(identifier: String!)` — for doc metadata + drive state
- `documentModels(paging)` — only if we ship operation-level grants in v1
  (NON-GOAL above; skip the model fetch entirely for v1)

**Mutations:**

- `setDocumentProtection(documentId, protected)`
- `transferDocumentOwnership(documentId, newOwnerAddress)`
- `grantDocumentPermission(documentId, userAddress, permission)`
- `revokeDocumentPermission(documentId, userAddress)`
- `grantGroupPermission(documentId, groupId, permission)`
- `revokeGroupPermission(documentId, groupId)`
- `createGroup(name, description)`
- `deleteGroup(id)`
- `addUserToGroup(userAddress, groupId)`
- `removeUserFromGroup(userAddress, groupId)`

(Operation-level mutations — `grantOperationPermission` etc. — exist on
reactor-api but are non-goal in v1.)

### Chart change — `powerhouse-k8s-hosting`

Today the chart's switchboard env block doesn't ship `AUTH_ENABLED` /
`DOCUMENT_PERMISSIONS_ENABLED` by default. The auth-editor demo needs
both. Add chart defaults in `powerhouse-chart/templates/switchboard-deployment.yaml`:

```yaml
{{- if not (hasKey .Values.switchboard.env "AUTH_ENABLED") }}
- name: AUTH_ENABLED
  value: "true"
{{- end }}
{{- if not (hasKey .Values.switchboard.env "DOCUMENT_PERMISSIONS_ENABLED") }}
- name: DOCUMENT_PERMISSIONS_ENABLED
  value: "true"
{{- end }}
```

This makes the Auth UI work out-of-the-box on every tenant switchboard
without per-tenant chart edits. Existing tenants with `AUTH_ENABLED`
already set in their values are untouched (the `hasKey` guard skips them).

Same commit also adds `ADMINS` opt-in: a tenant can list ETH addresses
to grant supreme-admin override on their switchboard. Default empty
(only document grants apply).

---

## Data flow

```
User opens switchboard service drawer
└ "Auth" tab renders (only for SWITCHBOARD service type)
  ├ Tab state managed locally (My Permissions | Groups | Document Permissions)
  └ Per-sub-tab:
     useEffect → createSwitchboardAuthClient(service.url, renown)
                 → query(...) against `${service.url}/graphql`
                 with Authorization: Bearer <renown token, no aud claim>
                 → render data

Grants / revokes:
  Click in PermissionPanel
   AlertDialog (destructive ones — revoke, transfer ownership, delete group)
   AsyncButton on confirm
     query(mutation, vars)
     refresh affected sub-tab data
     toast.success
```

---

## Error handling

Each `query()` call surfaces errors as throws (the helper rejects on
non-2xx HTTP or GraphQL `errors[]`). Per-sub-tab error state renders an
inline banner with the error message.

Friendly mapping for known reactor-api errors:

| GraphQL error contains                        | UI copy                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| "AUTH_ENABLED" / "not configured"             | "Auth isn't enabled on this switchboard. Restart the service after enabling AUTH_ENABLED." |
| "permission" / "forbidden" / "ADMIN required" | "You don't have permission for this action."                                               |
| "Group not found"                             | "Group no longer exists. Refresh."                                                         |
| "not in ADMINS"                               | "Only the switchboard's ADMINS or the document owner can do this."                         |
| default                                       | raw message                                                                                |

When the switchboard responds with `AUTH_ENABLED=false` (i.e. it's
running without auth), `userDocumentPermissions` returns rows but the
`grantedBy` may be empty. The UI handles that gracefully (already does
in the demo via the `"—"` placeholder).

---

## Edge cases

- **`service.url` is null** — show a placeholder, no queries fired.
- **Token mint fails** — query falls back to unauthenticated; the
  switchboard returns the `viewer` as null and most mutations reject.
  Surface "Sign in with Renown" banner above the tabs.
- **Custom domain** — `service.url` already accounts for it (the doc
  model writes the correct value based on customDomain + apex routing).
  No client-side derivation needed.
- **Switchboard down / network error** — error banner; "Retry" button
  on each sub-tab.
- **Address typo in grant inputs** — let the switchboard validate.
  Surface its error message in the inline banner.
- **Cross-origin** — vetra-to runs at `vetra.io`, the tenant switchboard
  at `switchboard.<sub>.vetra.io`. CORS preflight applies. The reactor-api
  default CORS config allows `*` for GraphQL but it's worth verifying on
  staging before shipping.

---

## Verification

1. Owner of an env opens the switchboard drawer → "Auth" tab present.
2. **My Permissions** sub-tab lists the viewer's doc grants on that
   switchboard. Empty list shows the "unprotected docs accessible to all"
   message.
3. **Groups** sub-tab: create a group → appears in list. Add a member
   address → member appears. Delete the group → it's gone.
4. **Document Permissions** sub-tab: drive tree loads. Expand drive →
   folders → files. Click a doc → PermissionPanel shows protected
   toggle + owner + per-user permissions + per-group permissions.
   Grant a user READ → row appears. Revoke → row gone. Transfer
   ownership → owner row updates.
5. Non-owner viewer: Groups and Document Permissions sub-tabs show
   "Owner-only" placeholder; My Permissions still works.
6. Switchboard not yet running (env in PROVISIONING): tab shows the
   placeholder, no queries fired.
7. Token mint fails (Renown not logged in): "Sign in" banner.
8. `pnpm tsc` + `pnpm lint` clean.

---

## Implementation order

### Frontend (one commit per logical unit)

1. `feat(cloud): switchboard auth GraphQL client helper`
2. `feat(cloud): EnsAddress + PermissionPanel components`
3. `feat(cloud): MyPermissionsTab component`
4. `feat(cloud): GroupsTab component`
5. `feat(cloud): DocumentPermissionsTab component`
6. `feat(cloud): mount AuthTab in switchboard service drawer`

### Chart (separate commit on powerhouse-k8s-hosting)

1. `feat(chart): default AUTH_ENABLED + DOCUMENT_PERMISSIONS_ENABLED on switchboards`

No backend changes in vetra-cloud-package — every GraphQL field already
exists on reactor-api.

### Tests

The existing Vetra pattern doesn't add tests for new tab components.
Follow that for v1 — defer until a regression motivates it.

### Push

Frontend to `staging` (auto-builds → staging vetra-to). Chart to `main`
of `powerhouse-k8s-hosting` (ArgoCD reconciles → tenant switchboard
rollout with new env vars).

---

## Future work (NOT in this spec)

- Per-operation grants UI (the demo has it; we skip in v1).
- A "Switchboard Auth Settings" panel in the env-settings-drawer to
  toggle `AUTH_ENABLED` / set `ADMINS` for a tenant from the UI (rather
  than chart defaults) — this would require either an env-var write path
  via vetra-cloud-secrets, or a new doc-model field that gets projected
  into the chart values during gitops sync.
- Pagination of the drive tree (today: cap 500 drives, render all).
- A "grant by ENS name" affordance (today: hex address only).
