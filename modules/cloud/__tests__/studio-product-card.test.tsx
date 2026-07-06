import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

import type { ProductBrand } from '@/modules/cloud/studio/fetch-product-brand'

const AGENT_URL = 'https://warm-newt-75.vetra.io/?user=did%3Aethr%3A0xabc'

// Brand is resolved lazily inside the card via useProductBrand (a per-ready
// product host fetch). Stub it so the card renders synchronously in the test —
// ready products get a brand, booting products get none.
const READY_BRAND: ProductBrand = {
  title: 'Concord',
  tagline: 'Share the burden.',
  description: 'Coordinates procurement.',
}
vi.mock('@/modules/cloud/studio/use-product-brand', () => ({
  useProductBrand: ({ status }: { status: string }) => (status === 'ready' ? READY_BRAND : null),
}))
import { StudioProductCard } from '@/modules/cloud/studio/components/studio-product-card'
import type { StudioProduct } from '@/modules/cloud/studio/use-studio-products'

const base: StudioProduct = {
  envId: 'env1',
  subdomain: 'sub',
  prefix: 'vetra-agent',
  label: 'Vetra Studio',
  brand: null,
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
      <StudioProductCard product={{ ...base, status: 'booting' }} href={AGENT_URL} />,
    )
    // Falls back to the env label when brand is unavailable.
    getByText('Vetra Studio')
    getByText(/provisioning/i)
    expect(container.querySelector('a')).toBeNull()
  })

  it('still renders a card with unknown brand from its label/subdomain', () => {
    const { getByText } = render(
      <StudioProductCard product={{ ...base, label: 'Untitled', status: 'booting' }} href="#" />,
    )
    getByText('Untitled')
    getByText('sub')
  })
})
