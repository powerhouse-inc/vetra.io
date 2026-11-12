import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AppRole } from '../types'

const ANNA = '0x' + 'a'.repeat(40)
const FRANK = '0x' + 'f'.repeat(40)

let roles: AppRole[] = []
const setMutate = vi.fn()
const removeMutate = vi.fn()

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock('../hooks/use-apps', () => ({
  useAppRoles: () => ({ data: roles, isPending: false, error: null }),
  useSetAppRole: () => ({ mutate: setMutate, isPending: false }),
  useRemoveAppRole: () => ({ mutate: removeMutate, isPending: false }),
}))
vi.mock('@/modules/shared/components/person-name', () => ({
  PersonName: ({ value }: { value: string }) => (
    <span>{value === ANNA ? 'Anna' : value === FRANK ? 'Frank' : 'someone'}</span>
  ),
}))

import { ReleaseManagers } from '../components/release-managers'

const role = (address: string): AppRole => ({
  appId: 'app-1',
  address,
  role: 'release_manager',
  grantedBy: FRANK,
  grantedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
})

describe('ReleaseManagers', () => {
  beforeEach(() => {
    cleanup()
    roles = []
    setMutate.mockReset()
    removeMutate.mockReset()
  })

  it('lists release managers by Renown name, with who named them', () => {
    roles = [role(ANNA)]
    render(<ReleaseManagers appId="app-1" />)
    const row = screen.getByTestId(`release-manager-${ANNA}`)
    expect(row.textContent).toContain('Anna')
    expect(row.textContent).toContain('named 2 days ago by Frank')
    expect(screen.queryByText(ANNA)).toBeNull()
  })

  it('adds by address, lower-cased, and refuses anything else', () => {
    render(<ReleaseManagers appId="app-1" />)
    const input = screen.getByLabelText('Add release manager')
    fireEvent.change(input, { target: { value: 'frank.eth' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('alert').textContent).toMatch(/0x and 40 hex digits/)
    expect(setMutate).not.toHaveBeenCalled()
    const mixed = '0x' + 'Ab'.repeat(20)
    fireEvent.change(input, { target: { value: `did:pkh:eip155:1:${mixed}` } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(setMutate).toHaveBeenCalledWith(mixed.toLowerCase(), expect.anything())
  })

  it('does not add someone twice', () => {
    roles = [role(ANNA)]
    render(<ReleaseManagers appId="app-1" />)
    fireEvent.change(screen.getByLabelText('Add release manager'), { target: { value: ANNA } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(screen.getByRole('alert').textContent).toBe('Already a release manager.')
    expect(setMutate).not.toHaveBeenCalled()
  })

  it('removes after a confirmation', () => {
    roles = [role(ANNA)]
    render(<ReleaseManagers appId="app-1" />)
    fireEvent.click(
      within(screen.getByTestId(`release-manager-${ANNA}`)).getByRole('button', {
        name: /remove/i,
      }),
    )
    expect(removeMutate).not.toHaveBeenCalled()
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
    expect(removeMutate).toHaveBeenCalledWith(ANNA, expect.anything())
  })
})
