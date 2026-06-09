import { describe, expect, it } from 'vitest'
import { deriveTenantId } from '@/modules/cloud/studio/studio-tenant'
import { buildStudioEmbedUrl } from '@/modules/cloud/studio/studio-embed-url'
import { hasStudioWebsiteEndpoint } from '@/modules/cloud/studio/studio-readiness'
import type { ClintRuntimeEndpointsForPrefix } from '@/modules/cloud/types'

describe('deriveTenantId', () => {
  it('joins subdomain with the first 8 hex chars of the doc id', () => {
    expect(deriveTenantId('warm-newt-75', 'aa726a95-1234-5678-9abc-def012345678')).toBe(
      'warm-newt-75-aa726a95',
    )
  })
})

describe('buildStudioEmbedUrl', () => {
  it('builds the agent root url', () => {
    expect(
      buildStudioEmbedUrl({
        prefix: 'vetra-agent',
        genericSubdomain: 'warm-newt-75',
        genericBaseDomain: 'vetra.io',
      }),
    ).toBe('https://vetra-agent.warm-newt-75.vetra.io/')
  })
  it('appends ?user when a did is given', () => {
    expect(
      buildStudioEmbedUrl({
        prefix: 'vetra-agent',
        genericSubdomain: 'sub',
        genericBaseDomain: 'vetra.io',
        userDid: 'did:ethr:0xabc',
      }),
    ).toBe('https://vetra-agent.sub.vetra.io/?user=did%3Aethr%3A0xabc')
  })
  it('falls back to vetra.io base when missing', () => {
    expect(
      buildStudioEmbedUrl({
        prefix: 'vetra-agent',
        genericSubdomain: 'sub',
        genericBaseDomain: null,
      }),
    ).toBe('https://vetra-agent.sub.vetra.io/')
  })
})

describe('hasStudioWebsiteEndpoint', () => {
  const group = (eps: { type: string; status: string }[]): ClintRuntimeEndpointsForPrefix => ({
    prefix: 'vetra-agent',
    endpoints: eps.map((e, i) => ({
      id: `/${i}`,
      type: e.type as never,
      port: '1',
      status: e.status as never,
      lastSeen: '',
    })),
  })
  it('true when an enabled website endpoint exists', () => {
    expect(hasStudioWebsiteEndpoint(group([{ type: 'website', status: 'enabled' }]))).toBe(true)
  })
  it('false when only api endpoints exist', () => {
    expect(hasStudioWebsiteEndpoint(group([{ type: 'api-graphql', status: 'enabled' }]))).toBe(
      false,
    )
  })
  it('false for undefined group', () => {
    expect(hasStudioWebsiteEndpoint(undefined)).toBe(false)
  })
})
