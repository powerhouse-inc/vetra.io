import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FusionConfigDialog } from '@/modules/cloud/components/fusion-config-dialog'

describe('FusionConfigDialog', () => {
  it('prefills the current config', () => {
    render(
      <FusionConfigDialog
        open
        onOpenChange={() => {}}
        config={{
          image: 'cr.vetra.io/achra/frontend',
          env: [{ name: 'NEXT_PUBLIC_SHOW_WHITELIST_OVERLAY', value: 'false', isSecret: false }],
          autoUpdate: true,
          autoUpdateTagPattern: null,
        }}
        onSubmit={async () => {}}
      />,
    )
    expect((screen.getByLabelText(/^image$/i) as HTMLInputElement).value).toBe(
      'cr.vetra.io/achra/frontend',
    )
    expect((screen.getByLabelText('env-name-0') as HTMLInputElement).value).toBe(
      'NEXT_PUBLIC_SHOW_WHITELIST_OVERLAY',
    )
    expect(screen.getByRole('switch', { name: /auto-deploy/i }).getAttribute('aria-checked')).toBe(
      'true',
    )
  })

  it('submits the doc config with secret values split off', async () => {
    const onSubmit = vi.fn(async () => {})
    render(
      <FusionConfigDialog
        open
        onOpenChange={() => {}}
        config={{
          image: 'cr.vetra.io/achra/frontend',
          env: [{ name: 'MAILCHIMP_API_KEY', value: null, isSecret: true }],
          autoUpdate: false,
          autoUpdateTagPattern: null,
        }}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByLabelText('env-value-0'), { target: { value: 'new-secret' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        {
          image: 'cr.vetra.io/achra/frontend',
          env: [{ name: 'MAILCHIMP_API_KEY', value: null, isSecret: true }],
          autoUpdate: false,
          autoUpdateTagPattern: null,
        },
        [{ name: 'MAILCHIMP_API_KEY', value: 'new-secret' }],
      ),
    )
  })

  it('blocks images outside cr.vetra.io', async () => {
    const onSubmit = vi.fn(async () => {})
    render(<FusionConfigDialog open onOpenChange={() => {}} config={null} onSubmit={onSubmit} />)
    fireEvent.change(screen.getByLabelText(/^image$/i), { target: { value: 'docker.io/x/y' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    expect(await screen.findByText(/must be a repository on cr\.vetra\.io/)).toBeTruthy()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
