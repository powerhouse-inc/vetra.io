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

  it('puts its title back when the router rewrites the layout title', async () => {
    document.title = 'Vetra'
    const view = render(<Titled title="Settings" />)
    document.title = 'Vetra' // what Next does on router.replace(?tab=...)
    await new Promise((r) => setTimeout(r, 0)) // MutationObserver callbacks are microtasks
    expect(document.title).toBe('Settings · Vetra')
    view.unmount()
  })
})
