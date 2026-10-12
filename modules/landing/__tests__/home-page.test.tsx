import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HomePage } from '@/modules/landing/home/home-page'
import { expectNoOpenCloudClaim, expectNoPlaceholders } from './page-checks'

describe('HomePage', () => {
  it('leads with the agent + cloud headline', () => {
    render(<HomePage />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'An agent that builds Powerhouse apps. A cloud that hosts them.',
      }),
    ).toBeTruthy()
  })

  it('links to early access, redeem and the real deploy action', () => {
    const { container } = render(<HomePage />)
    const hrefs = [...container.querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/studio#access')
    expect(hrefs).toContain('/redeem')
    expect(container.textContent).toContain('powerhouse-inc/vetra-deploy-action@v1')
  })

  it('ships no placeholders and no open-cloud claim', () => {
    const { container } = render(<HomePage />)
    expectNoPlaceholders(container.textContent ?? '')
    expectNoOpenCloudClaim(container.textContent ?? '')
  })
})
