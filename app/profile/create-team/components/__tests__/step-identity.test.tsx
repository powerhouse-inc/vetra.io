import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { StepIdentity } from '../step-identity'

describe('StepIdentity', () => {
  it('auto-suggests slug from name', () => {
    const set = vi.fn()
    render(<StepIdentity name="" slug="" slugStatus="idle" onChange={set} />)
    const nameInput = screen.getByLabelText(/team name/i)
    fireEvent.change(nameInput, { target: { value: 'Acme Corp' } })
    expect(set).toHaveBeenCalledWith({ name: 'Acme Corp', slug: 'acme-corp' })
  })

  it('shows checking status', () => {
    render(<StepIdentity name="Acme" slug="acme" slugStatus="checking" onChange={vi.fn()} />)
    expect(screen.getByText(/checking/i)).toBeTruthy()
  })

  it('shows available status', () => {
    render(<StepIdentity name="Acme" slug="acme" slugStatus="available" onChange={vi.fn()} />)
    expect(screen.getByText(/available/i)).toBeTruthy()
  })

  it('shows taken status', () => {
    render(<StepIdentity name="Acme" slug="acme" slugStatus="taken" onChange={vi.fn()} />)
    expect(screen.getByText(/taken/i)).toBeTruthy()
  })
})
