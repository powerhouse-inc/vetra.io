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

  // OpenPanel analytics — optional. Empty/unset disables analytics entirely
  // (the SDK is never initialized). See modules/shared/analytics.
  NEXT_PUBLIC_OPENPANEL_CLIENT_ID: z.string().optional(),
  // Optional self-hosted OpenPanel API URL; defaults to OpenPanel cloud when unset.
  NEXT_PUBLIC_OPENPANEL_API_URL: z.string().optional(),
})
