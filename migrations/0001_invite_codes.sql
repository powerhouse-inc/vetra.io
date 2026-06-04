-- Invite codes — initial schema.
-- Apply once per environment:  psql "$DATABASE_URL" -f migrations/0001_invite_codes.sql
-- See docs/invite-codes-explainer.md for what each line does.

-- Named, multi-use codes (one per channel/cohort, e.g. 'local-first', 'cohort-1').
create table if not exists invite_codes (
  code        text primary key,                    -- the code string itself
  label       text,                                 -- human-readable cohort/channel name
  active      boolean     not null default true,    -- kill switch
  expires_at  timestamptz,                          -- code stops working after this (null = no window)
  max_uses    integer,                              -- optional total-redemption cap (unused in v1)
  created_at  timestamptz not null default now()
);

-- One row per (code, user) — records who came in through which code, and until when.
create table if not exists invite_redemptions (
  code            text        not null references invite_codes(code),
  user_did        text        not null,             -- the Renown DID (did:pkh:eip155:...)
  redeemed_at     timestamptz not null default now(),
  access_expires  timestamptz,                      -- per-user access expiry (redeemed_at + 30 days)
  primary key (code, user_did)                      -- a given user redeems a given code at most once
);

-- We look users up by DID alone (the composite PK only speeds up code+did lookups).
create index if not exists invite_redemptions_user_did_idx
  on invite_redemptions (user_did);
