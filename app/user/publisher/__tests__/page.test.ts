import { describe, it, expect, vi, beforeEach } from 'vitest'

const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`)
})
vi.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))

import PublisherRedirect from '../page'

describe('/user/publisher', () => {
  beforeEach(() => {
    redirect.mockClear()
  })

  it('sends a bare visit to the apps home', async () => {
    await expect(PublisherRedirect({ searchParams: Promise.resolve({}) })).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/user')
  })

  it('sends ?app=<id> to that app’s Plans tab', async () => {
    await expect(
      PublisherRedirect({ searchParams: Promise.resolve({ app: 'app 1' }) }),
    ).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/user/apps/app%201?tab=plans')
  })

  it('uses the first value when app is repeated', async () => {
    await expect(
      PublisherRedirect({ searchParams: Promise.resolve({ app: ['a1', 'a2'] }) }),
    ).rejects.toThrow()
    expect(redirect).toHaveBeenCalledWith('/user/apps/a1?tab=plans')
  })
})
