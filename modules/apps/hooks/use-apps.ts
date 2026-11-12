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
  createAppPlan,
  createStudioApp,
  deleteApp,
  deleteAppSetting,
  fetchApp,
  fetchAppRecord,
  fetchAppDeployments,
  fetchAppInstances,
  fetchAppPlans,
  fetchAppReleases,
  fetchAppSettings,
  fetchGithubDeployAppInfo,
  fetchGithubDeployRepositories,
  fetchMyApps,
  fetchMyGithubDeployInstallations,
  fetchMyInstances,
  openAppSetupPullRequest,
  retireAppPlan,
  rollbackApp,
  setAppPlanTarget,
  setAppSetting,
  updateApp,
  updateAppPlan,
  AppsApiError,
  isAppsError,
} from '../graphql'
import { mergeAppSetting, settingsPending, withoutAppSetting } from '../lib/settings'
import { activeAppIds, isAppEnvironment } from '../lib/split'
import type { CloudEnvironment } from '@/modules/cloud/types'
import { appPollInterval, appsPollInterval, deploymentsPollInterval } from '../lib/status'
import type {
  App,
  AppDeployment,
  AppInstance,
  AppPlan,
  AppRelease,
  AppReleaseKind,
  AppSettingScope,
  AppSettings,
  CreateAppInput,
  CreateAppPlanInput,
  CreateStudioAppInput,
  GithubDeployAppInfo,
  GithubDeployInstallation,
  GithubRepo,
  HolderInstance,
  SetAppSettingInput,
  UpdateAppInput,
  UpdateAppPlanInput,
} from '../types'
import { useActiveOrg } from '@/modules/orgs/hooks/use-orgs'
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
  const { orgId } = useActiveOrg()
  return useAuthedQuery<App[]>(
    appsKeys.list(did, orgId),
    (token) => fetchMyApps(token, undefined, orgId),
    {
      retry: retryUnlessFinal,
      refetchInterval: (query) => appsPollInterval(query.state.data),
    },
  )
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

/** The apps record behind a licensing-only app (null for Vetra Studio): it can be deleted. */
export function useAppRecord(id: string) {
  const did = useDid()
  return useAuthedQuery<{ id: string; status: string } | null>(
    appsKeys.record(id, did),
    (token) => fetchAppRecord(id, token),
    { retry: retryUnlessFinal },
  )
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

/** Releases and builds vetra-publish recorded, newest first; `kind` null for both. */
export function useAppReleases(
  appId: string,
  kind: AppReleaseKind | null,
  limit: number,
  enabled = true,
) {
  const did = useDid()
  return useAuthedQuery<AppRelease[]>(
    appsKeys.releases(appId, kind, limit, did),
    (token) => fetchAppReleases(appId, kind, limit, token),
    {
      enabled,
      retry: retryUnlessFinal,
      // "Show more" keeps the rows on screen while the longer page loads; a new filter does not.
      placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[3] === kind ? prev : undefined),
    },
  )
}

/**
 * Poll interval for instances: every 10 s while any is pending/updating, or still has to pick up
 * a settings change (until the reconciler starts rolling it), else off.
 */
export function instancesPollInterval(data: AppInstance[] | undefined): number | false {
  return data?.some(
    (i) =>
      i.status === 'pending' ||
      i.status === 'updating' ||
      (settingsPending(i) && i.status !== 'failed' && i.status !== 'stopped'),
  )
    ? 10_000
    : false
}

/** The app's branch instances; polls while any is rolling out. */
export function useAppInstances(appId: string, enabled = true) {
  const did = useDid()
  return useAuthedQuery<AppInstance[]>(
    appsKeys.instances(appId, did),
    (token) => fetchAppInstances(appId, token),
    {
      enabled,
      retry: retryUnlessFinal,
      refetchInterval: (query) => instancesPollInterval(query.state.data),
    },
  )
}

/** The App's plans (licensing terms it runs instances for). */
export function useAppPlans(appId: string, enabled = true) {
  const did = useDid()
  return useAuthedQuery<AppPlan[]>(
    appsKeys.plans(appId, did),
    (token) => fetchAppPlans(appId, token),
    { enabled, retry: retryUnlessFinal },
  )
}

/** Poll every 10 s while any of the caller's instances is starting or rolling. */
export function myInstancesPollInterval(data: HolderInstance[] | undefined): number | false {
  return data?.some((i) => i.status === 'pending' || i.status === 'updating') ? 10_000 : false
}

/** The instances of the plans the caller holds licences of. */
export function useMyInstances() {
  const did = useDid()
  return useAuthedQuery<HolderInstance[]>(
    appsKeys.myInstances(did),
    (token) => fetchMyInstances(token),
    {
      enabled: !!did,
      retry: retryUnlessFinal,
      refetchInterval: (query) => myInstancesPollInterval(query.state.data),
    },
  )
}

/** The App's publisher settings and Vetra's own (owners and operators; FORBIDDEN otherwise). */
export function useAppSettings(appId: string, enabled = true) {
  const did = useDid()
  return useAuthedQuery<AppSettings>(
    appsKeys.settings(appId, did),
    (token) => fetchAppSettings(appId, token),
    { enabled, retry: retryUnlessFinal },
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
      qc.setQueryData<App[]>(appsKeys.list(did, app.ownerOrgId ?? null), (old) =>
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

export function useCreateStudioApp() {
  const qc = useQueryClient()
  const token = useTokenResolver()
  const cacheApp = useCacheApp()
  return useMutation({
    mutationFn: async (input: CreateStudioAppInput) => createStudioApp(input, await token()),
    onSuccess: (app) => {
      cacheApp(app)
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
      qc.setQueriesData<App[]>({ queryKey: ['apps', 'list'] }, (old) =>
        old?.filter((a) => a.id !== vars.appId),
      )
      qc.removeQueries({ queryKey: appsKeys.detail(vars.appId, did) })
      qc.removeQueries({ queryKey: appsKeys.record(vars.appId, did) })
      // A licensing-only app is listed from the publisher's apps; it is DELETED there now.
      void qc.invalidateQueries({ queryKey: ['publisher', 'apps'] })
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

/** Sets or replaces a setting; the instances pick up a new settings revision. */
export function useSetAppSetting(appId: string) {
  const qc = useQueryClient()
  const did = useDid()
  const token = useTokenResolver()
  return useMutation({
    mutationFn: async (input: Omit<SetAppSettingInput, 'appId'>) =>
      setAppSetting({ ...input, appId }, await token()),
    onSuccess: (setting) => {
      qc.setQueryData<AppSettings>(appsKeys.settings(appId, did), (old) =>
        mergeAppSetting(old, setting),
      )
      void qc.invalidateQueries({ queryKey: appsKeys.settings(appId, did) })
      void qc.invalidateQueries({ queryKey: appsKeys.instances(appId, did) })
    },
  })
}

export function useDeleteAppSetting(appId: string) {
  const qc = useQueryClient()
  const did = useDid()
  const token = useTokenResolver()
  return useMutation({
    mutationFn: async (vars: { name: string; scope: AppSettingScope }) =>
      deleteAppSetting(appId, vars.name, vars.scope, await token()),
    onSuccess: (_deleted, vars) => {
      qc.setQueryData<AppSettings>(appsKeys.settings(appId, did), (old) =>
        withoutAppSetting(old, vars.name, vars.scope),
      )
      void qc.invalidateQueries({ queryKey: appsKeys.settings(appId, did) })
      void qc.invalidateQueries({ queryKey: appsKeys.instances(appId, did) })
    },
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
      void qc.invalidateQueries({ queryKey: ['apps', 'list'] })
    },
  })
}

/** Writes a fresh plan into the App's plan list, then refreshes plans and instances. */
function useCachePlan(appId: string) {
  const qc = useQueryClient()
  const did = useDid()
  return useCallback(
    (plan: AppPlan) => {
      qc.setQueryData<AppPlan[]>(appsKeys.plans(appId, did), (old) =>
        old ? [...old.filter((p) => p.id !== plan.id), plan] : [plan],
      )
      void qc.invalidateQueries({ queryKey: appsKeys.plans(appId, did) })
      void qc.invalidateQueries({ queryKey: appsKeys.instances(appId, did) })
    },
    [qc, did, appId],
  )
}

/** Adopts a licensing term as a plan; the server words its refusals. */
export function useCreateAppPlan(appId: string) {
  const token = useTokenResolver()
  const cachePlan = useCachePlan(appId)
  return useMutation({
    mutationFn: async (input: Omit<CreateAppPlanInput, 'appId'>) =>
      createAppPlan({ ...input, appId }, await token()),
    onSuccess: cachePlan,
  })
}

export function useUpdateAppPlan(appId: string) {
  const token = useTokenResolver()
  const cachePlan = useCachePlan(appId)
  return useMutation({
    mutationFn: async (input: UpdateAppPlanInput) => updateAppPlan(input, await token()),
    onSuccess: cachePlan,
  })
}

export function useSetAppPlanTarget(appId: string) {
  const token = useTokenResolver()
  const cachePlan = useCachePlan(appId)
  return useMutation({
    mutationFn: async (vars: { planId: string; version: string }) =>
      setAppPlanTarget(vars.planId, vars.version, await token()),
    onSuccess: cachePlan,
  })
}

export function useRetireAppPlan(appId: string) {
  const token = useTokenResolver()
  const cachePlan = useCachePlan(appId)
  return useMutation({
    mutationFn: async (planId: string) => retireAppPlan(planId, await token()),
    onSuccess: cachePlan,
  })
}
