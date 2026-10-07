'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDid } from '@powerhousedao/reactor-browser'
import * as api from '../graphql'
import type {
  CreateLicenseTypeInput,
  SetLicenseTypeDetailsInput,
  SetLicenseTypeTemplateInput,
  AddLicenseTypeServiceInput,
  AddLicenseTypePackageInput,
  IssueGrantInput,
  RevokeLicenseInput,
} from '../types'
import { publisherKeys } from './keys'
import { usePublisherToken } from './use-publisher'

// No mutation passes `retry: retryPublisher`: retrying a grant could issue two
// licences for one click. useMutation defaults to retry: 0, which is what we want.
// Errors are not caught or rewritten: the UI surfaces the server's sentence verbatim.

/** Tier mutations invalidate the tier list. */
function useTierMutation<V, R>(appId: string, fn: (vars: V, token: string | null) => Promise<R>) {
  const qc = useQueryClient()
  const did = useDid() ?? 'anon'
  const token = usePublisherToken()
  return useMutation<R, Error, V>({
    mutationFn: async (vars: V) => fn(vars, await token()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: publisherKeys.types(appId, did) })
    },
  })
}

/**
 * Licence mutations invalidate licences and environments: the provisioning keeper
 * turns a licence change into an environment change on its next tick. Licences are
 * invalidated by PREFIX so every status filter variant is dropped, not just ALL/ACTIVE.
 */
function useLicenceMutation<V, R>(appId: string, fn: (vars: V, token: string | null) => Promise<R>) {
  const qc = useQueryClient()
  const did = useDid() ?? 'anon'
  const token = usePublisherToken()
  return useMutation<R, Error, V>({
    mutationFn: async (vars: V) => fn(vars, await token()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: publisherKeys.licensesOf(appId) })
      void qc.invalidateQueries({ queryKey: publisherKeys.environments(appId, did) })
    },
  })
}

export const useCreateLicenseType = (appId: string) =>
  useTierMutation<CreateLicenseTypeInput, string>(appId, (v, t) => api.createLicenseType(v, t))
export const useSetLicenseTypeDetails = (appId: string) =>
  useTierMutation<SetLicenseTypeDetailsInput, boolean>(appId, (v, t) => api.setLicenseTypeDetails(v, t))
export const useSetLicenseTypeTemplate = (appId: string) =>
  useTierMutation<SetLicenseTypeTemplateInput, boolean>(appId, (v, t) => api.setLicenseTypeTemplate(v, t))
export const useAddLicenseTypeService = (appId: string) =>
  useTierMutation<AddLicenseTypeServiceInput, boolean>(appId, (v, t) => api.addLicenseTypeService(v, t))
export const useAddLicenseTypePackage = (appId: string) =>
  useTierMutation<AddLicenseTypePackageInput, boolean>(appId, (v, t) => api.addLicenseTypePackage(v, t))
export const usePublishLicenseType = (appId: string) =>
  useTierMutation<string, boolean>(appId, (id, t) => api.publishLicenseType(id, t))
export const useRetireLicenseType = (appId: string) =>
  useTierMutation<string, boolean>(appId, (id, t) => api.retireLicenseType(id, t))

export const useIssueGrant = (appId: string) =>
  useLicenceMutation<IssueGrantInput, string>(appId, (v, t) => api.issueGrant(v, t))
export const useRevokeLicense = (appId: string) =>
  useLicenceMutation<RevokeLicenseInput, boolean>(appId, (v, t) => api.revokeLicense(v, t))
