import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { NewProductCard } from '@/modules/cloud/studio/components/new-product-card'

const noop = () => Promise.resolve()

describe('NewProductCard', () => {
  it('renders a disabled limit-reached notice when atLimit', () => {
    const onCreate = vi.fn(noop)
    const { getByText, container } = render(
      <NewProductCard
        onCreate={onCreate}
        createError={null}
        hasAttachedKey={false}
        atLimit
        limit={3}
      />,
    )
    getByText('Limit reached — 3 of 3 products')
    // No interactive create control while at the limit.
    expect(container.querySelector('button')).toBeNull()
  })

  it('does not create or open a dialog when clicked at the limit', () => {
    const onCreate = vi.fn(noop)
    const { getByText } = render(
      <NewProductCard onCreate={onCreate} createError={null} hasAttachedKey atLimit limit={3} />,
    )
    fireEvent.click(getByText('Limit reached — 3 of 3 products'))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('renders the normal create CTA below the limit', () => {
    const onCreate = vi.fn(noop)
    const { getByText, container } = render(
      <NewProductCard onCreate={onCreate} createError={null} hasAttachedKey={false} />,
    )
    getByText(/create new product/i)
    expect(container.querySelector('button')).not.toBeNull()
  })

  it('provisions immediately when the invite code carries a key', () => {
    const onCreate = vi.fn(noop)
    const { getByText } = render(
      <NewProductCard onCreate={onCreate} createError={null} hasAttachedKey />,
    )
    fireEvent.click(getByText(/create new product/i))
    expect(onCreate).toHaveBeenCalled()
  })
})
