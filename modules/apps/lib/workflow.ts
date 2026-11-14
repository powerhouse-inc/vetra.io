/** Path of the workflow file the setup pull request adds. */
export const WORKFLOW_PATH = '.github/workflows/vetra.yml'

/** The GitHub Action every App workflow calls. */
export const PUBLISH_ACTION = 'powerhouse-inc/vetra-publish@v1'

/**
 * `.github/workflows/vetra.yml` for an App: the same file the setup pull
 * request commits for a pnpm repository, so users who copy it get exactly what
 * the bot would have committed. It publishes only; there is no deploy job.
 */
export function buildWorkflowYaml(appId: string): string {
  return `name: Vetra
on:
  push:
    # Every branch publishes builds; the production branch and the App's
    # release branches also publish releases. release-please's branches only
    # carry release PRs, which run as pull requests.
    branches: ['**', '!release-please--**']
  pull_request:
    types: [opened, synchronize, reopened]
permissions: {}
concurrency:
  # A push may be cutting a release: one group per commit, so a newer push
  # never cancels it (nor a pending one). A pull request keeps only its newest run.
  group: vetra-\${{ github.event.pull_request.number || github.sha }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}
jobs:
  publish:
    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
      pull-requests: read
      attestations: write
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 24 }
      - uses: ${PUBLISH_ACTION}
        with:
          app-id: ${appId}
`
}
