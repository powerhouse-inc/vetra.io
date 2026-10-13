import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let summary: unknown = {
  data: {
    id: 'o1',
    did: 'd',
    handle: 'acme',
    name: 'Acme',
    avatar: null,
    verifiedDomains: ['acme.example'],
  },
}
vi.mock('../hooks/use-orgs', () => ({ useOrgSummary: () => summary }))

import { OrgBadge } from '../components/org-badge'

afterEach(cleanup)

describe('OrgBadge', () => {
  it('links the organisation by handle and marks a verified domain', () => {
    render(<OrgBadge orgId="o1" />)
    const link = screen.getByRole('link', { name: /Acme/ })
    expect(link.getAttribute('href')).toMatch(/\/@acme$/)
    expect(screen.getByLabelText('Verified: acme.example')).toBeTruthy()
  })

  it('renders nothing without an org or for an unknown one', () => {
    const { container } = render(<OrgBadge orgId={null} />)
    expect(container.innerHTML).toBe('')
    summary = { data: null }
    const second = render(<OrgBadge orgId="nope" />)
    expect(second.container.innerHTML).toBe('')
  })
})
