import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'

import { StudioProductCard } from '@/modules/cloud/studio/components/studio-product-card'
import type { StudioProduct } from '@/modules/cloud/studio/use-studio-products'

const AGENT_URL = 'https://vetra-agent.warm-newt-75.vetra.io/?user=did%3Aethr%3A0xabc'

const base: StudioProduct = {
  envId: 'env1',
  subdomain: 'sub',
  prefix: 'vetra-agent',
  label: 'Vetra Studio',
  brand: {
    title: 'Concord',
    tagline: 'Share the burden.',
    description: 'Coordinates procurement.',
  },
  status: 'ready',
}

describe('StudioProductCard', () => {
  it('links a ready product straight to its agent URL in a new tab', () => {
    const { container, getByText } = render(<StudioProductCard product={base} href={AGENT_URL} />)
    getByText('Concord')
    getByText('Share the burden.')
    getByText('Coordinates procurement.')
    const link = container.querySelector('a')
    expect(link?.getAttribute('href')).toBe(AGENT_URL)
    expect(link?.getAttribute('target')).toBe('_blank')
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders a booting product as inert (no link) with a Starting badge', () => {
    const { container, getByText } = render(
      <StudioProductCard product={{ ...base, brand: null, status: 'booting' }} href={AGENT_URL} />,
    )
    getByText('Vetra Studio')
    getByText(/starting/i)
    expect(container.querySelector('a')).toBeNull()
  })
})
