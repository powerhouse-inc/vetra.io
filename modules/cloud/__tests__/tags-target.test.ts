import { describe, expect, it } from 'vitest'
import { resolveTagsTarget } from '../registry/tags-target'

describe('resolveTagsTarget', () => {
  it('maps CONNECT/SWITCHBOARD to the platform images', () => {
    expect(resolveTagsTarget('CONNECT', null)).toEqual({
      imagePath: 'powerhouse-inc-powerhouse/connect',
      fusion: false,
    })
  })

  it('takes the FUSION image from the request, restricted to cr.vetra.io', () => {
    expect(resolveTagsTarget('FUSION', 'cr.vetra.io/achra/frontend', ['achra'])).toEqual({
      imagePath: 'achra/frontend',
      fusion: true,
    })
    expect(resolveTagsTarget('FUSION', 'docker.io/library/nginx')).toEqual({
      error: 'image must be a cr.vetra.io repository',
    })
    expect(resolveTagsTarget('FUSION', 'cr.vetra.io/../admin')).toEqual({
      error: 'image must be a cr.vetra.io repository',
    })
    expect(resolveTagsTarget('FUSION', null)).toEqual({ error: 'image parameter is required' })
  })

  it('only lists FUSION images from allowed Harbor projects', () => {
    expect(resolveTagsTarget('FUSION', 'cr.vetra.io/vetra/vetra-to', ['achra'])).toEqual({
      error: 'image project is not enabled for Fusion apps',
    })
    expect(resolveTagsTarget('FUSION', 'cr.vetra.io/achra/frontend', [])).toEqual({
      error: 'image project is not enabled for Fusion apps',
    })
  })

  it('rejects unknown services', () => {
    expect(resolveTagsTarget('CLINT', null)).toEqual({ error: 'Unknown service type: CLINT' })
  })
})
