import { describe, expect, it } from 'vitest'

import { buildWorkflowYaml } from '@/modules/apps/lib/workflow'

// Contract C4, verbatim, with <APP_ID> substituted.
const C4 = `name: Vetra
on:
  push:
    branches: [main]
    tags: ["v*"]
  pull_request:
    types: [opened, synchronize, reopened]
permissions:
  id-token: write
  contents: read
concurrency:
  group: vetra-\${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true
jobs:
  deploy:
    if: github.event.pull_request.head.repo.fork != true
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - uses: powerhouse-inc/vetra-deploy-action@v1
        with:
          app-id: <APP_ID>
`

describe('buildWorkflowYaml', () => {
  it('matches the C4 template byte-for-byte for main', () => {
    expect(buildWorkflowYaml('app_123')).toBe(C4.replace('<APP_ID>', 'app_123'))
    expect(buildWorkflowYaml('app_123', { productionBranch: 'main' })).toBe(
      C4.replace('<APP_ID>', 'app_123'),
    )
  })

  it('wires a custom production branch into the trigger and the action', () => {
    const yaml = buildWorkflowYaml('a1', { productionBranch: 'release' })
    expect(yaml).toContain('    branches: [release]\n')
    expect(yaml.endsWith('          app-id: a1\n          production-branch: release\n')).toBe(true)
  })

  it('quotes branch names YAML would misread', () => {
    const yaml = buildWorkflowYaml('a1', { productionBranch: 'on' })
    expect(yaml).toContain('branches: ["on"]')
    expect(yaml).toContain('production-branch: "on"')
  })
})
