import { describe, expect, it } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useOptimisticMutation } from '@/modules/cloud/query/use-optimistic-mutation'

type Item = { id: string; name: string }

function setup() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const KEY = ['items', 'mine'] as const
  qc.setQueryData(KEY, [{ id: 'a', name: 'A' }] as Item[])
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  return { qc, KEY, wrapper }
}

describe('useOptimisticMutation', () => {
  it('writes the optimistic value immediately, before the mutation resolves', async () => {
    const { qc, KEY, wrapper } = setup()
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Item, Item>({
          mutationFn: async (v) => {
            await gate
            return v
          },
          affectedKeys: () => [KEY],
          optimisticUpdate: (client, v) =>
            client.setQueryData(KEY, (old: Item[] = []) => [...old, v]),
        }),
      { wrapper },
    )

    result.current.mutate({ id: 'b', name: 'B' })

    // Optimistic write is visible synchronously after onMutate runs.
    await waitFor(() => expect((qc.getQueryData(KEY) as Item[]).map((i) => i.id)).toEqual(['a', 'b']))

    release()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })

  it('rolls back to the snapshot when the mutation fails', async () => {
    const { qc, KEY, wrapper } = setup()

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Item, Item>({
          mutationFn: async () => {
            throw new Error('boom')
          },
          affectedKeys: () => [KEY],
          optimisticUpdate: (client, v) =>
            client.setQueryData(KEY, (old: Item[] = []) => [...old, v]),
        }),
      { wrapper },
    )

    result.current.mutate({ id: 'b', name: 'B' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    // Snapshot restored — the optimistic 'b' is gone.
    expect((qc.getQueryData(KEY) as Item[]).map((i) => i.id)).toEqual(['a'])
  })
})
