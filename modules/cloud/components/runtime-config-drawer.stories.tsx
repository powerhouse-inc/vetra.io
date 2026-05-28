/**
 * Storybook stories for the runtime-config drawer.
 *
 * The drawer talks to the real `vetra-cloud-runtime-config` subgraph in
 * production. For Storybook we intercept `window.fetch` in a decorator and
 * answer with `MOCK_PAYLOAD_*` so the drawer renders without a live
 * Switchboard. The drawer code itself stays unchanged — no story-only
 * branches.
 */
'use client'

import type { Decorator, Meta, StoryObj } from '@storybook/nextjs-vite'
import { Toaster } from 'sonner'
import { useEffect, useState } from 'react'

import { RuntimeConfigDrawer } from './runtime-config-drawer'
import { Button } from '@/modules/shared/components/ui/button'
import {
  MOCK_PAYLOAD_PRISTINE,
  MOCK_PAYLOAD_WITH_OVERRIDES,
} from '@/modules/cloud/runtime-config/mock-data'
import type { RuntimeConfigPayload } from '@/modules/cloud/runtime-config/types'

/**
 * Wraps a story payload into the subgraph's `RuntimeConfigConnectPayload`
 * envelope (with the `connect.*` wrapper unwrapped by graphql.ts).
 */
function toSubgraphResponse(payload: RuntimeConfigPayload) {
  return {
    effective: { connect: payload.effective },
    overrides: { connect: payload.overrides },
    schemaVersion: payload.schemaVersion,
    updatedAt: payload.updatedAt,
  }
}

/**
 * Decorator that intercepts the GraphQL fetch issued by `useRuntimeConfig`
 * and serves the story's mock payload. The drawer's hooks see a real
 * fetch round-trip; only the network layer is mocked.
 */
function withMockSubgraph(initial: RuntimeConfigPayload): Decorator {
  return (Story) => {
    useEffect(() => {
      const realFetch = window.fetch
      let current = toSubgraphResponse(initial)
      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const body = typeof init?.body === 'string' ? init.body : ''
        if (body.includes('runtimeConfig(tenantId')) {
          return new Response(
            JSON.stringify({ data: { runtimeConfig: current } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        if (body.includes('setRuntimeConfig(tenantId')) {
          const variables = (JSON.parse(body) as { variables?: { json?: unknown } })
            .variables
          const json = (variables?.json ?? {}) as Record<string, unknown>
          const connect = (json.connect ?? {}) as RuntimeConfigPayload['overrides']
          current = toSubgraphResponse({
            effective: { ...initial.effective, ...connect },
            overrides: connect,
            schemaVersion: initial.schemaVersion,
            updatedAt: new Date().toISOString(),
          })
          return new Response(
            JSON.stringify({ data: { setRuntimeConfig: current } }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          )
        }
        return realFetch(input as RequestInfo, init)
      }) as typeof window.fetch
      return () => {
        window.fetch = realFetch
      }
    }, [])
    return <Story />
  }
}

function DrawerHarness({
  envLabel,
  readOnly,
  initiallyOpen = true,
}: {
  envLabel?: string
  readOnly?: boolean
  initiallyOpen?: boolean
}) {
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <div style={{ padding: 24 }}>
      <Button onClick={() => setOpen(true)}>Open runtime config</Button>
      <RuntimeConfigDrawer
        open={open}
        onOpenChange={setOpen}
        tenantId="storybook-tenant"
        envLabel={envLabel ?? 'My Project Env'}
        readOnly={readOnly}
      />
      <Toaster />
    </div>
  )
}

const meta = {
  title: 'Cloud / Runtime Config / Drawer',
  component: DrawerHarness,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Side drawer for editing the deployed Connect runtime config. Form + JSON dual view. The drawer hits the real `runtimeConfig` / `setRuntimeConfig` GraphQL ops; Storybook intercepts those at the fetch layer with mock payloads.',
      },
    },
  },
} satisfies Meta<typeof DrawerHarness>

export default meta
type Story = StoryObj<typeof meta>

/**
 * Pre-populated with `MOCK_PAYLOAD_WITH_OVERRIDES` — a few fields set so the
 * "default" vs "override" badges are exercised across multiple sections.
 */
export const Default: Story = {
  args: { envLabel: 'My Project Env' },
  decorators: [withMockSubgraph(MOCK_PAYLOAD_WITH_OVERRIDES)],
}

/**
 * Pristine state — no overrides; every field falls back to defaults.
 */
export const Pristine: Story = {
  args: { envLabel: 'My Project Env (pristine)' },
  decorators: [withMockSubgraph(MOCK_PAYLOAD_PRISTINE)],
}

/**
 * Read-only viewer. Save / Reset / Discard are hidden and inputs disabled.
 */
export const ReadOnly: Story = {
  args: { envLabel: 'My Project Env (viewer)', readOnly: true },
  decorators: [withMockSubgraph(MOCK_PAYLOAD_WITH_OVERRIDES)],
}

/**
 * Drawer starts closed; clicking the trigger button opens it. Exercises the
 * open/close transition and Sheet entry animation.
 */
export const ClosedThenOpen: Story = {
  args: { envLabel: 'My Project Env', initiallyOpen: false },
  decorators: [withMockSubgraph(MOCK_PAYLOAD_WITH_OVERRIDES)],
}
