import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { StudioProductCard } from '@/modules/cloud/studio/components/studio-product-card'
import type { StudioProduct } from '@/modules/cloud/studio/use-studio-products'

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
  it('shows brand title/tagline/description and links to the env', () => {
    const { container, getByText } = render(<StudioProductCard product={base} />)
    getByText('Concord')
    getByText('Share the burden.')
    getByText('Coordinates procurement.')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/studio/env1')
  })
  it('falls back to the env label when no brand, and shows Starting for booting', () => {
    const { getByText } = render(
      <StudioProductCard product={{ ...base, brand: null, status: 'booting' }} />,
    )
    getByText('Vetra Studio')
    getByText(/starting/i)
  })
})
