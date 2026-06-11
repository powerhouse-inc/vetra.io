import { z } from 'zod'

/**
 * Zod schema mirroring the runtime-config JSON Schema's `connect.*` subtree.
 *
 * Used for:
 *  - react-hook-form resolver in the form view
 *  - JSON-view client-side validation (parallel to the Ajv overlay, so the
 *    form and JSON views report consistent errors)
 *
 * TODO(integration): when the subgraph contract solidifies, regenerate this
 * from `runtime-config.schema.json` via `json-schema-to-zod` to keep it
 * mechanically in sync with the canonical schema. For now it's hand-written
 * to match what's in the ph-monorepo at
 * `packages/builder-tools/connect-utils/runtime-config.schema.json`.
 */

export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error'])

export const preserveStrategySchema = z.enum(['preserve-all', 'preserve-by-url-and-detach'])

export const driveSectionSchema = z
  .object({
    enabled: z.boolean().optional(),
    allowAdd: z.boolean().optional(),
    allowDelete: z.boolean().optional(),
  })
  .strict()

export const defaultDriveSchema = z
  .object({
    url: z.string().min(1, 'URL is required'),
    name: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
  })
  .strict()

/** URL or path of the home-screen hero image; null uses the bundled default. */
export const homeBackgroundSchema = z.string().nullable()

export const brandingSchema = z
  .object({
    appName: z.string().optional(),
    homeBackground: homeBackgroundSchema.optional(),
  })
  .strict()

export const appSchema = z
  .object({
    logLevel: logLevelSchema.optional(),
    basePath: z.string().optional(),
  })
  .strict()

export const packagesSchema = z
  .object({
    externalEnabled: z.boolean().optional(),
    liveReload: z.boolean().optional(),
  })
  .strict()

export const drivesSchema = z
  .object({
    allowAddDrive: z.boolean().optional(),
    defaultDrives: z.array(defaultDriveSchema).optional(),
    preserveStrategy: preserveStrategySchema.optional(),
    sections: z
      .object({
        remote: driveSectionSchema.optional(),
        local: driveSectionSchema.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const renownSchema = z
  .object({
    url: z.string().url('Must be a valid URL').optional(),
    networkId: z.string().optional(),
    chainId: z.number().int().positive().optional(),
  })
  .strict()

export const sentrySchema = z
  .object({
    dsn: z.string().nullable().optional(),
    env: z.string().optional(),
    tracing: z.boolean().optional(),
  })
  .strict()

export const connectRuntimeConfigSchema = z
  .object({
    branding: brandingSchema.optional(),
    app: appSchema.optional(),
    packages: packagesSchema.optional(),
    drives: drivesSchema.optional(),
    renown: renownSchema.optional(),
    sentry: sentrySchema.optional(),
  })
  .strict()

export type ConnectRuntimeConfigFormValues = z.infer<typeof connectRuntimeConfigSchema>

/**
 * Ajv-compatible JSON Schema for the JSON-view linter. Kept inline to avoid
 * pulling the source JSON file from the monorepo — the integration plan
 * (see RUNTIME-CONFIG-SUBGRAPH-PLAN.md §11.5) calls for the subgraph to
 * publish/bundle this schema; until then this is a manual copy of the
 * relevant `connect.*` subtree.
 */
export const connectRuntimeConfigJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  additionalProperties: false,
  properties: {
    branding: {
      type: 'object',
      additionalProperties: false,
      properties: {
        appName: { type: 'string' },
        homeBackground: { type: ['string', 'null'] },
      },
    },
    app: {
      type: 'object',
      additionalProperties: false,
      properties: {
        logLevel: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
        basePath: { type: 'string' },
      },
    },
    packages: {
      type: 'object',
      additionalProperties: false,
      properties: {
        externalEnabled: { type: 'boolean' },
        liveReload: { type: 'boolean' },
      },
    },
    drives: {
      type: 'object',
      additionalProperties: false,
      properties: {
        allowAddDrive: { type: 'boolean' },
        defaultDrives: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['url'],
            properties: {
              url: { type: 'string' },
              name: { type: ['string', 'null'] },
              icon: { type: ['string', 'null'] },
            },
          },
        },
        preserveStrategy: {
          type: 'string',
          enum: ['preserve-all', 'preserve-by-url-and-detach'],
        },
        sections: {
          type: 'object',
          additionalProperties: false,
          properties: {
            remote: {
              type: 'object',
              additionalProperties: false,
              properties: {
                enabled: { type: 'boolean' },
                allowAdd: { type: 'boolean' },
                allowDelete: { type: 'boolean' },
              },
            },
            local: {
              type: 'object',
              additionalProperties: false,
              properties: {
                enabled: { type: 'boolean' },
                allowAdd: { type: 'boolean' },
                allowDelete: { type: 'boolean' },
              },
            },
          },
        },
      },
    },
    renown: {
      type: 'object',
      additionalProperties: false,
      properties: {
        url: { type: 'string' },
        networkId: { type: 'string' },
        chainId: { type: 'number' },
      },
    },
    sentry: {
      type: 'object',
      additionalProperties: false,
      properties: {
        dsn: { type: ['string', 'null'] },
        env: { type: 'string' },
        tracing: { type: 'boolean' },
      },
    },
  },
} as const
