import { describe, it, expect } from 'vitest'
import {
  createLicenseType,
  setLicenseTypeDetails,
  setLicenseTypeTemplate,
  addLicenseTypeService,
  addLicenseTypePackage,
  publishLicenseType,
  retireLicenseType,
  issueGrant,
  revokeLicense,
  PublisherApiError,
} from '../graphql'
import type { FetchLike } from '../graphql'

type Call = { query: string; variables: Record<string, unknown> }

const capture = (data: unknown) => {
  const calls: Call[] = []
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    calls.push(JSON.parse(init.body as string))
    return new Response(JSON.stringify({ data }), { status: 200 })
  }) as unknown as FetchLike
  return { calls, fetchImpl }
}

const ok = (field: string, value: unknown = true) => capture({ vetraPublisher: { [field]: value } })
const inputKeys = (c: Call) => Object.keys(c.variables.input as object)

describe('publisher mutation fetchers', () => {
  it('createLicenseType returns the new id and sends the right mutation and input', async () => {
    const { calls, fetchImpl } = ok('createLicenseType', 'lt-9')
    const id = await createLicenseType({ appId: 'a1', kind: 'PRO', label: 'Pro', validityDays: 365 }, 't', fetchImpl)
    expect(id).toBe('lt-9')
    expect(calls[0].query).toMatch(/mutation[^{]*\$input: CreateLicenseTypeInput!/)
    expect(calls[0].query).toContain('createLicenseType(input: $input)')
    expect(calls[0].variables.input).toEqual({ appId: 'a1', kind: 'PRO', label: 'Pro', validityDays: 365 })
  })

  it('setLicenseTypeDetails sends the right mutation and NEVER an app field', async () => {
    const { calls, fetchImpl } = ok('setLicenseTypeDetails')
    expect(await setLicenseTypeDetails({ licenseTypeId: 'lt-1', label: 'New name' }, 't', fetchImpl)).toBe(true)
    expect(calls[0].query).toContain('setLicenseTypeDetails(input: $input)')
    expect(calls[0].query).toMatch(/mutation[^{]*\$input: SetLicenseTypeDetailsInput!/)
    expect(inputKeys(calls[0])).not.toContain('app')
    expect(inputKeys(calls[0])).not.toContain('appId')
  })

  it('setLicenseTypeDetails omits unset keys and sends an explicit null to clear', async () => {
    const a = ok('setLicenseTypeDetails')
    await setLicenseTypeDetails({ licenseTypeId: 'lt-1', label: 'x' }, 't', a.fetchImpl)
    expect(inputKeys(a.calls[0])).toEqual(['licenseTypeId', 'label'])

    const b = ok('setLicenseTypeDetails')
    await setLicenseTypeDetails({ licenseTypeId: 'lt-1', validityDays: null }, 't', b.fetchImpl)
    expect(inputKeys(b.calls[0])).toContain('validityDays')
    expect((b.calls[0].variables.input as { validityDays: unknown }).validityDays).toBeNull()
    expect(inputKeys(b.calls[0])).not.toContain('label')
  })

  it('setLicenseTypeTemplate sends the right mutation and input', async () => {
    const { calls, fetchImpl } = ok('setLicenseTypeTemplate')
    const input = { licenseTypeId: 'lt-1', size: 'M', baseDomain: 'x.example', packageRegistry: null }
    expect(await setLicenseTypeTemplate(input, 't', fetchImpl)).toBe(true)
    expect(calls[0].query).toContain('setLicenseTypeTemplate(input: $input)')
    expect(calls[0].query).toMatch(/mutation[^{]*\$input: SetLicenseTypeTemplateInput!/)
    expect(calls[0].variables.input).toEqual(input)
  })

  it('addLicenseTypeService forwards the service type verbatim', async () => {
    const { calls, fetchImpl } = ok('addLicenseTypeService')
    expect(await addLicenseTypeService({ licenseTypeId: 'lt-1', type: 'CONNECT', prefix: null }, 't', fetchImpl)).toBe(true)
    expect(calls[0].query).toContain('addLicenseTypeService(input: $input)')
    expect(calls[0].query).toMatch(/mutation[^{]*\$input: AddLicenseTypeServiceInput!/)
    expect(calls[0].variables.input).toEqual({ licenseTypeId: 'lt-1', type: 'CONNECT', prefix: null })
  })

  it('addLicenseTypePackage sends the right mutation and input', async () => {
    const { calls, fetchImpl } = ok('addLicenseTypePackage')
    const input = { licenseTypeId: 'lt-1', packageName: '@acme/pkg', version: '1.2.3' }
    expect(await addLicenseTypePackage(input, 't', fetchImpl)).toBe(true)
    expect(calls[0].query).toContain('addLicenseTypePackage(input: $input)')
    expect(calls[0].query).toMatch(/mutation[^{]*\$input: AddLicenseTypePackageInput!/)
    expect(calls[0].variables.input).toEqual(input)
  })

  it('publishLicenseType takes a bare id argument, not an input object', async () => {
    const { calls, fetchImpl } = ok('publishLicenseType')
    expect(await publishLicenseType('lt-1', 't', fetchImpl)).toBe(true)
    expect(calls[0].query).toContain('publishLicenseType(licenseTypeId: $licenseTypeId)')
    expect(calls[0].query).toMatch(/mutation[^{]*\$licenseTypeId: String!/)
    expect(calls[0].variables).toEqual({ licenseTypeId: 'lt-1' })
  })

  it('retireLicenseType takes a bare id argument and calls retire, not publish', async () => {
    const { calls, fetchImpl } = ok('retireLicenseType')
    expect(await retireLicenseType('lt-1', 't', fetchImpl)).toBe(true)
    expect(calls[0].query).toMatch(/mutation[^{]*\$licenseTypeId: String!/)
    expect(calls[0].query).toContain('retireLicenseType(licenseTypeId: $licenseTypeId)')
    expect(calls[0].query).not.toContain('publishLicenseType')
    expect(calls[0].variables).toEqual({ licenseTypeId: 'lt-1' })
  })

  it('issueGrant returns the new licence id and sends the right mutation and input', async () => {
    const { calls, fetchImpl } = ok('issueGrant', 'lic-3')
    const input = { appId: 'a1', licenseTypeId: 'lt-1', user: '0xabc' }
    expect(await issueGrant(input, 't', fetchImpl)).toBe('lic-3')
    expect(calls[0].query).toContain('issueGrant(input: $input)')
    expect(calls[0].query).toMatch(/mutation[^{]*\$input: IssueGrantInput!/)
    expect(calls[0].variables.input).toEqual(input)
  })

  it('revokeLicense sends licenseId and reason only, never an appId', async () => {
    const { calls, fetchImpl } = ok('revokeLicense')
    expect(await revokeLicense({ licenseId: 'lic-3', reason: 'non-payment' }, 't', fetchImpl)).toBe(true)
    expect(calls[0].query).toContain('revokeLicense(input: $input)')
    expect(calls[0].query).toMatch(/mutation[^{]*\$input: RevokeLicenseInput!/)
    expect(calls[0].variables.input).toEqual({ licenseId: 'lic-3', reason: 'non-payment' })
    expect(inputKeys(calls[0])).not.toContain('appId')
  })

  it('sends the bearer token', async () => {
    let auth: string | undefined
    const fetchImpl = (async (_u: string, init: RequestInit) => {
      auth = (init.headers as Record<string, string>).Authorization
      return new Response(JSON.stringify({ data: { vetraPublisher: { publishLicenseType: true } } }), { status: 200 })
    }) as unknown as FetchLike
    await publishLicenseType('lt-1', 'tok', fetchImpl)
    expect(auth).toBe('Bearer tok')
  })

  it('surfaces a rejected mutation as a coded PublisherApiError without swallowing or retrying', async () => {
    let n = 0
    const fetchImpl = (async () => {
      n++
      return new Response(
        JSON.stringify({ errors: [{ message: 'tier has no services', extensions: { code: 'INVALID_INPUT' } }] }),
        { status: 200 },
      )
    }) as unknown as FetchLike
    const err = await publishLicenseType('lt-1', 't', fetchImpl).catch((e) => e)
    expect(err).toBeInstanceOf(PublisherApiError)
    expect(err.code).toBe('INVALID_INPUT')
    expect(err.message).toBe('tier has no services')
    expect(n).toBe(1)
  })
})
