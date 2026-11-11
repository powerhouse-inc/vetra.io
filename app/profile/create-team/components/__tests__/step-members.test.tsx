import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/modules/shared/hooks/use-person-name', async () => {
  const { addressOf } = await vi.importActual<typeof import('@/modules/shared/lib/renown-person')>(
    '@/modules/shared/lib/renown-person',
  )
  return {
    usePersonName: (v: string | null | undefined) => ({
      name: null,
      avatarUrl: null,
      address: addressOf(v),
    }),
  }
})
vi.mock('@/modules/profile/lib/use-ens-resolver', () => ({
  useEnsResolver: vi.fn(() => null),
}))
import { StepMembers } from '../step-members'

describe('StepMembers', () => {
  it('shows creator pinned at top, not removable', () => {
    render(
      <StepMembers
        creator={{ address: '0xabc', displayName: 'Frank', displayAddress: '0xa…bc' }}
        members={[]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/Frank/)).toBeTruthy()
    expect(screen.getByText(/admin/i)).toBeTruthy()
  })

  it('adds a row when Add member is clicked', () => {
    const onChange = vi.fn()
    render(
      <StepMembers
        creator={{ address: '0xabc', displayName: 'Frank', displayAddress: '0xa…bc' }}
        members={[]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /add member/i }))
    expect(onChange).toHaveBeenCalledWith([{ address: '' }])
  })

  it('removes a row when remove button is clicked', () => {
    const onChange = vi.fn()
    render(
      <StepMembers
        creator={{ address: '0xabc', displayName: 'Frank', displayAddress: '0xa…bc' }}
        members={[{ address: '0x' + 'd'.repeat(40) }]}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it('never names the creator by an address-like username', () => {
    render(
      <StepMembers
        creator={{ address: '0xabc', displayName: '0x2BbE...3aC6', displayAddress: '0xa…bc' }}
        members={[]}
        onChange={() => {}}
      />,
    )
    expect(screen.queryByText('0x2BbE...3aC6')).toBeNull()
    expect(screen.getByText('You')).toBeTruthy()
  })

  it('flags duplicate of creator address', () => {
    render(
      <StepMembers
        creator={{ address: '0x' + 'a'.repeat(40), displayName: 'Frank', displayAddress: '' }}
        members={[{ address: '0x' + 'a'.repeat(40) }]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/already invited/i)).toBeTruthy()
  })

  it('flags invalid address', () => {
    render(
      <StepMembers
        creator={{ address: '0xabc', displayName: 'Frank', displayAddress: '' }}
        members={[{ address: 'not-an-address' }]}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByText(/0x… address/i)).toBeTruthy()
  })
})
