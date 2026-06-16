'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { useCallback, useEffect, useRef, useState } from 'react'

import { describeDatabase, getAuthToken } from '../graphql'
import type { DatabaseSchema } from '../types'

type State = {
  schema: DatabaseSchema | null
  isLoading: boolean
  error: string | null
}

/**
 * Owner-gated describe of the env's Postgres. Fetches once on mount and on
 * `tenantId` change; no polling. `refresh()` re-fetches on demand. Mirrors
 * the renown-ref pattern from `use-environment-dumps.ts`.
 */
export function useDatabaseSchema(tenantId: string | null): {
  schema: DatabaseSchema | null
  isLoading: boolean
  error: string | null
  refresh: () => void
} {
  const renown = useRenown()
  const renownRef = useRef(renown)
  // eslint-disable-next-line react-hooks/refs
  renownRef.current = renown

  const [state, setState] = useState<State>({
    schema: null,
    isLoading: true,
    error: null,
  })

  const refetch = useCallback(async () => {
    if (!tenantId) {
      setState({ schema: null, isLoading: false, error: null })
      return
    }
    setState((s) => ({ ...s, isLoading: true, error: null }))
    try {
      const token = await getAuthToken(renownRef.current)
      const schema = await describeDatabase(tenantId, token)
      setState({ schema, isLoading: false, error: null })
    } catch (err) {
      setState({
        schema: null,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load schema',
      })
    }
  }, [tenantId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetch()
  }, [refetch])

  const refresh = useCallback(() => {
    void refetch()
  }, [refetch])

  return {
    schema: state.schema,
    isLoading: state.isLoading,
    error: state.error,
    refresh,
  }
}
