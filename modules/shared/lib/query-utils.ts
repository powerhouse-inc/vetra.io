/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  QueryClient,
  type QueryKey,
  type UseQueryOptions,
  type UseQueryResult,
} from '@tanstack/react-query'

type Exact<T extends Record<string, unknown>> = {
  [K in keyof T]: T[K]
}

interface QueryWithKey<TData = any, TVariables = any> {
  (
    variables?: TVariables,
    options?: Omit<UseQueryOptions<TData, unknown, TData>, 'queryKey'> & {
      queryKey?: UseQueryOptions<TData, unknown, TData>['queryKey']
    },
  ): UseQueryResult<TData, unknown>
  getKey: (variables?: any) => QueryKey
  fetcher: (variables?: any, options?: any) => () => Promise<TData>
}

type QueryParams<TQuery extends QueryWithKey> = Parameters<TQuery>[0]

const hasVariablesTypeGuard = <TQuery extends QueryWithKey>(
  variables?: ServerPreFetchOptions<TQuery>,
): variables is {
  variables: QueryParams<TQuery>[0]
  next?: NextFetchRequestConfig
} => !!Object.keys(variables || {}).length

type ServerPreFetchOptions<TQuery extends QueryWithKey> = Parameters<TQuery>[0] extends
  Exact<Record<string, never>> | undefined
  ? { next?: NextFetchRequestConfig; cache?: RequestCache }
  : {
      variables?: Parameters<TQuery>[0]
      next?: NextFetchRequestConfig
      cache?: RequestCache
    }

type FetcherReturnValue<TQuery extends QueryWithKey> = Awaited<
  ReturnType<ReturnType<TQuery['fetcher']>>
>

export const serverFetch = async <TQuery extends QueryWithKey>(
  useQuery: TQuery,
  queryOptions?: ServerPreFetchOptions<TQuery>,
) => {
  const hasVariables = hasVariablesTypeGuard<TQuery>(queryOptions)
  let variables: QueryParams<TQuery> | undefined
  if (hasVariables) {
    variables = queryOptions.variables
  }
  const queryClient = new QueryClient()
  const data = await queryClient.fetchQuery<FetcherReturnValue<TQuery>, QueryParams<TQuery>>({
    queryKey: useQuery.getKey(variables),
    queryFn: useQuery.fetcher(variables, {
      next: queryOptions?.next,
      cache: queryOptions?.cache,
    }),
  })
  return data
}
