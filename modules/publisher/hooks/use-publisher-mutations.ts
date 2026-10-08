'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as api from '../graphql'
import type {
  AddTemplateInput,
  AddTemplatePackageInput,
  AddTemplateServiceInput,
  AddTermInput,
  CreateInviteCodeInput,
  IssueGrantInput,
  PublisherInviteCode,
  RemoveTemplateEntryInput,
  ReplaceGrantInput,
  RevokeLicenseInput,
  SetTemplateDetailsInput,
  SetTermDetailsInput,
} from '../types'
import { publisherKeys, type PublisherResource } from './keys'
import { usePublisherToken } from './use-publisher'

// No mutation retries: retrying a grant could issue two licences for one click.
// Errors are not caught here; the UI shows the server's sentence verbatim.

type NoApp<T> = Omit<T, 'appId'>

function usePublisherMutation<V, R>(
  appId: string,
  fn: (vars: V, token: string | null) => Promise<R>,
  invalidates: readonly PublisherResource[],
) {
  const qc = useQueryClient()
  const token = usePublisherToken()
  return useMutation<R, Error, V>({
    mutationFn: async (vars) => fn(vars, await token()),
    onSuccess: () => {
      for (const r of invalidates)
        void qc.invalidateQueries({ queryKey: publisherKeys.of(r, appId) })
    },
  })
}

const TEMPLATE_WRITES = ['templates'] as const
// A template edit re-applies to its environments, so their hashes change too.
const TEMPLATE_CONTENT_WRITES = ['templates', 'environments'] as const
const TERM_WRITES = ['terms'] as const
// Licence changes move counts on plans (activeLicenses) and templates (environmentCount).
const LICENCE_WRITES = ['licenses', 'environments', 'terms', 'templates'] as const

export const useAddTemplate = (appId: string) =>
  usePublisherMutation<NoApp<AddTemplateInput>, string>(
    appId,
    (v, t) => api.addTemplate({ appId, ...v }, t),
    TEMPLATE_WRITES,
  )
export const useSetTemplateDetails = (appId: string) =>
  usePublisherMutation<NoApp<SetTemplateDetailsInput>, boolean>(
    appId,
    (v, t) => api.setTemplateDetails({ appId, ...v }, t),
    TEMPLATE_CONTENT_WRITES,
  )
export const useAddTemplateService = (appId: string) =>
  usePublisherMutation<NoApp<AddTemplateServiceInput>, boolean>(
    appId,
    (v, t) => api.addTemplateService({ appId, ...v }, t),
    TEMPLATE_CONTENT_WRITES,
  )
export const useRemoveTemplateService = (appId: string) =>
  usePublisherMutation<NoApp<RemoveTemplateEntryInput>, boolean>(
    appId,
    (v, t) => api.removeTemplateService({ appId, ...v }, t),
    TEMPLATE_CONTENT_WRITES,
  )
export const useAddTemplatePackage = (appId: string) =>
  usePublisherMutation<NoApp<AddTemplatePackageInput>, boolean>(
    appId,
    (v, t) => api.addTemplatePackage({ appId, ...v }, t),
    TEMPLATE_CONTENT_WRITES,
  )
export const useRemoveTemplatePackage = (appId: string) =>
  usePublisherMutation<NoApp<RemoveTemplateEntryInput>, boolean>(
    appId,
    (v, t) => api.removeTemplatePackage({ appId, ...v }, t),
    TEMPLATE_CONTENT_WRITES,
  )
export const useDeleteTemplate = (appId: string) =>
  usePublisherMutation<{ templateId: string }, boolean>(
    appId,
    (v, t) => api.deleteTemplate({ appId, ...v }, t),
    TEMPLATE_WRITES,
  )

export const useAddTerm = (appId: string) =>
  usePublisherMutation<NoApp<AddTermInput>, string>(
    appId,
    (v, t) => api.addTerm({ appId, ...v }, t),
    TERM_WRITES,
  )
export const useSetTermDetails = (appId: string) =>
  usePublisherMutation<NoApp<SetTermDetailsInput>, boolean>(
    appId,
    (v, t) => api.setTermDetails({ appId, ...v }, t),
    TERM_WRITES,
  )
export const usePublishTerm = (appId: string) =>
  usePublisherMutation<{ termId: string }, boolean>(
    appId,
    (v, t) => api.publishTerm({ appId, ...v }, t),
    TERM_WRITES,
  )
export const useRetireTerm = (appId: string) =>
  usePublisherMutation<{ termId: string }, boolean>(
    appId,
    (v, t) => api.retireTerm({ appId, ...v }, t),
    TERM_WRITES,
  )

export const useIssueGrant = (appId: string) =>
  usePublisherMutation<NoApp<IssueGrantInput>, string>(
    appId,
    (v, t) => api.issueGrant({ appId, ...v }, t),
    LICENCE_WRITES,
  )
export const useReplaceGrant = (appId: string) =>
  usePublisherMutation<ReplaceGrantInput, string>(
    appId,
    (v, t) => api.replaceGrant(v, t),
    LICENCE_WRITES,
  )
export const useRevokeLicense = (appId: string) =>
  usePublisherMutation<RevokeLicenseInput, boolean>(
    appId,
    (v, t) => api.revokeLicense(v, t),
    LICENCE_WRITES,
  )

export const useCreateInviteCode = (appId: string) =>
  usePublisherMutation<NoApp<CreateInviteCodeInput>, PublisherInviteCode>(
    appId,
    (v, t) => api.createInviteCode({ appId, ...v }, t),
    ['inviteCodes'],
  )
export const useSetInviteCodeActive = (appId: string) =>
  usePublisherMutation<{ code: string; active: boolean }, boolean>(
    appId,
    (v, t) => api.setInviteCodeActive({ appId, ...v }, t),
    ['inviteCodes'],
  )

export const useAddToAllowList = (appId: string) =>
  usePublisherMutation<{ user: string }, boolean>(
    appId,
    (v, t) => api.addToAllowList({ appId, ...v }, t),
    ['allowList'],
  )
export const useRemoveFromAllowList = (appId: string) =>
  usePublisherMutation<{ user: string }, boolean>(
    appId,
    (v, t) => api.removeFromAllowList({ appId, ...v }, t),
    ['allowList'],
  )
