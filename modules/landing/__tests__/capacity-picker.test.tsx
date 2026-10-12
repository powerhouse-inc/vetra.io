import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CapacityPicker } from '@/modules/landing/components/capacity-picker'

describe('CapacityPicker', () => {
  it('starts on 4 vCPU at €80', () => {
    render(<CapacityPicker />)
    expect(screen.getByRole('button', { name: '4 vCPU' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('€80')).toBeTruthy()
  })

  it('updates specs and price when another size is chosen', () => {
    render(<CapacityPicker />)
    fireEvent.click(screen.getByRole('button', { name: '8 vCPU' }))
    expect(screen.getByText('€160')).toBeTruthy()
    expect(screen.getByText('16 GB')).toBeTruthy()
    expect(screen.getByText('320 GB')).toBeTruthy()
    expect(screen.getByRole('button', { name: '8 vCPU' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '4 vCPU' }).getAttribute('aria-pressed')).toBe(
      'false',
    )
  })
})
