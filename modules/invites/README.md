# Invite codes

Gates `/studio` behind a **named, multi-use code** (e.g. `local-first`, `cohort-1`) entered
before login. Redeeming records which account came in through which code (cohort tracking) and
grants 30 days of access. Codes are handed out by hand; there's no admin UI.

## Flow

1. User enters a code → `POST /api/invite/validate` (checks only, never consumes).
2. User logs in with Renown (redirect out and back, **same browser tab**).
3. On return → `POST /api/invite/redeem`, which verifies the Renown bearer token and records the
   redemption against the user's DID.

The code is held in `sessionStorage` across the redirect, but that's only UX — redeem re-verifies
everything server-side, so it can't be spoofed.

**Identity check:** the bearer token (`getBearerToken()`) is a DID-JWT. We verify it locally with
`verifyAuthBearerToken` from `@renown/sdk` (signature + expiry, no network call) and derive the
canonical DID `did:pkh:<networkId>:<chainId>:<address>` from its signed subject — so the address
comes from the token, never the client.

## Data model (`migrations/0001_invite_codes.sql`)

- `invite_codes` — `code` (PK), `label`, `active`, `expires_at`, `max_uses`, `created_at`.
- `invite_redemptions` — `(code, user_did)` PK, `redeemed_at`, `access_expires`.

A user is "in" if they have a redemption whose `access_expires` is null or in the future; their
cohort is the `code` they redeemed. `max_uses` exists but isn't enforced in v1.

## Endpoints (`app/api/invite/`)

| Route            | Does                                                                            |
| ---------------- | ------------------------------------------------------------------------------- |
| `POST /validate` | `{ code }` → `{ valid }`. Never consumes. Rate-limited 15/min/IP.               |
| `POST /redeem`   | `{ code, token }` → verify identity, record redemption. Rate-limited 10/min/IP. |
| `POST /status`   | `{ token }` → `{ allowed, code?, label?, accessExpires? }`.                     |

## Managing codes

```
pnpm invite-codes add cohort-2 --label="Cohort 2" --expires=30d [--max-uses=200]
pnpm invite-codes list                 # codes + redemption counts
pnpm invite-codes redemptions [code]   # who redeemed (cohort reporting)
pnpm invite-codes disable <code>       # / enable <code>
```

(Raw SQL `insert`/`update` on the two tables works too.)

## Setup

Set `DATABASE_URL` (the only env var this needs — identity verification is local crypto).

Local dev:

```
docker run --name vetra-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16
# DATABASE_URL=postgres://postgres:dev@localhost:5432/postgres in .env.local
psql "$DATABASE_URL" -f migrations/0001_invite_codes.sql
```
