import { describe, expect, it } from 'vitest'

import { buildWorkflowYaml } from '@/modules/apps/lib/workflow'

describe('buildWorkflowYaml', () => {
  const yaml = buildWorkflowYaml('app_123')

  it('publishes with vetra-publish and has no deploy job', () => {
    expect(yaml).toContain('  publish:\n')
    expect(yaml).toContain('      - uses: powerhouse-inc/vetra-publish@v1\n')
    expect(yaml.endsWith('          app-id: app_123\n')).toBe(true)
    expect(yaml).not.toContain('deploy')
  })

  // A run that stops before installing has no cache folder, and setup-node's
  // post step then fails the job.
  it('asks setup-node for no cache', () => {
    expect(yaml).toContain('with: { node-version: 24 }')
    expect(yaml).not.toContain('cache:')
  })
})
