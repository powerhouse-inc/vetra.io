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
        name: 'A studio of your own, with an agent that builds alongside you.',
      }),
    ).toBeTruthy()
    expect(container.textContent).toContain('pre-alpha')
    expect(container.textContent).toContain('monthly model budget')
  })

  it('has an #access section with the request-access form and redeem link', () => {
    const { container } = render(<StudioPage />)
    const access = container.querySelector('#access')
    expect(access).toBeTruthy()
    const form = access?.querySelector('form')
    expect(form?.getAttribute('action')).toBe(WAITLIST_ACTION)
    expect(screen.getByLabelText('Email to request access')).toBeTruthy()
    expect(access?.querySelector('a[href="/redeem"]')).toBeTruthy()
  })

  it('uses the shared CTA labels', () => {
    const { container } = render(<StudioPage />)
    const text = container.textContent ?? ''
    expect(text).toContain('Request access')
    expect(text).toContain('Redeem a code')
    for (const old of ['Join the waitlist', 'I have an access code']) {
      expect(text).not.toContain(old)
    }
  })

  it('ships no placeholders and no open-cloud claim', () => {
    const { container } = render(<StudioPage />)
    expectNoPlaceholders(container.textContent ?? '')
    expectNoOpenCloudClaim(container.textContent ?? '')
  })

  it('makes only promises the product keeps', () => {
    const { container } = render(<StudioPage />)
    const text = container.textContent ?? ''
    for (const gone of [
      'Nothing is written until you approve',
      'Every step is a commit',
      'Data may be lost between versions',
      'You approve every plan',
      'committed step by step',
      'approved by you',
    ]) {
      expect(text).not.toContain(gone)
    }
    for (const here of [
      'Studio explains what it will build before it builds it.',
      'Your work is saved',
      'Download your workspace any time; GitHub sync arrives with publishing.',
      'You can stop or redirect it at any point.',
      'saved as it goes',
      'Major version upgrades may need a re-run; keep an export of important work',
      'You steer every step',
    ]) {
      expect(text).toContain(here)
    }
  })
})
