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

  // Cloud Switchboard supergraph (serves the access-codes subgraph that backs
  // the early-access gate). Falls back to NEXT_PUBLIC_SWITCHBOARD_URL.
  NEXT_PUBLIC_CLOUD_SWITCHBOARD_URL: z
    .url({ error: 'Must be a valid URL for the cloud Switchboard GraphQL API.' })
    .optional(),
  NEXT_PUBLIC_RENOWN_URL: z
    .url({ error: 'Must be a valid URL for the Renown service.' })
    .optional(),
})
