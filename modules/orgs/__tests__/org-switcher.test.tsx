import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, fireEvent } from '@testing-library/react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/modules/shared/components/ui/dropdown-menu'

const setActiveOrg = vi.fn()
const orgs = [
  {
    id: 'o1',
    did: 'd1',
    handle: 'acme',
    name: 'Acme Robotics',
    avatar: null,
    verifiedDomains: ['acme.example'],
    role: 'ADMIN',
  },
  {
    id: 'o2',
    did: 'd2',
    handle: 'zeta',
    name: 'Zeta',
    avatar: null,
    verifiedDomains: [],
    role: 'MEMBER',
  },
]
let state = {
  orgId: null as string | null,
  org: null as null | (typeof orgs)[number],
  orgs,
  isLoading: false,
  setActiveOrg,
}
vi.mock('../hooks/use-orgs', () => ({ useActiveOrg: () => state }))

import { OrgSwitcherMenuSection, ActiveOrgLabel } from '../components/org-switcher'

function open() {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <OrgSwitcherMenuSection />
      </DropdownMenuContent>
    </DropdownMenu>,
  )
}

afterEach(() => {
  cleanup()
  setActiveOrg.mockClear()
  state = { ...state, orgId: null, org: null }
})

describe('OrgSwitcherMenuSection', () => {
  it('offers Personal and every organisation, with Personal checked by default', () => {
    open()
    expect(screen.getByText('Working in')).toBeTruthy()
    expect(
      screen.getByRole('menuitemradio', { name: /Personal/ }).getAttribute('aria-checked'),
    ).toBe('true')
    expect(screen.getByRole('menuitemradio', { name: /Acme Robotics/ })).toBeTruthy()
    expect(screen.getByRole('menuitemradio', { name: /Zeta/ })).toBeTruthy()
  })

  it('switches the context', () => {
    open()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Acme Robotics/ }))
    expect(setActiveOrg).toHaveBeenCalledWith('o1')
  })

  it('switches back to personal with null', () => {
    state = { ...state, orgId: 'o1', org: orgs[0] }
    open()
    fireEvent.click(screen.getByRole('menuitemradio', { name: /Personal/ }))
    expect(setActiveOrg).toHaveBeenCalledWith(null)
  })

  it('links to creating an organisation and, in an org, to managing it by handle', () => {
    state = { ...state, orgId: 'o1', org: orgs[0] }
    open()
    expect(
      screen.getByRole('menuitem', { name: /Create an organisation/ }).getAttribute('href'),
    ).toMatch(/\/org\/new$/)
    expect(
      screen.getByRole('menuitem', { name: /Manage Acme Robotics/ }).getAttribute('href'),
    ).toMatch(/\/org\/acme\/manage\/members$/)
  })

  it('hides the manage link when personal', () => {
    open()
    expect(screen.queryByRole('menuitem', { name: /Manage/ })).toBeNull()
  })
})

describe('ActiveOrgLabel', () => {
  it('shows the active org name, nothing when personal', () => {
    const empty = render(<ActiveOrgLabel />)
    expect(empty.container.innerHTML).toBe('')
    state = { ...state, orgId: 'o1', org: orgs[0] }
    render(<ActiveOrgLabel />)
    expect(screen.getByText(/Acme Robotics/)).toBeTruthy()
  })
})
