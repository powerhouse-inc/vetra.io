'use client'

import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query'

export type OptimisticMutationOptions<TVars, TData> = {
  mutationFn: (vars: TVars) => Promise<TData>
  /**
   * Exact query keys this mutation affects. Each is cancelled + snapshotted
   * before the optimistic write, rolled back on error, and invalidated once
   * the mutation settles (so server truth reconciles the optimistic guess).
   */
  affectedKeys: (vars: TVars) => readonly (readonly unknown[])[]
  /**
   * Imperative optimistic cache write, run after snapshotting. Use
   * `qc.setQueryData(key, updater)` to reflect the user's intent instantly.
   */
  optimisticUpdate?: (qc: QueryClient, vars: TVars) => void
  onError?: (error: Error, vars: TVars) => void
  onSuccess?: (data: TData, vars: TVars) => void
}

type Ctx = { snapshots: [readonly unknown[], unknown][] }

/**
 * One optimistic-mutation recipe for the whole app: snapshot → optimistic
 * write → rollback-on-error → invalidate-on-settle. Every write that touches a
 * cached list/entity uses this so they all feel instant and behave identically.
 */
export function useOptimisticMutation<TVars, TData>(
  opts: OptimisticMutationOptions<TVars, TData>,
): UseMutationResult<TData, Error, TVars, Ctx> {
  const queryClient = useQueryClient()

  return useMutation<TData, Error, TVars, Ctx>({
    mutationFn: opts.mutationFn,
    onMutate: async (vars) => {
      const keys = opts.affectedKeys(vars)
      const snapshots: [readonly unknown[], unknown][] = []
      for (const key of keys) {
        await queryClient.cancelQueries({ queryKey: key })
        snapshots.push([key, queryClient.getQueryData(key)])
      }
      opts.optimisticUpdate?.(queryClient, vars)
      return { snapshots }
    },
    onError: (error, vars, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
      opts.onError?.(error, vars)
    },
    onSuccess: (data, vars) => opts.onSuccess?.(data, vars),
    onSettled: (_data, _error, vars) => {
      for (const key of opts.affectedKeys(vars)) {
        void queryClient.invalidateQueries({ queryKey: key })
      }
    },
  })
}
