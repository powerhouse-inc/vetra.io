import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { MyOrg } from '@/modules/orgs/types'

vi.mock('@/modules/orgs/hooks/use-orgs', () => ({ useMyOrgs: vi.fn() }))

import { useMyOrgs } from '@/modules/orgs/hooks/use-orgs'
import { OrgsTab } from '../orgs-tab'

const mockUseMyOrgs = useMyOrgs as unknown as ReturnType<typeof vi.fn>

const org = (over: Partial<MyOrg> = {}): MyOrg => ({
  id: 'o1',
  did: 'did:web:sektar',
  handle: 'sektar',
  name: 'Sektar',
  avatar: null,
  verifiedDomains: [],
  role: 'ADMIN',
  ...over,
})

describe('OrgsTab', () => {
  it('shows skeletons while loading', () => {
    mockUseMyOrgs.mockReturnValue({ isLoading: true, isError: false, data: undefined })
    render(<OrgsTab />)
    expect(screen.getAllByTestId('org-card-skeleton').length).toBeGreaterThan(0)
  })

  it('lists organisations with role and a Renown manage link', () => {
    mockUseMyOrgs.mockReturnValue({
      isLoading: false,
      isError: false,
      data: [org(), org({ id: 'o2', handle: 'bai', name: 'BAI', role: 'OWNER' })],
    })
    render(<OrgsTab />)
    expect(screen.getByText('Sektar')).toBeTruthy()
    expect(screen.getByText('@bai · Owner')).toBeTruthy()
    const manage = screen.getByRole('link', { name: 'Manage Sektar on Renown' })
    expect(manage.getAttribute('href')).toContain('/org/sektar/manage/members')
  })

  it('offers creating one on Renown when there are none', () => {
    mockUseMyOrgs.mockReturnValue({ isLoading: false, isError: false, data: [] })
    render(<OrgsTab />)
    expect(screen.getByText(/not in an organisation yet/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: /new organisation/i }).getAttribute('href')).toContain(
      '/org/new',
    )
  })

  it('shows a retryable error when the list fails', () => {
    const refetch = vi.fn()
    mockUseMyOrgs.mockReturnValue({ isLoading: false, isError: true, data: undefined, refetch })
    render(<OrgsTab />)
    screen.getByRole('button', { name: /retry/i }).click()
    expect(refetch).toHaveBeenCalled()
  })
})
