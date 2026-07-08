import type { ReactNode } from 'react'
import { describe, it, vi } from 'vitest'
import { render } from '@testing-library/react'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))
vi.mock('@powerhousedao/reactor-browser', () => ({ useDid: () => 'did:ethr:0xabc' }))

import { StudioGroupHeader } from '@/modules/cloud/studio/components/studio-group-header'
import type { StudioProduct } from '@/modules/cloud/studio/use-studio-products'

const base: StudioProduct = {
  envId: 'env1',
  subdomain: 'clear-yak',
  prefix: 'vetra-agent',
  label: 'Vetra Studio',
  brand: null,
  status: 'ready',
}

const noop = () => undefined

describe('StudioGroupHeader', () => {
  it('renders the cached brand title and tagline', () => {
    const product: StudioProduct = {
      ...base,
      brand: { title: 'Hotel Breakfast', tagline: 'Plan the morning', description: null },
    }
    const { getByText } = render(
      <StudioGroupHeader studio={product} collapsed={false} onToggleCollapse={noop} />,
    )
    getByText('Hotel Breakfast — Studio')
    getByText('Plan the morning')
  })

  it('falls back to "Vetra Studio — Studio" when no brand is cached', () => {
    const { getByText } = render(
      <StudioGroupHeader studio={base} collapsed={false} onToggleCollapse={noop} />,
    )
    getByText('Vetra Studio — Studio')
  })
})
