import { describe, expect, it } from 'vitest'
import { composeClintEndpointUrl } from '@/modules/cloud/lib/clint-endpoint-url'

describe('composeClintEndpointUrl', () => {
  const endpoint = { id: 'agent-graphql', type: 'api-graphql' as const, port: '12345' }

  it('uses service.url when provided (verbatim, ignores scheme)', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: 'https://demo.vetra.io',
      prefix: 'rupert',
      isApex: false,
      genericSubdomain: 'demo',
      genericBaseDomain: 'vetra.io',
      endpoint,
    })
    expect(url).toBe('https://demo.vetra.io/agent-graphql')
  })

  it('strips trailing slash from service.url', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: 'https://demo.vetra.io/',
      prefix: 'rupert',
      isApex: false,
      genericSubdomain: 'demo',
      genericBaseDomain: 'vetra.io',
      endpoint,
    })
    expect(url).toBe('https://demo.vetra.io/agent-graphql')
  })

  it('non-apex fallback → flattened <sub>-<prefix>.vetra.io', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: null,
      prefix: 'rupert',
      isApex: false,
      genericSubdomain: 'demo',
      genericBaseDomain: 'vetra.io',
      endpoint,
    })
    expect(url).toBe('https://demo-rupert.vetra.io/agent-graphql')
  })

  it('apex fallback → bare <sub>.vetra.io', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: null,
      prefix: 'vetra-agent',
      isApex: true,
      genericSubdomain: 'demo',
      genericBaseDomain: 'vetra.io',
      endpoint,
    })
    expect(url).toBe('https://demo.vetra.io/agent-graphql')
  })

  it('uses placeholder subdomain when missing', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: null,
      prefix: 'rupert',
      isApex: false,
      genericSubdomain: null,
      genericBaseDomain: 'vetra.io',
      endpoint,
    })
    expect(url).toContain('<subdomain>')
  })

  it('falls back to vetra.io base when missing', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: null,
      prefix: 'rupert',
      isApex: false,
      genericSubdomain: 'demo',
      genericBaseDomain: null,
      endpoint,
    })
    expect(url).toBe('https://demo-rupert.vetra.io/agent-graphql')
  })

  it('does not double the slash when endpoint.id is a proxy path', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: null,
      prefix: 'ph-pirate-wouter',
      isApex: false,
      genericSubdomain: 'sure-fawn-71',
      genericBaseDomain: 'vetra.io',
      endpoint: { id: '/switchboard/graphql' },
    })
    expect(url).toBe('https://sure-fawn-71-ph-pirate-wouter.vetra.io/switchboard/graphql')
  })

  it('does not double the slash when service.url is provided and id is a path', () => {
    const url = composeClintEndpointUrl({
      serviceUrl: 'https://sure-fawn-71.vetra.io/',
      prefix: 'ph-pirate-wouter',
      isApex: true,
      genericSubdomain: 'sure-fawn-71',
      genericBaseDomain: 'vetra.io',
      endpoint: { id: '/switchboard/mcp' },
    })
    expect(url).toBe('https://sure-fawn-71.vetra.io/switchboard/mcp')
  })
})
