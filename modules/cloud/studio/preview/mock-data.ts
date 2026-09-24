/**
 * IDEATION ONLY — mock data for the Studio group-header UI prototype.
 *
 * This stands in for the real model until `studioInstanceId` lands on the
 * VetraCloudEnvironment document model. Nothing here hits a backend; it exists
 * purely so the layout can be reviewed and discussed with the devs.
 */

export type MockStatus = 'RUNNING' | 'HIBERNATING' | 'DEPLOYING' | 'STOPPED' | 'READY'

/** A managed Studio instance — one per product development cycle. */
export type MockStudio = {
  id: string
  /** Product identity — would come from the BrandSheet (name/maxim). */
  productName: string
  tagline: string
  subdomain: string
  status: MockStatus
}

/** A user-owned environment the Studio has produced (nests under the header). */
export type MockEnv = {
  id: string
  name: string
  subdomain: string
  kind: 'production' | 'testing' | 'node'
  status: MockStatus
  services: string[]
  packageCount: number
}

/** A Studio header plus the environments organized underneath it. */
export type MockStudioGroup = {
  studio: MockStudio
  environments: MockEnv[]
}

/**
 * Two product development cycles the user is running in parallel — each its own
 * managed Studio with its own organized environments underneath.
 */
export const MOCK_GROUPS: MockStudioGroup[] = [
  {
    studio: {
      id: 'studio-breakfast',
      productName: 'Hotel Breakfast App',
      tagline: 'Plan, prep and serve the perfect morning service',
      subdomain: 'warm-newt-75.vetra.io',
      status: 'RUNNING',
    },
    environments: [
      {
        id: 'breakfast-prod',
        name: 'Production',
        subdomain: 'breakfast-prod.vetra.io',
        kind: 'production',
        status: 'READY',
        services: ['CONNECT', 'SWITCHBOARD'],
        packageCount: 4,
      },
      {
        id: 'breakfast-test',
        name: 'Testing',
        subdomain: 'breakfast-test.vetra.io',
        kind: 'testing',
        status: 'HIBERNATING',
        services: ['CONNECT'],
        packageCount: 4,
      },
      {
        id: 'breakfast-node',
        name: 'Staging node',
        subdomain: 'breakfast-node-a.vetra.io',
        kind: 'node',
        status: 'DEPLOYING',
        services: ['SWITCHBOARD'],
        packageCount: 2,
      },
    ],
  },
  {
    studio: {
      id: 'studio-invoices',
      productName: 'Invoice Reconciler',
      tagline: 'Match payments to invoices without the spreadsheet',
      subdomain: 'calm-otter-12.vetra.io',
      status: 'HIBERNATING',
    },
    environments: [
      {
        id: 'invoices-prod',
        name: 'Production',
        subdomain: 'invoices-prod.vetra.io',
        kind: 'production',
        status: 'READY',
        services: ['CONNECT', 'SWITCHBOARD'],
        packageCount: 6,
      },
      {
        id: 'invoices-test',
        name: 'Testing',
        subdomain: 'invoices-test.vetra.io',
        kind: 'testing',
        status: 'STOPPED',
        services: ['CONNECT'],
        packageCount: 6,
      },
    ],
  },
]

/**
 * Environments the user created directly — not produced by any Studio
 * (`studioInstanceId` would be null). These render in their own ungrouped
 * section, separate from the managed Studio cycles.
 */
export const MOCK_STANDALONE_ENVS: MockEnv[] = [
  {
    id: 'standalone-sandbox',
    name: 'Sandbox',
    subdomain: 'my-sandbox.vetra.io',
    kind: 'testing',
    status: 'READY',
    services: ['CONNECT'],
    packageCount: 1,
  },
  {
    id: 'standalone-analytics',
    name: 'Analytics node',
    subdomain: 'analytics-node.vetra.io',
    kind: 'node',
    status: 'HIBERNATING',
    services: ['SWITCHBOARD'],
    packageCount: 3,
  },
]
