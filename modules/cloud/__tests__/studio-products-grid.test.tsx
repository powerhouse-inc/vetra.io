import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import type { StudioProductsState } from '@/modules/cloud/studio/use-studio-products'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

// Brand is cached server-side and carried on each product, so cards render
// synchronously from `product.brand` — no hook to stub.
// Mutable holder so each test can drive the grid through its states.
let state: StudioProductsState
vi.mock('@/modules/cloud/studio/use-studio-products', () => ({ useStudioProducts: () => state }))

import { StudioProductsGrid } from '@/modules/cloud/studio/components/studio-products-grid'

const baseState: StudioProductsState = {
  gate: 'ready',
  products: [],
  isScanning: false,
  limit: 0,
  atLimit: false,
  creating: false,
  createError: null,
  createProduct: vi.fn(),
  hasAttachedKey: false,
  did: undefined,
}

describe('StudioProductsGrid', () => {
  it('renders a card per product plus the new-product card', () => {
    state = {
      ...baseState,
      products: [
        {
          envId: 'e1',
          subdomain: 's',
          prefix: 'vetra-agent',
          label: 'L',
          brand: { title: 'Concord', tagline: null, description: null },
          status: 'ready',
        },
      ],
    }
    const { getByText } = render(<StudioProductsGrid />)
    getByText('Concord')
    getByText(/create new product/i)
  })

  it('shows skeleton loaders on first load with no data', () => {
    state = { ...baseState, isScanning: true, products: [] }
    const { container, queryByText } = render(<StudioProductsGrid />)
    // No empty-state copy and no create CTA while still loading.
    expect(queryByText(/no products yet/i)).toBeNull()
    expect(queryByText(/create new product/i)).toBeNull()
    // Skeleton cards use animate-pulse placeholders.
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows a friendly empty state with a create CTA when authed and empty', () => {
    state = { ...baseState, isScanning: false, products: [] }
    const { getByText } = render(<StudioProductsGrid />)
    getByText(/no products yet/i)
    getByText(/create new product/i)
  })
})
