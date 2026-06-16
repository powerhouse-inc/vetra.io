'use client'

import { useRenown } from '@powerhousedao/reactor-browser'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  deleteTenantEnvVar,
  deleteTenantSecret,
  fetchTenantEnvVars,
  fetchTenantSecrets,
  getAuthToken,
  setTenantEnvVar,
  setTenantSecret,
  type TenantEnvVar,
  type TenantSecretEntry,
} from '../graphql'

export type TenantConfig = {
  envVars: TenantEnvVar[]
  secrets: TenantSecretEntry[]
}

export function useTenantConfig(tenantId: string | null) {
  const renown = useRenown()
  const renownRef = useRef(renown)
  useLayoutEffect(() => {
    renownRef.current = renown
  })
  const [envVars, setEnvVars] = useState<TenantEnvVar[]>([])
  const [secrets, setSecrets] = useState<TenantSecretEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setEnvVars([])
      setSecrets([])
      return
    }
    setIsLoading(true)
    try {
      const token = await getAuthToken(renownRef.current)
      const [v, s] = await Promise.all([
        fetchTenantEnvVars(tenantId, token),
        fetchTenantSecrets(tenantId, token),
      ])
      setEnvVars(v)
      setSecrets(s)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load config'))
    } finally {
      setIsLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  const setVar = useCallback(
    async (key: string, value: string) => {
      if (!tenantId) throw new Error('Missing tenantId')
      const token = await getAuthToken(renownRef.current)
      await setTenantEnvVar(tenantId, key, value, token)
      await refresh()
    },
    [tenantId, refresh],
  )

  const setSecret = useCallback(
    async (key: string, value: string) => {
      if (!tenantId) throw new Error('Missing tenantId')
      const token = await getAuthToken(renownRef.current)
      await setTenantSecret(tenantId, key, value, token)
      await refresh()
    },
    [tenantId, refresh],
  )

  const deleteVar = useCallback(
    async (key: string) => {
      if (!tenantId) throw new Error('Missing tenantId')
      const token = await getAuthToken(renownRef.current)
      await deleteTenantEnvVar(tenantId, key, token)
      await refresh()
    },
    [tenantId, refresh],
  )

  const deleteSecret = useCallback(
    async (key: string) => {
      if (!tenantId) throw new Error('Missing tenantId')
      const token = await getAuthToken(renownRef.current)
      await deleteTenantSecret(tenantId, key, token)
      await refresh()
    },
    [tenantId, refresh],
  )

  return {
    envVars,
    secrets,
    isLoading,
    error,
    refresh,
    setVar,
    setSecret,
    deleteVar,
    deleteSecret,
  }
}
