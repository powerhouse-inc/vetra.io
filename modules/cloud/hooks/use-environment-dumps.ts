'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  cancelEnvironmentDump,
  fetchEnvironmentDumps,
  fetchEnvironmentRestores,
  getAuthToken,
  requestEnvironmentDump,
  restoreEnvironmentDump,
} from '../graphql'
import type {
  DatabaseDump,
  DatabaseDumpStatus,
  DatabaseRestore,
  DatabaseRestoreStatus,
} from '../types'

const POLL_INTERVAL_MS = 5000
const IN_FLIGHT: ReadonlySet<DatabaseDumpStatus> = new Set(['PENDING', 'RUNNING'])
const RESTORE_DONE: ReadonlySet<DatabaseRestoreStatus> = new Set(['SUCCEEDED', 'FAILED'])

type State = {
  dumps: DatabaseDump[]
  restores: DatabaseRestore[]
  isLoading: boolean
  error: string | null
}

/**
 * Owner-gated query for the env's dump and restore history. Polls every 5s
 * while any dump is PENDING/RUNNING or a restore is active; otherwise idle. The presigned URL on
 * each ready dump is minted server-side at query time, so re-fetching
 * always returns a fresh URL with 15-min validity.
 */
export function useEnvironmentDumps(tenantId: string | null) {
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown

  const [state, setState] = useState<State>({
    dumps: [],
    restores: [],
    isLoading: true,
    error: null,
  })
  const [isRequesting, setIsRequesting] = useState(false)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [isStartingRestore, setIsStartingRestore] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refetch = useCallback(async () => {
    if (!tenantId) return
    try {
      const token = await getAuthToken(renownRef.current)
      const [dumps, restores] = await Promise.all([
        fetchEnvironmentDumps(tenantId, token),
        fetchEnvironmentRestores(tenantId, token),
      ])
      setState({ dumps, restores, isLoading: false, error: null })
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load dumps',
      }))
    }
  }, [tenantId])

  useEffect(() => {
    if (!tenantId) return
    void refetch()
  }, [tenantId, refetch])

  useEffect(() => {
    const hasInFlight =
      state.dumps.some((d) => IN_FLIGHT.has(d.status)) ||
      state.restores.some((r) => !RESTORE_DONE.has(r.status))
    if (hasInFlight && !pollRef.current) {
      pollRef.current = setInterval(() => void refetch(), POLL_INTERVAL_MS)
    } else if (!hasInFlight && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [state.dumps, state.restores, refetch])

  const request = useCallback(async () => {
    if (!tenantId) return
    setIsRequesting(true)
    try {
      const token = await getAuthToken(renownRef.current)
      await requestEnvironmentDump(tenantId, token)
      await refetch()
    } finally {
      setIsRequesting(false)
    }
  }, [tenantId, refetch])

  const cancel = useCallback(
    async (dumpId: string) => {
      setCancellingId(dumpId)
      try {
        const token = await getAuthToken(renownRef.current)
        await cancelEnvironmentDump(dumpId, token)
        await refetch()
      } finally {
        setCancellingId(null)
      }
    },
    [refetch],
  )

  const restore = useCallback(
    async (dumpId: string) => {
      setIsStartingRestore(true)
      try {
        const token = await getAuthToken(renownRef.current)
        await restoreEnvironmentDump(dumpId, token)
        await refetch()
      } finally {
        setIsStartingRestore(false)
      }
    },
    [refetch],
  )

  const activeRestore = state.restores.find((r) => !RESTORE_DONE.has(r.status)) ?? null

  return {
    dumps: state.dumps,
    isLoading: state.isLoading,
    error: state.error,
    isRequesting,
    cancellingId,
    restores: state.restores,
    activeRestore,
    isStartingRestore,
    request,
    cancel,
    restore,
    refetch,
  }
}
