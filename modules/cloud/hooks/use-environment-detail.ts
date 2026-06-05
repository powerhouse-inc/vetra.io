'use client'

/**
 * Backwards-compatible API for the environment detail page.
 *
 * Internally backed by `RemoteDocumentController` (signed actions via Renown).
 * Reads:
 *   - When the user is logged in, state comes from the controller and updates
 *     reactively via its `onChange` event.
 *   - When the user is NOT logged in, state falls back to a plain GraphQL
 *     fetch (so the page is still viewable in read-only mode).
 * Mutations:
 *   - Always go through the controller. Throw a clear error if the user has
 *     no signer (login required).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchEnvironment,
  getAuthToken,
  rollbackEnvironmentRelease,
  setCustomDomainMutation,
  updateEnvironmentToLatest,
} from '../graphql'
import type {
  AutoUpdateChannel,
  BackupCadence,
  CloudEnvironment,
  CloudEnvironmentServiceType,
  CloudResourceSize,
  CloudServiceClintConfig,
  TenantService,
} from '../types'
import { useDocumentSubscription } from './use-document-subscription'
import { useEnvironmentController } from './use-environment-controller'
import { useCanSign } from './use-can-sign'
import { useRenown } from '@powerhousedao/reactor-browser'

const NOT_LOGGED_IN_ERROR = 'You must be logged in with Renown to perform this action'

/**
 * Construct a CloudEnvironment from controller state + optional metadata
 * snapshot. Controller drives reactive state; metadata (timestamps, revision,
 * documentType) isn't exposed by the controller so we borrow it from the
 * metadata fetch. When metadata isn't available yet (first render before
 * the fetch returns) we fall back to sensible placeholders so the page
 * can render.
 */
function projectFromController(
  documentId: string,
  state: unknown,
  metadata: CloudEnvironment | null,
): CloudEnvironment {
  const s = state as CloudEnvironment['state']
  return {
    id: documentId,
    name: s?.label ?? metadata?.name ?? documentId,
    documentType: metadata?.documentType ?? 'powerhouse/vetra-cloud-environment',
    createdAtUtcIso: metadata?.createdAtUtcIso ?? '',
    lastModifiedAtUtcIso: metadata?.lastModifiedAtUtcIso ?? '',
    revision: metadata?.revision ?? 0,
    state: s,
  }
}

export function useEnvironmentDetail(documentId: string) {
  const renown = useRenown()
  const renownRef = useRef(renown)
  renownRef.current = renown
  const { canSign } = useCanSign()

  const ctrlResult = useEnvironmentController(canSign ? documentId : null)
  const { controller, state: ctrlState, isLoading: ctrlLoading, error: ctrlError } = ctrlResult

  // Doubles as the read-only fallback for unauthenticated viewers AND as
  // the source of metadata (createdAt, lastModifiedAt, revision,
  // documentType) for signed-in users — the controller exposes reactive
  // state but not the document header.
  const [fallbackEnv, setFallbackEnv] = useState<CloudEnvironment | null>(null)
  const [fallbackLoading, setFallbackLoading] = useState<boolean>(true)
  const [fallbackError, setFallbackError] = useState<Error | null>(null)
  const fallbackRef = useRef<CloudEnvironment | null>(null)
  fallbackRef.current = fallbackEnv

  const refetchFallback = useCallback(async () => {
    try {
      if (!fallbackRef.current) setFallbackLoading(true)
      const token = await getAuthToken(renownRef.current as never)
      const env = await fetchEnvironment(documentId, token)
      if (env) {
        const prev = fallbackRef.current
        if (
          !prev ||
          prev.revision !== env.revision ||
          prev.state.status !== env.state.status ||
          prev.lastModifiedAtUtcIso !== env.lastModifiedAtUtcIso
        ) {
          setFallbackEnv(env)
        }
      }
    } catch (err) {
      setFallbackError(err instanceof Error ? err : new Error('Failed to load'))
    } finally {
      setFallbackLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    void refetchFallback()
  }, [refetchFallback])

  // Subscribe to remote document changes in both paths. The controller does
  // NOT poll/subscribe on its own — without this, a signed-in user never
  // sees server-side state transitions (status flipping READY→DEPLOYING etc.)
  // until they refresh the page.
  const controllerRef = useRef(controller)
  controllerRef.current = controller

  useDocumentSubscription(documentId, () => {
    if (canSign && controllerRef.current) {
      void controllerRef.current.pull()
    }
    // Refetch metadata regardless of auth — timestamps and revision bump on
    // any remote change, and the signed-in path uses these for display.
    void refetchFallback()
  })

  // Polling fallback for read-only path (WS requires auth; unauth viewers rely on polling)
  useEffect(() => {
    if (canSign) return
    const interval = setInterval(() => void refetchFallback(), 30_000)
    return () => clearInterval(interval)
  }, [canSign, refetchFallback])

  // Track controller revision to surface re-renders when state changes
  const [, setRev] = useState(0)
  useEffect(() => {
    if (!controller) return
    const unsub = controller.onChange(() => setRev((r) => r + 1))
    return () => {
      unsub()
    }
  }, [controller])

  // Effective environment: controller state when signed in (reactive),
  // fallback otherwise (read-only polling + subscription). Either way,
  // metadata (timestamps, revision) comes from fallbackEnv — the controller
  // doesn't expose the document header.
  const environment: CloudEnvironment | null = canSign
    ? ctrlState
      ? projectFromController(documentId, ctrlState, fallbackEnv)
      : fallbackEnv // controller not ready yet — show what we have
    : fallbackEnv

  const isLoading = canSign ? ctrlLoading && !fallbackEnv : fallbackLoading
  const error = canSign ? ctrlError : fallbackError

  // ---- Mutations: dispatch on controller, then push (signed) ----

  const mutate = useCallback(
    async (fn: (c: NonNullable<typeof controller>) => void) => {
      if (!controller) {
        throw new Error(NOT_LOGGED_IN_ERROR)
      }
      fn(controller)
      await controller.push()
    },
    [controller],
  )

  const setLabel = useCallback((label: string) => mutate((c) => c.setLabel({ label })), [mutate])
  const setGenericSubdomain = useCallback(
    (subdomain: string) => mutate((c) => c.setGenericSubdomain({ genericSubdomain: subdomain })),
    [mutate],
  )
  // Custom domain writes go through the observability subgraph mutation
  // rather than the local controller — the subgraph is what enforces
  // cross-environment uniqueness and (optionally) pins a service to the
  // apex of the domain. The subscription above picks up the state change
  // once the mutation lands.
  const setCustomDomain = useCallback(
    async (enabled: boolean, domain?: string | null, apexService?: TenantService | null) => {
      const token = await getAuthToken(renownRef.current as never)
      if (!token) {
        throw new Error(NOT_LOGGED_IN_ERROR)
      }
      await setCustomDomainMutation(
        documentId,
        enabled,
        domain?.trim() ? domain.trim() : null,
        apexService ?? null,
        token,
      )
    },
    [documentId],
  )
  const setDefaultPackageRegistry = useCallback(
    (registry: string) =>
      mutate((c) => c.setDefaultPackageRegistry({ defaultPackageRegistry: registry })),
    [mutate],
  )
  const enableService = useCallback(
    (type: CloudEnvironmentServiceType, prefix: string, clintConfig?: CloudServiceClintConfig) =>
      mutate((c) =>
        c.enableService({
          type,
          prefix,
          clintConfig,
          // gitops.readServiceSize reads top-level selectedRessource first
          // and falls back to clintConfig.selectedRessource only as a
          // legacy transition path. The reducer always populates the
          // top-level field (defaulting to VETRA_AGENT_S when absent),
          // so the user's CLINT picker choice is silently overridden
          // unless we lift it here.
          selectedRessource: clintConfig?.selectedRessource ?? undefined,
        }),
      ),
    [mutate],
  )
  const disableService = useCallback(
    // CLINT supports multiple services per env keyed by prefix; without a
    // prefix the doc-model reducer falls back to first-by-type, which
    // silently disables the wrong agent in multi-clint envs. Always pass
    // prefix when we have one.
    (type: CloudEnvironmentServiceType, prefix?: string) =>
      mutate((c) => c.disableService({ type, prefix })),
    [mutate],
  )
  const toggleServiceEnabled = useCallback(
    (type: CloudEnvironmentServiceType) => mutate((c) => c.toggleService({ type })),
    [mutate],
  )
  const setServiceConfig = useCallback(
    (prefix: string, config: CloudServiceClintConfig) =>
      mutate((c) => c.setServiceConfig({ prefix, config })),
    [mutate],
  )
  const setServiceSize = useCallback(
    (prefix: string, size: CloudResourceSize) => mutate((c) => c.setServiceSize({ prefix, size })),
    [mutate],
  )
  const addPackage = useCallback(
    (name: string, version?: string) =>
      mutate((c) => c.addPackage({ packageName: name, version: version ?? undefined })),
    [mutate],
  )
  const removePackage = useCallback(
    (name: string) => mutate((c) => c.removePackage({ packageName: name })),
    [mutate],
  )
  const initialize = useCallback(
    (subdomain: string, baseDomain: string, defaultRegistry?: string) =>
      mutate((c) =>
        c.initialize({
          genericSubdomain: subdomain,
          genericBaseDomain: baseDomain,
          defaultPackageRegistry: defaultRegistry ?? undefined,
        }),
      ),
    [mutate],
  )
  const approveChanges = useCallback(() => mutate((c) => c.approveChanges({})), [mutate])
  const terminate = useCallback(() => mutate((c) => c.terminateEnvironment({})), [mutate])
  const setServiceVersion = useCallback(
    (type: CloudEnvironmentServiceType, version: string) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
      mutate((c) => c.setServiceVersion({ type: type as any, version })),
    [mutate],
  )
  const setPackageVersion = useCallback(
    (packageName: string, version: string) =>
      mutate((c) => c.setPackageVersion({ packageName, version })),
    [mutate],
  )
  const setAutoUpdateChannel = useCallback(
    (channel: AutoUpdateChannel | null) => mutate((c) => c.setAutoUpdateChannel({ channel })),
    [mutate],
  )
  // The `setBackupSchedule` controller method ships in vetra-cloud-package
  // 0.0.3-dev.76. Older builds of the consumer package don't yet expose it,
  // so we feature-test before dispatching to avoid a runtime crash and the
  // type cast lets the call type-check against either version.
  type ControllerWithSchedule = NonNullable<typeof controller> & {
    setBackupSchedule?: (input: {
      enabled: boolean
      cadence: BackupCadence
      retention: number
    }) => void
  }

  const setBackupSchedule = useCallback(
    (opts: { enabled: boolean; cadence: BackupCadence; retention: number }) =>
      mutate((c) => {
        const fn = (c as ControllerWithSchedule).setBackupSchedule
        if (typeof fn !== 'function') {
          throw new Error(
            'setBackupSchedule is not available in this controller version — update vetra-cloud-package.',
          )
        }
        fn.call(c, opts)
      }),
    [mutate],
  )

  /**
   * Whether the loaded controller's runtime exposes the `setBackupSchedule`
   * action. The doc-model package shipped this in 0.0.3-dev.76; older
   * builds of the consumer package will be missing it and we render the
   * panel in "coming soon" mode rather than crashing on dispatch.
   */
  const backupScheduleSupported =
    typeof (controller as ControllerWithSchedule | null)?.setBackupSchedule === 'function'

  // `setRuntimeConfig` ships in the vetra-cloud-package release that added the
  // SET_RUNTIME_CONFIG operation. Older builds of the consumer package don't
  // expose it, so we feature-test before dispatching (mirrors setBackupSchedule).
  // `config` is the operator-editable powerhouse.config.json partial
  // ({ connect: {...}, packageRegistryUrl? }); null/{} clears all overrides.
  // The reducer flips a deployed env to CHANGES_PENDING — the user then
  // Approves/Deploys (env-action-bar) to roll it out via gitops.
  // The doc-model field is a String scalar (federation-composable), so the
  // SET_RUNTIME_CONFIG operation takes the config as a JSON string. Callers
  // pass the object ({ connect, packageRegistryUrl }); we stringify here.
  type ControllerWithRuntimeConfig = NonNullable<typeof controller> & {
    setRuntimeConfig?: (input: { config: string | null }) => void
  }

  const setRuntimeConfig = useCallback(
    (config: Record<string, unknown> | null) =>
      mutate((c) => {
        const fn = (c as ControllerWithRuntimeConfig).setRuntimeConfig
        if (typeof fn !== 'function') {
          throw new Error(
            'setRuntimeConfig is not available in this controller version — update vetra-cloud-package.',
          )
        }
        fn.call(c, { config: config === null ? null : JSON.stringify(config) })
      }),
    [mutate],
  )

  const runtimeConfigSupported =
    typeof (controller as ControllerWithRuntimeConfig | null)?.setRuntimeConfig === 'function'

  /** Owner-triggered "update to latest" — pulls the env's subscribed
   *  channel's latest known tag and bumps all enabled services. */
  const updateToLatest = useCallback(async () => {
    const token = await getAuthToken(renownRef.current as never)
    if (!token) throw new Error(NOT_LOGGED_IN_ERROR)
    return updateEnvironmentToLatest(documentId, token)
  }, [documentId])

  /** Owner-triggered revert to previous tag per enabled service. */
  const rollbackRelease = useCallback(async () => {
    const token = await getAuthToken(renownRef.current as never)
    if (!token) throw new Error(NOT_LOGGED_IN_ERROR)
    return rollbackEnvironmentRelease(documentId, token)
  }, [documentId])

  return {
    environment,
    isLoading,
    error,
    setLabel,
    setGenericSubdomain,
    setCustomDomain,
    setDefaultPackageRegistry,
    enableService,
    disableService,
    toggleServiceEnabled,
    setServiceConfig,
    setServiceSize,
    addPackage,
    removePackage,
    initialize,
    approveChanges,
    terminate,
    setServiceVersion,
    setPackageVersion,
    setAutoUpdateChannel,
    setBackupSchedule,
    backupScheduleSupported,
    setRuntimeConfig,
    runtimeConfigSupported,
    updateToLatest,
    rollbackRelease,
  }
}
