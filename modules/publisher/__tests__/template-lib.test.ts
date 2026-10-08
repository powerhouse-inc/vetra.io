import { describe, it, expect } from 'vitest'
import {
  describeTemplate,
  isTemplateFormDirty,
  sharedModeBlocker,
  templateDetailsInput,
  templateToForm,
} from '../lib/template'
import type { PublisherTemplate } from '../types'

const tpl = (over: Partial<PublisherTemplate> = {}): PublisherTemplate => ({
  id: 'tpl-1', name: 'Pro', mode: 'DEDICATED', sharedEnvironment: null, size: 'VETRA_AGENT_M',
  baseDomain: null, packageRegistry: null, services: [], packages: [], templateHash: 'h',
  environmentCount: 0, ...over,
})

describe('describeTemplate', () => {
  it('describes a shared template by where owners land', () => {
    expect(describeTemplate(tpl({ mode: 'SHARED' }))).toBe('Owners get an account on your App Environment.')
    expect(describeTemplate(tpl({ mode: 'SHARED', sharedEnvironment: 'env-9' }))).toBe(
      'Owners get an account on one shared environment.',
    )
    expect(describeTemplate(tpl({ mode: 'SHARED', sharedEnvironment: 'env-9' }), 'Community')).toBe(
      'Owners get an account on the Community environment.',
    )
  })

  it('asks for a service on an empty dedicated template', () => {
    expect(describeTemplate(tpl())).toBe('Nothing to run yet — add at least one service.')
  })

  it('reads a dedicated template as one sentence', () => {
    const t = tpl({
      services: [
        { id: 's1', type: 'FUSION', prefix: 'kv', artifactName: 'vault-app', artifactChannel: 'LATEST' },
        { id: 's2', type: 'SWITCHBOARD', prefix: null, artifactName: null, artifactChannel: null },
      ],
      packages: [{ id: 'p1', packageName: '@acme/vault', version: '1.2.0' }],
    })
    expect(describeTemplate(t)).toBe(
      'Each owner gets vault-app at kv, following latest release, Switchboard, with @acme/vault@1.2.0 installed.',
    )
  })
})

describe('template form', () => {
  it('round-trips a template into a full details input', () => {
    const t = tpl({ mode: 'SHARED', sharedEnvironment: 'env-9', size: null })
    const form = templateToForm(t)
    expect(form).toEqual({ name: 'Pro', mode: 'SHARED', sharedEnvironment: 'env-9', size: '', baseDomain: '', packageRegistry: '' })
    expect(isTemplateFormDirty(t, form)).toBe(false)
    expect(templateDetailsInput('tpl-1', { ...form, name: '  Pro 2 ' })).toEqual({
      templateId: 'tpl-1', name: 'Pro 2', mode: 'SHARED', sharedEnvironment: 'env-9',
      size: null, baseDomain: null, packageRegistry: null,
    })
  })

  it('drops the shared environment when the template is dedicated', () => {
    const input = templateDetailsInput('tpl-1', { ...templateToForm(tpl()), sharedEnvironment: 'env-9' })
    expect(input.sharedEnvironment).toBeNull()
  })

  it('treats whitespace-only edits as unchanged', () => {
    const t = tpl()
    expect(isTemplateFormDirty(t, { ...templateToForm(t), name: ' Pro ' })).toBe(false)
    expect(isTemplateFormDirty(t, { ...templateToForm(t), size: 'VETRA_AGENT_L' })).toBe(true)
  })

  it('blocks switching to shared while services or packages exist', () => {
    expect(sharedModeBlocker(tpl())).toBeNull()
    expect(sharedModeBlocker(tpl({ packages: [{ id: 'p', packageName: 'x', version: null }] }))).toMatch(
      /remove its services and packages/i,
    )
  })
})
