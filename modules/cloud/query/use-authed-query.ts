'use client'

import { useRef } from 'react'
import { useRenown } from '@powerhousedao/reactor-browser'
import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query'
import { getAuthToken } from '../graphql'

/**
 * `useQuery` wrapper that injects the Renown bearer token into the fetcher.
 *
 * Every cloud read goes through an auth-gated GraphQL fetcher that takes a
 * token; this centralizes "resolve the current token, then call the fetcher"
 * so individual hooks stay declarative. The `renown` instance is read through a
 * ref so its frequent object churn (a new identity object on every "user"
 * event) never re-creates the query function or triggers refetch storms.
 */
export function useAuthedQuery<T>(
  queryKey: readonly unknown[],
  fetcher: (token: string | null) => Promise<T>,
  options?: Omit<UseQueryOptions<T, Error, T, readonly unknown[]>, 'queryKey' | 'queryFn'>,
): UseQueryResult<T, Error> {
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown

  return useQuery<T, Error, T, readonly unknown[]>({
    queryKey,
    queryFn: async () => {
      const token = await getAuthToken(renownRef.current)
      return fetcher(token)
    },
    ...options,
  })
}
