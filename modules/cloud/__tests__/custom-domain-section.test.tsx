import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CustomDomainSection } from '@/modules/cloud/components/custom-domain-section'
import type { CloudCustomDomain } from '@/modules/cloud/types'

const domain = (d: string): CloudCustomDomain =>
  ({ enabled: true, domain: d, dnsRecords: [] }) as unknown as CloudCustomDomain

const saveButton = () => screen.getByRole('button', { name: 'Save' })

describe('CustomDomainSection', () => {
  it('keeps Save disabled while nothing changed', () => {
    render(
      <CustomDomainSection
        customDomain={domain('kv.example')}
        apexService={null}
        enabledServices={['CONNECT', 'SWITCHBOARD']}
        onSetCustomDomain={vi.fn()}
      />,
    )
    expect(saveButton().hasAttribute('disabled')).toBe(true)
  })

  /* The apex pick alone used to be unsaveable: Save only looked at the domain. */
  it('enables Save when only the apex service changes, and sends it', async () => {
    const onSet = vi.fn().mockResolvedValue(undefined)
    render(
      <CustomDomainSection
        customDomain={domain('kv.example')}
        apexService={null}
        enabledServices={['CONNECT', 'SWITCHBOARD']}
        onSetCustomDomain={onSet}
      />,
    )
    fireEvent.change(screen.getByLabelText(/apex/i), { target: { value: 'CONNECT' } })
    expect(saveButton().hasAttribute('disabled')).toBe(false)
    fireEvent.click(saveButton())
    await waitFor(() => expect(onSet).toHaveBeenCalledWith(true, 'kv.example', 'CONNECT'))
  })

  /* Inputs were seeded once in useState and went stale when the doc changed. */
  it('re-syncs the inputs when the saved domain changes', () => {
    const { rerender } = render(
      <CustomDomainSection
        customDomain={domain('old.example')}
        apexService={null}
        enabledServices={['CONNECT']}
        onSetCustomDomain={vi.fn()}
      />,
    )
    rerender(
      <CustomDomainSection
        customDomain={domain('new.example')}
        apexService="CONNECT"
        enabledServices={['CONNECT']}
        onSetCustomDomain={vi.fn()}
      />,
    )
    expect((screen.getByDisplayValue('new.example') as HTMLInputElement).value).toBe('new.example')
    expect((screen.getByLabelText(/apex/i) as HTMLSelectElement).value).toBe('CONNECT')
  })
})
