import { describe, it, expect, vi, beforeEach } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { PublisherApiError } from '@/modules/publisher/graphql'
import type { RenownAppProfile } from '../lib/app-profile/api'

const DID = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK'
const STORED: RenownAppProfile = {
  appDid: DID,
  documentId: 'doc-9',
  name: 'Vault',
  tagline: 'Notes for teams',
  logo: null,
  website: 'https://vault.example',
  publisherDid: 'did:pkh:eip155:1:0xabc0000000000000000000000000000000000001',
  description: 'Keeps **notes**.',
  category: 'Productivity',
  logoRef: null,
  coverRef: null,
  links: [{ id: 'l1', label: 'Docs', url: 'https://docs.vault.example' }],
}

let profile: { data: RenownAppProfile | null; isPending: boolean; error: Error | null; refetch: () => void }
const mutateAsync = vi.fn()

vi.mock('../hooks/use-app-profile', () => ({
  useAppProfile: () => profile,
  useUpdateAppProfile: () => ({ mutateAsync, isPending: false }),
  useRenownBearer: () => async () => 'bearer',
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { AppProfileCard } from '../components/profile/app-profile-card'
import { AppProfileTab } from '../components/profile/profile-tab'

const saveButton = () => screen.getByRole('button', { name: 'Save profile' }) as HTMLButtonElement

beforeEach(() => {
  cleanup()
  mutateAsync.mockReset()
  profile = { data: STORED, isPending: false, error: null, refetch: vi.fn() }
})

describe('AppProfileTab', () => {
  it('explains when the app has no Renown identity', () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={null} />)
    expect(screen.getByText('No Renown identity yet')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull()
  })

  it('loads the stored profile, previews it and links to its Renown page', () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    expect((screen.getByLabelText('Tagline') as HTMLInputElement).value).toBe('Notes for teams')
    expect((screen.getByLabelText('Category') as HTMLInputElement).value).toBe('Productivity')
    expect(screen.getByRole('link', { name: /View on Renown/ }).getAttribute('href')).toBe(
      `https://www.renown.id/app/${DID}`,
    )
    expect(screen.getByText('notes').tagName).toBe('STRONG')
    expect(saveButton().disabled).toBe(true)
  })

  it('saves only what changed', async () => {
    mutateAsync.mockResolvedValue(true)
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Shared notes' } })
    expect(screen.getByText('Unsaved changes')).toBeTruthy()
    fireEvent.click(saveButton())
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ tagline: 'Shared notes' }))
  })

  it('starts an empty profile from the app name', async () => {
    profile = { ...profile, data: null }
    mutateAsync.mockResolvedValue(true)
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Vault')
    fireEvent.click(saveButton())
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledWith({ name: 'Vault' }))
  })

  it('blocks saving an unsafe website and says why', () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'javascript:alert(1)' } })
    expect(screen.getByText('Use an http(s) URL.')).toBeTruthy()
    expect(saveButton().disabled).toBe(true)
  })

  it('shows a field error from the server next to the field', async () => {
    mutateAsync.mockRejectedValue(
      new PublisherApiError('INVALID_INPUT', 'Description must be at most 2000 characters', 200, 'description'),
    )
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'Shorter' } })
    fireEvent.click(saveButton())
    expect(await screen.findByText('Description must be at most 2000 characters')).toBeTruthy()
  })

  it('refuses an SVG before uploading anything', async () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    const svg = new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' })
    fireEvent.change(screen.getByLabelText('Upload logo'), { target: { files: [svg] } })
    expect(await screen.findByText('Choose a PNG, JPEG or WebP image.')).toBeTruthy()
  })

  it('adds, edits and removes links', async () => {
    mutateAsync.mockResolvedValue(true)
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.click(screen.getByRole('button', { name: 'Add link' }))
    fireEvent.change(screen.getByLabelText('Link 2 label'), { target: { value: 'Blog' } })
    fireEvent.change(screen.getByLabelText('Link 2 URL'), { target: { value: 'https://blog.example' } })
    fireEvent.click(screen.getByRole('button', { name: 'Move link 2 up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove link 2' }))
    fireEvent.click(saveButton())
    await waitFor(() =>
      expect(mutateAsync).toHaveBeenCalledWith({ links: [{ id: expect.any(String), label: 'Blog', url: 'https://blog.example' }] }),
    )
  })
})

describe('AppProfileTab hardening', () => {
  it('shows an error with Retry, not an editable form, when the read fails', () => {
    const refetch = vi.fn()
    profile = { data: null, isPending: false, error: new Error('boom'), refetch }
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    expect(screen.getByText('boom')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Save profile' })).toBeNull()
    expect(screen.queryByLabelText('Name')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Try again/ }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('keeps a dirty form when a background refresh fails', () => {
    profile = { data: STORED, isPending: false, error: new Error('x'), refetch: vi.fn() }
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Typed' } })
    expect((screen.getByLabelText('Tagline') as HTMLInputElement).value).toBe('Typed')
    expect(screen.getByText(/Couldn’t refresh/)).toBeTruthy()
  })

  it('links each field error through aria-describedby', () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.change(screen.getByLabelText('Website'), { target: { value: 'javascript:alert(1)' } })
    const website = screen.getByLabelText('Website')
    const id = website.getAttribute('aria-describedby')
    expect(id).toBe('profile-website-error')
    expect(document.getElementById(id as string)?.textContent).toBe('Use an http(s) URL.')
  })

  it('submits once even when Save is clicked twice', async () => {
    let release: (v: boolean) => void = () => {}
    mutateAsync.mockReturnValue(new Promise<boolean>((r) => (release = r)))
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Shared notes' } })
    fireEvent.click(saveButton())
    fireEvent.click(saveButton())
    expect(mutateAsync).toHaveBeenCalledTimes(1)
    release(true)
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1))
  })

  it('warns before leaving with unsaved changes', () => {
    render(<AppProfileTab appId="app-1" appName="Vault" appDid={DID} />)
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
    fireEvent.change(screen.getByLabelText('Tagline'), { target: { value: 'Shared notes' } })
    const dirty = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(dirty)
    expect(dirty.defaultPrevented).toBe(true)
  })
})

describe('AppProfileCard', () => {
  it('previews the profile with edit and Renown links', () => {
    const onEdit = vi.fn()
    render(<AppProfileCard appDid={DID} appName="Vault" onEdit={onEdit} />)
    expect(screen.getByRole('heading', { name: 'Vault' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Edit profile/ }))
    expect(onEdit).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('link', { name: /View on Renown/ }).getAttribute('href')).toBe(`https://www.renown.id/app/${DID}`)
  })

  it('invites setting up a missing profile, and renders nothing without an identity', () => {
    profile = { ...profile, data: null }
    render(<AppProfileCard appDid={DID} appName="Vault" onEdit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Set up profile' })).toBeTruthy()
    cleanup()
    expect(render(<AppProfileCard appDid={null} appName="Vault" />).container.innerHTML).toBe('')
  })
})
