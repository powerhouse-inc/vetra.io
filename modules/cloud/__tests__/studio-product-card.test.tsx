import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import { StudioProductCard } from '@/modules/cloud/studio/components/studio-product-card'
import type { StudioBrand, StudioProduct } from '@/modules/cloud/studio/use-studio-products'

vi.mock('@/modules/apps/hooks/use-apps', () => ({
  useCreateStudioApp: () => ({}),
  useMyApps: () => ({ data: [] }),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

let llmStatus: { data?: { environmentId: string; connected: boolean } } = {}
const useStudioLlmStatus = vi.fn((_envId: string, _enabled: boolean) => llmStatus)
vi.mock('@/modules/cloud/studio/use-studio-llm-status', () => ({
  useStudioLlmStatus: (envId: string, enabled: boolean) => useStudioLlmStatus(envId, enabled),
}))

const AGENT_URL = 'https://warm-newt-75.vetra.io/?user=did%3Aethr%3A0xabc'

// Brand is cached server-side and carried on the product, so the card renders
// synchronously from `product.brand` with no host fetch to stub.
const READY_BRAND: StudioBrand = {
  title: 'Concord',
  tagline: 'Share the burden.',
  description: 'Coordinates procurement.',
}

const base: StudioProduct = {
  envId: 'env1',
  subdomain: 'sub',
  prefix: 'vetra-agent',
  label: 'Vetra Studio',
  brand: READY_BRAND,
  status: 'ready',
}

describe('StudioProductCard', () => {
  it('links a ready product straight to its agent URL in a new tab', () => {
    const { container, getByText } = render(<StudioProductCard product={base} href={AGENT_URL} />)
    getByText('Concord')
    getByText('Share the burden.')
    getByText('Coordinates procurement.')
    getByText(/ready/i)
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe(AGENT_URL)
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders a booting product as inert (no link) with a Provisioning badge', () => {
    const { container, getByText } = render(
      <StudioProductCard product={{ ...base, brand: null, status: 'booting' }} href={AGENT_URL} />,
    )
    // Falls back to the env label when brand is unavailable.
    getByText('Vetra Studio')
    getByText(/provisioning/i)
    expect(container.querySelector('a')).toBeNull()
  })

  it('still renders a card with unknown brand from its label/subdomain', () => {
    const { getByText } = render(
      <StudioProductCard
        product={{ ...base, brand: null, label: 'Untitled', status: 'booting' }}
        href="#"
      />,
    )
    getByText('Untitled')
    getByText('sub')
  })

  it('says "Connect a model" on a ready Studio without a model key', () => {
    llmStatus = { data: { environmentId: 'env1', connected: false } }
    const { getByText } = render(<StudioProductCard product={base} href={AGENT_URL} />)
    getByText('Connect a model')
    llmStatus = {}
  })

  it('says nothing extra once the Studio has a model, or while unknown', () => {
    llmStatus = { data: { environmentId: 'env1', connected: true } }
    const { queryByText, rerender } = render(<StudioProductCard product={base} href={AGENT_URL} />)
    expect(queryByText('Connect a model')).toBeNull()
    llmStatus = {}
    rerender(<StudioProductCard product={base} href={AGENT_URL} />)
    expect(queryByText('Connect a model')).toBeNull()
  })

  it('does not ask for the status of a booting Studio', () => {
    render(<StudioProductCard product={{ ...base, status: 'booting' }} href={AGENT_URL} />)
    expect(useStudioLlmStatus).toHaveBeenLastCalledWith('env1', false)
  })
})
