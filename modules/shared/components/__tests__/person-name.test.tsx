import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const FRANK = '0x2bbea0145d6fb9c6709a74c1179ca0be71bb3ac6'
const NOBODY = '0x0000000000000000000000000000000000000001'
const ENS_ONLY = '0x00000000000000000000000000000000000000e5'

vi.mock('@/modules/shared/lib/renown-person', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/shared/lib/renown-person')>()),
  fetchRenownPerson: (address: string) =>
    Promise.resolve(
      address === FRANK
        ? {
            ethAddress: FRANK,
            displayName: 'Frank',
            handle: 'frank',
            username: '0x2BbE...3aC6',
            documentId: 'doc-frank',
            avatar: `attachment://v1:${'b'.repeat(64)}`,
            userImage: null,
          }
        : null,
    ),
}))
vi.mock('@/modules/cloud/hooks/use-ens-name', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/cloud/hooks/use-ens-name')>()),
  useEnsName: (address: string | null | undefined) => (address === ENS_ONLY ? 'vitalik.eth' : null),
}))

import { PersonName } from '../person-name'

function renderWithQuery(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

describe('PersonName', () => {
  it('shows the Renown display name for an address or a did:pkh, with the address as a tooltip', async () => {
    renderWithQuery(<PersonName value={`did:pkh:eip155:137:${FRANK}`} />)
    const el = await screen.findByText('Frank')
    expect(el.getAttribute('title')).toBe(FRANK)
  })

  it('falls back to the ENS name, then the short address', async () => {
    renderWithQuery(
      <>
        <PersonName value={ENS_ONLY} />
        <PersonName value={NOBODY} />
      </>,
    )
    expect(await screen.findByText('vitalik.eth')).toBeTruthy()
    expect(screen.getByText('0x0000…0001')).toBeTruthy()
  })

  it('renders anything that is not an address as given', () => {
    renderWithQuery(<PersonName value="did:key:z6Mkabc" />)
    expect(screen.getByText('did:key:z6Mkabc')).toBeTruthy()
  })

  it("shows the Renown avatar beside the name when asked, else renown.id's generated one", async () => {
    renderWithQuery(
      <>
        <PersonName value={FRANK} avatar />
        <PersonName value={NOBODY} avatar />
      </>,
    )
    const img = await screen.findByRole('img', { name: 'Frank' })
    expect(img.getAttribute('src')).toMatch(/\/media\/doc-frank\/avatar\?v=bbbbbbbbbbbb$/)
    // Without a picture: the avatar renown.id generates from the address, as on their profile.
    expect(screen.getByRole('img', { name: 'Generated avatar' })).toBeTruthy()
  })

  it('shows no picture unless asked (names inside sentences)', async () => {
    renderWithQuery(<PersonName value={FRANK} />)
    await screen.findByText('Frank')
    expect(screen.queryByRole('img')).toBeNull()
  })
})
