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

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
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
  CloudFusionConfig,
  CloudResourceSize,
  CloudServiceClintConfig,
  TenantService,
} from '../types'
import { useDocumentSubscription } from './use-document-subscription'
import { useEnvironmentController } from './use-environment-controller'
import { useCanSign } from './use-can-sign'
import { useRenown } from '@powerhousedao/reactor-browser'
import { useQueryClient } from '@tanstack/react-query'
import { editGateOwnerOrgId, runSignedEnvironmentAction } from '../org-sync'
import { CloudUserError } from '../lib/cloud-error'

const NOT_LOGGED_IN_ERROR = 'Log in with Renown to make changes to this environment.'

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
    // The controller holds the full document state: a missing ownerOrgId there
    // means personal (null). The read-only fallback leaves it undefined
    // ("not known"), which keeps the R6 edit gate closed until the controller loads.
    state: s ? { ...s, ownerOrgId: s.ownerOrgId ?? null } : s,
  }
}

export function useEnvironmentDetail(documentId: string) {
  const renown = useRenown()
  const renownRef = useRef(renown)
  useLayoutEffect(() => {
    renownRef.current = renown
  })
  const { canSign, signer } = useCanSign()
  const queryClient = useQueryClient()

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
  useLayoutEffect(() => {
    fallbackRef.current = fallbackEnv
  })

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refetchFallback()
  }, [refetchFallback])

  // Subscribe to remote document changes in both paths. The controller does
  // NOT poll/subscribe on its own — without this, a signed-in user never
  // sees server-side state transitions (status flipping READY→DEPLOYING etc.)
  // until they refresh the page.
  const controllerRef = useRef(controller)
  useLayoutEffect(() => {
    controllerRef.current = controller
  })

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

  // A just-granted org member's first read-only fetch may have been refused
  // before the controller load synced their grant: fetch the metadata again.
  useEffect(() => {
    if (controller && !fallbackRef.current) void refetchFallback()
  }, [controller, refetchFallback])

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
        throw new CloudUserError(NOT_LOGGED_IN_ERROR)
      }
      // Organisation envs: sync the caller's operator entry and refuse unless
      // the backend says they can operate (C1 contract). A refusal re-asks the
      // viewer's access so the edit controls follow.
      await runSignedEnvironmentAction(documentId, controller, signer?.user?.address, fn, {
        onOrgRefusal: () =>
          void queryClient.invalidateQueries({ queryKey: ['environment-org', documentId] }),
      })
    },
    [controller, documentId, signer, queryClient],
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
        throw new CloudUserError(NOT_LOGGED_IN_ERROR)
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
  const setFusionConfig = useCallback(
    (config: CloudFusionConfig) =>
      mutate((c) =>
        c.setFusionConfig({
          image: config.image,
          env: config.env.map((e) => ({
            name: e.name,
            value: e.value ?? null,
            isSecret: e.isSecret ?? null,
          })),
          autoUpdate: config.autoUpdate,
          autoUpdateTagPattern: config.autoUpdateTagPattern,
        }),
      ),
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
  const setBackupSchedule = useCallback(
    (opts: { enabled: boolean; cadence: BackupCadence; retention: number }) =>
      mutate((c) => c.setBackupSchedule(opts)),
    [mutate],
  )

  /**
   * Whether the schedule can be changed right now: the signed controller is
   * loaded (logged-in viewer, load finished). Until then — or for read-only
   * viewers — the panel shows the current (or default) schedule read-only.
   */
  const backupScheduleEditable = !!controller

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
          throw new CloudUserError(
            "This environment can't store runtime settings yet. It needs a platform update.",
          )
        }
        const json = config === null ? null : JSON.stringify(config)
        fn.call(c, { config: json })
        // A reducer rejection (e.g. a key the package's schema doesn't know
        // yet) leaves state untouched without throwing, so check it landed.
        const stored = (c.state.global as { runtimeConfig?: string | null }).runtimeConfig ?? null
        const expected = json === null || json === '{}' ? null : json
        if (stored !== expected) {
          throw new CloudUserError(
            'This environment rejected the setting. It may need a platform update.',
          )
        }
      }),
    [mutate],
  )

  const runtimeConfigSupported =
    typeof (controller as ControllerWithRuntimeConfig | null)?.setRuntimeConfig === 'function'

  // The runtime-config panel silently hides when unsupported (by design — it
  // must never break the page), but log WHY so operators can diagnose a
  // missing panel from the console instead of guessing.
  useEffect(() => {
    if (!canSign || ctrlLoading || runtimeConfigSupported) return
    if (ctrlError) {
      console.warn(
        '[runtime-config] panel hidden: environment controller failed to load —',
        ctrlError,
      )
    } else if (controller) {
      console.warn(
        '[runtime-config] panel hidden: setRuntimeConfig is not available in this vetra-cloud-package build — update the package to enable runtime-config editing.',
      )
    }
  }, [canSign, ctrlLoading, ctrlError, controller, runtimeConfigSupported])

  const retryController = ctrlResult.retry
  const retry = useCallback(() => {
    setFallbackError(null)
    void refetchFallback()
    retryController()
  }, [refetchFallback, retryController])

  /** Owner-triggered "update to latest" — pulls the env's subscribed
   *  channel's latest known tag and bumps all enabled services. */
  const updateToLatest = useCallback(async () => {
    const token = await getAuthToken(renownRef.current as never)
    if (!token) throw new CloudUserError(NOT_LOGGED_IN_ERROR)
    return updateEnvironmentToLatest(documentId, token)
  }, [documentId])

  /** Owner-triggered revert to previous tag per enabled service. */
  const rollbackRelease = useCallback(async () => {
    const token = await getAuthToken(renownRef.current as never)
    if (!token) throw new CloudUserError(NOT_LOGGED_IN_ERROR)
    return rollbackEnvironmentRelease(documentId, token)
  }, [documentId])

  return {
    environment,
    /** The env organisation for the R6 edit gate (see `editGateOwnerOrgId`). */
    editGateOwnerOrgId: editGateOwnerOrgId({
      canSign,
      controllerLoaded: !!ctrlState,
      ownerOrgId: environment?.state.ownerOrgId,
    }),
    /** Re-pull the signed controller (e.g. after a hand-over). */
    refresh: ctrlResult.refresh,
    /** Load the environment again after a failed load. */
    retry,
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
    setFusionConfig,
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
    backupScheduleEditable,
    setRuntimeConfig,
    runtimeConfigSupported,
    updateToLatest,
    rollbackRelease,
  }
}
