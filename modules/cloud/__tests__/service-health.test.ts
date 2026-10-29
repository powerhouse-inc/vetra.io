import { describe, expect, it } from 'vitest'
import { serviceHealth } from '../lib/service-health'
import type { Pod } from '../types'

const pod = (over: Partial<Pod> = {}): Pod => ({
  name: 'switchboard-0',
  service: 'SWITCHBOARD',
  component: 'switchboard',
  agent: null,
  phase: 'RUNNING',
  ready: true,
  restartCount: 0,
  updatedAt: '2026-10-29T00:00:00Z',
  ...over,
})

describe('serviceHealth', () => {
  it('is unknown until pods load, and for FUSION', () => {
    expect(serviceHealth(undefined, 'SWITCHBOARD')).toBeNull()
    expect(serviceHealth([pod({ service: 'FUSION' })], 'FUSION')).toBeNull()
  })

  it('reports running when every pod of the service is ready', () => {
    expect(serviceHealth([pod(), pod({ service: 'CONNECT', ready: false })], 'SWITCHBOARD')).toBe(
      'running',
    )
  })

  it('reports starting while a pod is pending or not ready yet', () => {
    expect(serviceHealth([pod({ phase: 'PENDING', ready: false })], 'SWITCHBOARD')).toBe('starting')
    expect(serviceHealth([pod({ ready: false, restartCount: 1 })], 'SWITCHBOARD')).toBe('starting')
  })

  it('reports failing for failed or crash-looping pods', () => {
    expect(serviceHealth([pod({ phase: 'FAILED', ready: false })], 'SWITCHBOARD')).toBe('failing')
    expect(serviceHealth([pod({ ready: false, restartCount: 5 })], 'SWITCHBOARD')).toBe('failing')
  })

  it('reports not running when the service has no pods', () => {
    expect(serviceHealth([pod({ service: 'CONNECT' })], 'SWITCHBOARD')).toBe('not-running')
  })
})
