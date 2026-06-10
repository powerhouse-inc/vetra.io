# Early-access gate (invite codes)

Gates `/studio` behind a **named, multi-use code** (e.g. `local-first`, `cohort-1`) entered before
login. Redeeming records which account came in through which code (cohort tracking) and grants 30
days of access.

Storage and logic live in the **`vetra-access-codes` subgraph** on the cloud Switchboard
(`@powerhousedao/vetra-cloud-package`), not in this app. vetra.to is a pure client: this module is
just the gate UI plus a thin GraphQL client. There is no database, no API route, and no
`DATABASE_URL` here. See `docs/vetra-access-codes-subgraph.md` for the full design and the subgraph
implementation.

## Flow

1. User enters a code → `inviteCodeValid(code)` query (checks only, never consumes).
2. User logs in with Renown (redirect out and back, **same browser tab**).
3. On return → `redeemInviteCode(code)` mutation, carrying the Renown bearer token. The gateway
   verifies the token and the subgraph records the redemption against the caller's DID.

The code is held in `sessionStorage` across the redirect, but that's only UX — the DID is derived
from the verified token at the gateway, never from the client, so it can't be spoofed.

## Files

- `lib/client.ts` — browser GraphQL client for the `vetra-access-codes` subgraph (validate, redeem,
  status) plus Renown bearer-token minting. Targets the cloud Switchboard
  (`NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL`, falling back to `NEXT_PUBLIC_SWITCHBOARD_URL`).
- `lib/constants.ts` — `PENDING_CODE_KEY`, `BEARER_TOKEN_TTL_SECONDS`.
- `../../app/studio/early-access-gate.tsx` — the gate component (`gate → login → granted`).

## GraphQL surface (namespaced under `VetraAccessCodes`)

| Operation                        | Auth        | Purpose                                  |
| -------------------------------- | ----------- | ---------------------------------------- |
| `inviteCodeValid(code)`          | public      | Is the code usable? Never consumes.      |
| `redeemInviteCode(code)`         | caller      | Redeem for the authenticated DID.        |
| `myAccessStatus`                 | caller      | Current access status for the caller.    |
| `inviteCodes` / `createInviteCode` / `setInviteCodeActive` | admin | Manage codes (admin allowlist). |
| `redemptions(code, address)`     | admin       | Which wallet redeemed which code; filter by code and/or wallet address. |
| `revokeAccess(address)`          | admin       | Expire a wallet's grants (returns count revoked). |

## Managing codes

Codes are managed via the subgraph's admin-gated mutations (an admin Renown token whose address is
in the Switchboard `ADMINS` allowlist), not from this app. See `docs/vetra-access-codes-subgraph.md` §6.
