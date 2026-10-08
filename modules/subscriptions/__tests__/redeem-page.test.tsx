import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'

const push = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { safeDecode } from '../lib/redeem'
import { redeemPath } from '@/modules/publisher/lib/invite-codes'
import { RedeemCodeForm } from '../components/redeem/redeem-code-form'

describe('RedeemCodeForm', () => {
  beforeEach(() => {
    cleanup()
    push.mockClear()
  })

  it('goes to /redeem/<code> with the code unchanged', () => {
    render(<RedeemCodeForm />)
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: '  LFC_2026-vip ' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Redeem an invite code' }))
    expect(push).toHaveBeenCalledWith('/redeem/LFC_2026-vip')
  })

  it('encodes characters that are not URL-safe', () => {
    render(<RedeemCodeForm />)
    fireEvent.change(screen.getByLabelText('Invite code'), { target: { value: 'a/b c' } })
    fireEvent.submit(screen.getByRole('form', { name: 'Redeem an invite code' }))
    expect(push).toHaveBeenCalledWith('/redeem/a%2Fb%20c')
  })

  it('does nothing for an empty code', () => {
    render(<RedeemCodeForm />)
    fireEvent.submit(screen.getByRole('form', { name: 'Redeem an invite code' }))
    expect(push).not.toHaveBeenCalled()
  })

  it('round-trips mixed case, dash and underscore through the path unchanged', () => {
    for (const code of ['LFC_2026-vip', 'MixedCase', 'a_b-C_d', '50%off', 'a/b c', '%41']) {
      const segment = redeemPath(code).split('/')[2]
      expect(safeDecode(segment)).toBe(code)
    }
  })

  it('decodes an encoded path exactly once', () => {
    expect(safeDecode('%2541')).toBe('%41')
  })
})
