import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CloudPage } from '@/modules/landing/cloud/cloud-page'
import { expectNoOpenCloudClaim, expectNoPlaceholders } from './page-checks'

describe('CloudPage', () => {
  it('positions Cloud as managed hosting with an exit', () => {
    render(<CloudPage />)
    expect(
      screen.getByRole('heading', { level: 1, name: /Managed hosting for Powerhouse apps\./ }),
    ).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Leaving is a feature\./ })).toBeTruthy()
  })

  it('prices by capacity with the interactive picker', () => {
    render(<CloudPage />)
    expect(screen.getByRole('heading', { name: /Pay for capacity\./ })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Choose capacity' })).toBeTruthy()
  })

  it('offers redeem and a walkthrough', () => {
    const { container } = render(<CloudPage />)
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/redeem')
    expect(hrefs).toContain('https://calendar.app.google/nmxvyJStMgN6pLzx6')
  })

  it('ships no placeholders and no open-cloud claim', () => {
    const { container } = render(<CloudPage />)
    expectNoPlaceholders(container.textContent ?? '')
    expectNoOpenCloudClaim(container.textContent ?? '')
  })
})
