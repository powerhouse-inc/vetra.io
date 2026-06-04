import { z } from 'zod'

export const envSchema = z.object({
  // private env variables
  HOMEPAGE_REMOTE_URL: z.url({
    error: 'Must be a valid URL (e.g., https://example.com) pointing to the hosted homepage.',
  }),

  // public env variables
  NEXT_PUBLIC_SWITCHBOARD_URL: z.url({
    error:
      'Must be a valid URL (e.g., https://switchboard.example.com/graphql) for the Switchboard API.',
  }),

  // invite codes (optional so the app still boots without a DB; the invite
  // endpoints throw a clear error at request time if these are missing)
  DATABASE_URL: z
    .string({
      error:
        'Postgres connection string for invite codes (e.g. postgres://user:pass@host:5432/db).',
    })
    .optional(),
  NEXT_PUBLIC_RENOWN_URL: z
    .url({ error: 'Must be a valid URL for the Renown service.' })
    .optional(),
})
