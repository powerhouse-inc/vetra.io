import { describe, expect, it } from 'vitest'

import { isVisitableService, serviceInstanceKey, serviceInstanceLabel } from '../lib/service-label'

describe('service labels for the Visit menu', () => {
  it('names each service type instead of falling back to Fusion', () => {
    expect(serviceInstanceLabel({ type: 'CONNECT', prefix: 'connect' })).toBe('Connect')
    expect(serviceInstanceLabel({ type: 'SWITCHBOARD', prefix: 'switchboard' })).toBe('Switchboard')
    expect(serviceInstanceLabel({ type: 'FUSION', prefix: 'fusion' })).toBe('Fusion')
    expect(serviceInstanceLabel({ type: 'SPECKLE', prefix: 'speckle' })).toBe('3D Models')
  })

  it('tells agents apart by prefix', () => {
    expect(serviceInstanceLabel({ type: 'CLINT', prefix: 'support' })).toBe('Agent: support')
    expect(serviceInstanceKey({ type: 'CLINT', prefix: 'a' })).not.toBe(
      serviceInstanceKey({ type: 'CLINT', prefix: 'b' }),
    )
  })

  it('only lists services that answer on a host', () => {
    expect(isVisitableService({ type: 'CONNECT' })).toBe(true)
    expect(isVisitableService({ type: 'CLINT' })).toBe(true)
    expect(isVisitableService({ type: 'DOCLING' })).toBe(false)
    expect(isVisitableService({ type: 'PAPERLESS' })).toBe(false)
  })
})
