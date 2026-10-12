import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InstallChip } from '@/modules/landing/components/install-chip'

describe('InstallChip', () => {
  it('shows the install command with a copy button', () => {
    render(<InstallChip />)
    expect(screen.getByText('curl -fsSL https://get.vetra.io | sh')).toBeTruthy()
    expect(screen.getByRole('button', { name: /copy/i })).toBeTruthy()
  })
})
