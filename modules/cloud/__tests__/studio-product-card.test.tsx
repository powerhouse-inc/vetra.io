import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { StudioProductCard } from '@/modules/cloud/studio/components/studio-product-card'
import type { StudioBrand, StudioProduct } from '@/modules/cloud/studio/use-studio-products'

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
})
