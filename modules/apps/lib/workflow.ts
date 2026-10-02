/** Path of the workflow file the setup pull request adds. */
export const WORKFLOW_PATH = '.github/workflows/vetra.yml'

/** The composite action every App workflow calls. */
export const DEPLOY_ACTION = 'powerhouse-inc/vetra-deploy-action@v1'

export type WorkflowOptions = {
  /**
   * Production branch. `main` (the default) yields the canonical template
   * byte-for-byte; any other branch is used as the push trigger and passed to
   * the action as `production-branch`.
   */
  productionBranch?: string | null
}

/**
 * `.github/workflows/vetra.yml` for an App (contract C4). Same template as the
 * setup pull request and `ph init`, so users who copy it get exactly what the
 * bot would have committed.
 */
export function buildWorkflowYaml(appId: string, options: WorkflowOptions = {}): string {
  const branch = options.productionBranch?.trim() || 'main'
  const customBranch = branch !== 'main'
  const lines = [
    'name: Vetra',
    'on:',
    '  push:',
    `    branches: [${customBranch ? yamlScalar(branch) : 'main'}]`,
    '    tags: ["v*"]',
    '  pull_request:',
    '    types: [opened, synchronize, reopened]',
    'permissions:',
    '  id-token: write',
    '  contents: read',
    'concurrency:',
    '  group: vetra-${{ github.event.pull_request.number || github.ref }}',
    '  cancel-in-progress: true',
    'jobs:',
    '  deploy:',
    '    if: github.event.pull_request.head.repo.fork != true',
    '    runs-on: ubuntu-latest',
    '    steps:',
    '      - uses: actions/checkout@v4',
    '      - uses: pnpm/action-setup@v4',
    '      - uses: actions/setup-node@v4',
    '        with: { node-version: 22, cache: pnpm }',
    `      - uses: ${DEPLOY_ACTION}`,
    '        with:',
    `          app-id: ${appId}`,
  ]
  if (customBranch) lines.push(`          production-branch: ${yamlScalar(branch)}`)
  return lines.join('\n') + '\n'
}

/** Quote a branch name only when YAML would otherwise misread it. */
function yamlScalar(value: string): string {
  return /^[A-Za-z0-9._/-]+$/.test(value) && !/^(true|false|null|yes|no|on|off)$/i.test(value)
    ? value
    : JSON.stringify(value)
}
