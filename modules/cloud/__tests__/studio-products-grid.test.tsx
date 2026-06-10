import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

const state = {
  gate: 'ready' as const,
  products: [
    {
      envId: 'e1',
      subdomain: 's',
      prefix: 'vetra-agent',
      label: 'L',
      brand: { title: 'Concord', tagline: null, description: null },
      status: 'ready' as const,
    },
  ],
  isScanning: false,
  creating: false,
  createError: null,
  createProduct: vi.fn(),
  did: undefined,
}
vi.mock('@/modules/cloud/studio/use-studio-products', () => ({ useStudioProducts: () => state }))

import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'

describe('StudioProductsGrid', () => {
  it('renders a card per product plus the new-product card', () => {
    const { getByText } = render(<StudioProductsGrid />)
    getByText('Concord')
    getByText(/create new product/i)
  })
})
