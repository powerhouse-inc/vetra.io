import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { useDocumentTitle } from '../use-document-title'

function Titled({ title }: { title: string | null }) {
  useDocumentTitle(title)
  return null
}

describe('useDocumentTitle', () => {
  it('sets "<title> · Vetra" and restores the previous title on unmount', () => {
    document.title = 'Vetra'
    const view = render(<Titled title="Morning Bell" />)
    expect(document.title).toBe('Morning Bell · Vetra')
    view.unmount()
    expect(document.title).toBe('Vetra')
  })

  it('follows a title that arrives later (data still loading)', () => {
    document.title = 'Vetra'
    const view = render(<Titled title={null} />)
    expect(document.title).toBe('Vetra')
    view.rerender(<Titled title="acme-ops" />)
    expect(document.title).toBe('acme-ops · Vetra')
  })
})
