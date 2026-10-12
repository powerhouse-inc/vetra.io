import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StudioPage } from '@/modules/landing/studio/studio-page'
import { WAITLIST_ACTION } from '@/modules/studio-license/lib/waitlist'
import { expectNoOpenCloudClaim, expectNoPlaceholders } from './page-checks'

describe('StudioPage', () => {
  it('introduces Studio and is upfront about its maturity', () => {
    const { container } = render(<StudioPage />)
    expect(
      screen.getByRole('heading', {
        level: 1,
        name: 'A studio of your own, with an agent that builds alongside you',
      }),
    ).toBeTruthy()
    expect(container.textContent).toContain('pre-alpha')
    expect(container.textContent).toContain('Anthropic Claude')
  })

  it('has an #access section with the waitlist form and redeem link', () => {
    const { container } = render(<StudioPage />)
    const access = container.querySelector('#access')
    expect(access).toBeTruthy()
    const form = access?.querySelector('form')
    expect(form?.getAttribute('action')).toBe(WAITLIST_ACTION)
    expect(screen.getByLabelText('Email for the waitlist')).toBeTruthy()
    expect(access?.querySelector('a[href="/redeem"]')).toBeTruthy()
  })

  it('ships no placeholders and no open-cloud claim', () => {
    const { container } = render(<StudioPage />)
    expectNoPlaceholders(container.textContent ?? '')
    expectNoOpenCloudClaim(container.textContent ?? '')
  })
})
