import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { appStatusMeta, deploymentStatusMeta } from '@/modules/apps/lib/status'
import { environmentStatusMeta } from '@/modules/cloud/lib/environment-status'
import { studioStatusMeta } from '@/modules/cloud/studio/studio-readiness'
import { StatusPill } from '@/modules/shared/components/status'
import { TONE_BADGE, TONE_DOT, unknownStatusMeta } from '@/modules/shared/lib/status'

describe('shared status tones', () => {
  it('gives every tone its own dot and pill colour', () => {
    expect(new Set(Object.values(TONE_DOT)).size).toBe(Object.keys(TONE_DOT).length)
    expect(new Set(Object.values(TONE_BADGE)).size).toBe(Object.keys(TONE_BADGE).length)
  })

  it('keeps progress (deploying) apart from warning (needs attention)', () => {
    expect(deploymentStatusMeta('DEPLOYING').tone).toBe('progress')
    expect(appStatusMeta('PENDING_IDENTITY').tone).toBe('warning')
    expect(TONE_DOT.progress).not.toBe(TONE_DOT.warning)
  })

  it('uses theme tokens, never hard-coded hex', () => {
    for (const cls of [...Object.values(TONE_DOT), ...Object.values(TONE_BADGE)]) {
      expect(cls).not.toMatch(/#[0-9a-f]{3,6}/i)
    }
  })

  it('falls back to a neutral label for unknown states', () => {
    expect(unknownStatusMeta('WEIRD')).toEqual({ label: 'WEIRD', tone: 'neutral', active: false })
  })
})

describe('environmentStatusMeta', () => {
  it('maps document statuses', () => {
    expect(environmentStatusMeta({ status: 'READY' })).toMatchObject({
      label: 'Ready',
      tone: 'success',
    })
    expect(environmentStatusMeta({ status: 'DEPLOYING' })).toMatchObject({
      label: 'Deploying',
      tone: 'progress',
      active: true,
    })
    expect(environmentStatusMeta({ status: 'DEPLOYMENt_FAILED' }).tone).toBe('danger')
    expect(environmentStatusMeta({ status: 'STOPPED' }).tone).toBe('neutral')
    expect(environmentStatusMeta({ status: 'SOMETHING' }).label).toBe('SOMETHING')
  })

  it('refines READY with live ArgoCD health', () => {
    const ready = (argoHealthStatus: string, argoSyncStatus: string) =>
      environmentStatusMeta({
        status: 'READY',
        argoHealthStatus: argoHealthStatus as never,
        argoSyncStatus: argoSyncStatus as never,
      })
    expect(ready('DEGRADED', 'SYNCED')).toMatchObject({ label: 'Degraded', tone: 'warning' })
    expect(ready('MISSING', 'SYNCED')).toMatchObject({ label: 'Down', tone: 'danger' })
    expect(ready('PROGRESSING', 'SYNCED')).toMatchObject({ label: 'Syncing', tone: 'progress' })
    expect(ready('HEALTHY', 'OUT_OF_SYNC').label).toBe('Syncing')
    expect(ready('HEALTHY', 'SYNCED')).toMatchObject({ label: 'Healthy', tone: 'success' })
    expect(ready('UNKNOWN', 'UNKNOWN').label).toBe('Ready')
  })

  it('ignores ArgoCD health while the document is not READY', () => {
    expect(environmentStatusMeta({ status: 'DEPLOYING', argoHealthStatus: 'MISSING' }).label).toBe(
      'Deploying',
    )
  })
})

describe('studioStatusMeta', () => {
  it('maps studio readiness', () => {
    expect(studioStatusMeta('ready')).toMatchObject({ label: 'Ready', tone: 'success' })
    expect(studioStatusMeta('sleeping')).toMatchObject({ label: 'Sleeping', tone: 'neutral' })
    expect(studioStatusMeta('booting')).toMatchObject({
      label: 'Provisioning',
      tone: 'progress',
      active: true,
    })
  })
})

describe('StatusPill', () => {
  it('renders the label with the tone classes and tooltip', () => {
    render(<StatusPill meta={{ label: 'Deploying', tone: 'progress', active: true }} title="why" />)
    const pill = screen.getByText('Deploying')
    expect(pill.className).toContain('text-info')
    expect(pill.getAttribute('title')).toBe('why')
  })
})
