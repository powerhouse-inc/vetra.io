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
// The lapsed-licence banner reads the studio licence and its warnings.
vi.mock('@/modules/subscriptions/hooks/use-subscriptions', () => ({
  useStudioAccess: () => ({
    data: { allowed: false, licenseId: 'studio-1', expires: null, hasAttachedKey: false },
  }),
  useMySubscriptions: () => ({
    data: [
      {
        licenseId: 'studio-1',
        warnings: [
          {
            kind: 'ENDED_STOP_PENDING',
            at: '2026-10-20T00:00:00Z',
            message: 'Studios stop on Oct 20.',
          },
        ],
      },
    ],
  }),
}))

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

  it('keeps listing existing studios after the licence lapsed, without creating', () => {
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
    const { getByText, queryByText, getByRole } = render(<StudioProductsGrid locked />)
    getByText('Concord')
    getByText('Your studio access has ended')
    getByText(/Studios stop on Oct 20\./)
    expect(queryByText(/create new product/i)).toBeNull()
    expect(getByRole('link', { name: 'Redeem a code' }).getAttribute('href')).toBe('/redeem')
  })

  it('shows the redeem panel when the licence lapsed and there are no studios', () => {
    state = { ...baseState, products: [] }
    const { getByRole, queryByText } = render(<StudioProductsGrid locked />)
    getByRole('heading', { name: /vetra studio is in early access/i })
    expect(queryByText(/create new product/i)).toBeNull()
  })
})
