'use client'

import { useDid, useRenown } from '@powerhousedao/reactor-browser'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef } from 'react'

import { getAuthToken } from '@/modules/cloud/graphql'
import { useAuthedQuery } from '@/modules/cloud/query/use-authed-query'
import {
  confirmAppIdentity,
  connectGithubDeploy,
  createApp,
  deleteApp,
  fetchApp,
  fetchAppDeployments,
  fetchGithubDeployAppInfo,
  fetchGithubDeployRepositories,
  fetchMyApps,
  fetchMyGithubDeployInstallations,
  openAppSetupPullRequest,
  rollbackApp,
  updateApp,
  AppsApiError,
  isAppsError,
} from '../graphql'
import { activeAppIds, isAppEnvironment } from '../lib/split'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { appPollInterval, appsPollInterval, deploymentsPollInterval } from '../lib/status'
import type {
  App,
  AppDeployment,
  CreateAppInput,
  GithubDeployAppInfo,
  GithubDeployInstallation,
  GithubRepo,
  UpdateAppInput,
} from '../types'
import { waitForToken } from '../lib/token'
import { appsKeys } from './keys'

/** Don't hammer a switchboard that lacks the subgraph or rejects the caller. */
export function retryUnlessFinal(failureCount: number, error: Error): boolean {
  if (
    error instanceof AppsApiError &&
    error.code !== 'NETWORK' &&
    error.code !== 'UNKNOWN' &&
    // Right after a GitHub/Renown redirect the session can't mint a token yet.
    error.code !== 'UNAUTHENTICATED'
  ) {
    return false
  }
  return failureCount < 2
}

/** Resolve the caller's Renown bearer inside mutations (ref keeps identity churn out of deps). */
function useTokenResolver(): () => Promise<string | null> {
  const renown = useRenown()
  const ref = useRef(renown)
  // eslint-disable-next-line react-hooks/refs
  ref.current = renown
  return useCallback(() => waitForToken(() => getAuthToken(ref.current)), [])
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useMyApps() {
  const did = useDid()
  return useAuthedQuery<App[]>(appsKeys.list(did), (token) => fetchMyApps(token), {
    retry: retryUnlessFinal,
    refetchInterval: (query) => appsPollInterval(query.state.data),
  })
}

/**
 * Live App ids for splitting env lists, plus a ready-made standalone predicate.
 * No apps subgraph on the server → every env is standalone; app list still
 * loading or failing → fall back to `appId` presence.
 */
export function useStandaloneEnvFilter() {
  const { data, error } = useMyApps()
  const unavailable = isAppsError(error, 'APPS_UNAVAILABLE')
  return useMemo(() => {
    const appIds = unavailable ? new Set<string>() : activeAppIds(data)
    return {
      appIds,
      isStandalone: (env: Pick<CloudEnvironment, 'app'>) => !isAppEnvironment(env, appIds),
    }
  }, [data, unavailable])
}

export function useApp(id: string) {
  const did = useDid()
  return useAuthedQuery<App | null>(appsKeys.detail(id, did), (token) => fetchApp(id, token), {
    retry: retryUnlessFinal,
    refetchInterval: (query) => appPollInterval(query.state.data),
  })
}

/** Deployment history; polls every few seconds while any row is PENDING/DEPLOYING. */
export function useAppDeployments(appId: string, limit = 50) {
  const did = useDid()
  return useAuthedQuery<AppDeployment[]>(
    appsKeys.deployments(appId, did),
    (token) => fetchAppDeployments(appId, limit, token),
    {
      retry: retryUnlessFinal,
      refetchInterval: (query) => deploymentsPollInterval(query.state.data),
    },
  )
}

export function useGithubDeployAppInfo() {
  return useAuthedQuery<GithubDeployAppInfo>(
    appsKeys.githubInfo(),
    (token) => fetchGithubDeployAppInfo(token),
    { retry: retryUnlessFinal, staleTime: 60 * 60 * 1000 },
  )
}

export function useMyGithubDeployInstallations() {
  const did = useDid()
  return useAuthedQuery<GithubDeployInstallation[]>(
    appsKeys.installations(did),
    (token) => fetchMyGithubDeployInstallations(token),
    { retry: retryUnlessFinal },
  )
}

export function useGithubDeployRepositories(installationId: string | null) {
  const did = useDid()
  return useAuthedQuery<GithubRepo[]>(
    appsKeys.repositories(installationId ?? '', did),
    (token) => fetchGithubDeployRepositories(installationId ?? '', token),
    { retry: retryUnlessFinal, enabled: !!installationId, staleTime: 60 * 1000 },
  )
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** Write a fresh App into the list + detail caches so pages update without a refetch. */
function useCacheApp() {
  const qc = useQueryClient()
  const did = useDid()
  return useCallback(
    (app: App) => {
      qc.setQueryData(appsKeys.detail(app.id, did), app)
      qc.setQueryData<App[]>(appsKeys.list(did), (old) =>
        old ? [app, ...old.filter((a) => a.id !== app.id)] : old,
      )
    },
    [qc, did],
  )
}

export function useConnectGithubDeploy() {
  const qc = useQueryClient()
  const did = useDid()
  const token = useTokenResolver()
  return useMutation({
    mutationFn: async (code: string) => connectGithubDeploy(code, await token()),
    onSuccess: (installations) => {
      qc.setQueryData(appsKeys.installations(did), installations)
    },
  })
}

export function useCreateApp() {
  const qc = useQueryClient()
  const token = useTokenResolver()
  const cacheApp = useCacheApp()
  return useMutation({
    mutationFn: async (input: CreateAppInput) => createApp(input, await token()),
    onSuccess: (app) => {
      cacheApp(app)
      // The new production env shows up on the env lists via its own query.
      void qc.invalidateQueries({ queryKey: ['environments'] })
    },
  })
}

export function useConfirmAppIdentity() {
  const token = useTokenResolver()
  const cacheApp = useCacheApp()
  return useMutation({
    mutationFn: async (appId: string) => confirmAppIdentity(appId, await token()),
    onSuccess: cacheApp,
  })
}

export function useUpdateApp(appId: string) {
  const token = useTokenResolver()
  const cacheApp = useCacheApp()
  return useMutation({
    mutationFn: async (input: UpdateAppInput) => updateApp(appId, input, await token()),
    onSuccess: cacheApp,
  })
}

export function useDeleteApp() {
  const qc = useQueryClient()
  const did = useDid()
  const token = useTokenResolver()
  return useMutation({
    mutationFn: async (vars: { appId: string; deleteEnvironments: boolean }) =>
      deleteApp(vars.appId, vars.deleteEnvironments, await token()),
    onSuccess: (_ok, vars) => {
      qc.setQueryData<App[]>(appsKeys.list(did), (old) => old?.filter((a) => a.id !== vars.appId))
      qc.removeQueries({ queryKey: appsKeys.detail(vars.appId, did) })
      void qc.invalidateQueries({ queryKey: ['environments'] })
    },
  })
}

export function useOpenSetupPullRequest(appId: string) {
  const token = useTokenResolver()
  return useMutation({
    mutationFn: async () => openAppSetupPullRequest(appId, await token()),
  })
}

export function useRollbackApp(appId: string) {
  const qc = useQueryClient()
  const did = useDid()
  const token = useTokenResolver()
  return useMutation({
    mutationFn: async (deploymentId: string) => rollbackApp(deploymentId, await token()),
    onSuccess: (deployment) => {
      qc.setQueryData<AppDeployment[]>(appsKeys.deployments(appId, did), (old) =>
        old ? [deployment, ...old.filter((d) => d.id !== deployment.id)] : old,
      )
      void qc.invalidateQueries({ queryKey: appsKeys.detail(appId, did) })
      void qc.invalidateQueries({ queryKey: appsKeys.list(did) })
    },
  })
}
