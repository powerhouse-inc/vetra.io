import { describe, expect, it } from 'vitest'

import { CloudUserError, cloudErrorCode, describeCloudError } from '../lib/cloud-error'
import { EnvironmentAccessError } from '../org-sync'

const FALLBACK = 'Something went wrong.'

describe('describeCloudError', () => {
  it.each([
    ['UNAUTHENTICATED', /log in with renown/i],
    ['FORBIDDEN: not the owner', /permission/i],
    ['NotOwnerError', /permission/i],
    ['ENV_NOT_FOUND', /could not be found/i],
    ['DUMP_IN_PROGRESS', /backup is already in progress/i],
    ['RESTORE_IN_PROGRESS', /restore is in progress/i],
    ['DUMP_NOT_FOUND', /no longer exists/i],
    ['DUMP_NOT_READY', /not ready yet/i],
    ['DUMP_EXPIRED', /expired/i],
    ['ENV_NOT_READY', /must be running/i],
    ['RESTART_NOT_CONFIGURED', /restart isn't available/i],
    ['DEPLOYMENT_NOT_FOUND', /isn't deployed/i],
    ['AMBIGUOUS_SERVICE', /which service/i],
    ['DUMPS_NOT_CONFIGURED', /backups aren't available/i],
    ['INVALID_RETENTION', /between 1 and 30/i],
  ])('maps %s to a friendly sentence', (raw, expected) => {
    const out = describeCloudError(new Error(raw), FALLBACK)
    expect(out).toMatch(expected)
    expect(out).not.toMatch(/[A-Z]+_[A-Z]+|NotOwnerError/)
  })

  it('maps HTTP failures from the GraphQL client', () => {
    expect(
      describeCloudError(new Error('GraphQL request failed: 401 Unauthorized'), FALLBACK),
    ).toMatch(/log in/i)
    expect(
      describeCloudError(new Error('GraphQL request failed: 403 Forbidden'), FALLBACK),
    ).toMatch(/permission/i)
    expect(
      describeCloudError(new Error('GraphQL request failed: 502 Bad Gateway'), FALLBACK),
    ).toMatch(/trouble/i)
    expect(describeCloudError(new Error('GraphQL request failed: 400 Bad Request'), FALLBACK)).toBe(
      FALLBACK,
    )
  })

  it('maps network errors', () => {
    expect(describeCloudError(new TypeError('Failed to fetch'), FALLBACK)).toMatch(
      /couldn't reach/i,
    )
    expect(describeCloudError(new TypeError('NetworkError when attempting'), FALLBACK)).toMatch(
      /couldn't reach/i,
    )
  })

  it('returns the fallback for unknown errors and non-errors', () => {
    expect(describeCloudError(new Error('SOME_NEW_CODE'), FALLBACK)).toBe(FALLBACK)
    expect(describeCloudError(new Error('Cannot query field "x" on type "Y"'), FALLBACK)).toBe(
      FALLBACK,
    )
    expect(describeCloudError(undefined, FALLBACK)).toBe(FALLBACK)
    expect(describeCloudError({ message: 'FORBIDDEN' }, FALLBACK)).toBe(FALLBACK)
  })

  it('applies per-call overrides', () => {
    expect(
      describeCloudError(new Error('FORBIDDEN'), FALLBACK, {
        FORBIDDEN: 'Only the environment owner can restart.',
      }),
    ).toBe('Only the environment owner can restart.')
  })

  it('passes through errors written for the user', () => {
    expect(
      describeCloudError(new CloudUserError('Workflows were only partly enabled.'), FALLBACK),
    ).toBe('Workflows were only partly enabled.')
    expect(
      describeCloudError(
        new EnvironmentAccessError('env-1', 'Ask an organisation admin.'),
        FALLBACK,
      ),
    ).toBe('Ask an organisation admin.')
  })

  it('maps the not-logged-in message to a log-in prompt', () => {
    expect(
      cloudErrorCode(new Error('You must be logged in with Renown to perform this action')),
    ).toBe('UNAUTHENTICATED')
  })
})
