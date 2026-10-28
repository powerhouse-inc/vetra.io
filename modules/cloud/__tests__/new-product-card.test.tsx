import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'

import { NewProductCard } from '@/modules/cloud/studio/components/new-product-card'

const noop = () => Promise.resolve()

describe('NewProductCard', () => {
  it('renders a disabled limit-reached notice when atLimit', () => {
    const onCreate = vi.fn(noop)
    const { getByText, container } = render(
      <NewProductCard onCreate={onCreate} createError={null} atLimit limit={3} />,
    )
    getByText('Limit reached — 3 of 3 studios')
    expect(container.querySelector('button')).toBeNull()
    fireEvent.click(getByText('Limit reached — 3 of 3 studios'))
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('creates on click, with no key form', () => {
    const onCreate = vi.fn(noop)
    const { getByText, queryByLabelText } = render(
      <NewProductCard onCreate={onCreate} createError={null} />,
    )
    fireEvent.click(getByText(/^new studio$/i))
    expect(onCreate).toHaveBeenCalledOnce()
    expect(queryByLabelText(/api key/i)).toBeNull()
  })

  it('shows a create error under the card', () => {
    const { getByText } = render(<NewProductCard onCreate={vi.fn(noop)} createError="boom" />)
    getByText('boom')
  })
})
