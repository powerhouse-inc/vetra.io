/**
 * Storybook stories for the runtime-config drawer.
 *
 * The drawer is now a controlled component: it receives the env document's
 * `runtimeConfig` ({ connect, packageRegistryUrl? }) and an `onSave` handler
 * (which, in production, dispatches SET_RUNTIME_CONFIG through the env
 * controller). Here the harness holds the config in local state and `onSave`
 * just stores it — no network, no subgraph mock.
 */
'use client'

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Toaster } from 'sonner'
import { useState } from 'react'

import { RuntimeConfigDrawer } from './runtime-config-drawer'
import { Button } from '@/modules/shared/components/ui/button'
import {
  MOCK_PAYLOAD_PRISTINE,
  MOCK_PAYLOAD_WITH_OVERRIDES,
} from '@/modules/cloud/runtime-config/mock-data'
import type { PHConnectRuntimeConfig } from '@/modules/cloud/runtime-config/types'

function DrawerHarness({
  envLabel,
  readOnly,
  initiallyOpen = true,
  initialOverrides,
}: {
  envLabel?: string
  readOnly?: boolean
  initiallyOpen?: boolean
  initialOverrides?: PHConnectRuntimeConfig
}) {
  const [open, setOpen] = useState(initiallyOpen)
  const [runtimeConfig, setRuntimeConfig] = useState<{
    connect?: Record<string, unknown>
    packageRegistryUrl?: string
  } | null>(
    initialOverrides && Object.keys(initialOverrides).length > 0
      ? { connect: initialOverrides }
      : null,
  )

  // Simulate the controller round-trip: store whatever was saved so the
  // drawer's "saved vs draft" diffing reflects the persisted value.
  const onSave = (config: Record<string, unknown> | null) => {
    setRuntimeConfig(config && Object.keys(config).length > 0 ? config : null)
    return Promise.resolve()
  }

  return (
    <div style={{ padding: 24 }}>
      <Button onClick={() => setOpen(true)}>Open runtime config</Button>
      <RuntimeConfigDrawer
        open={open}
        onOpenChange={setOpen}
        runtimeConfig={runtimeConfig}
        onSave={onSave}
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
          'Side drawer for editing the deployed Connect runtime config. Form + JSON dual view. Controlled via `runtimeConfig` + `onSave` props; in production `onSave` dispatches SET_RUNTIME_CONFIG through the env controller and the change deploys after Approve.',
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
  args: { envLabel: 'My Project Env', initialOverrides: MOCK_PAYLOAD_WITH_OVERRIDES.overrides },
}

/**
 * Pristine state — no overrides; every field falls back to defaults.
 */
export const Pristine: Story = {
  args: {
    envLabel: 'My Project Env (pristine)',
    initialOverrides: MOCK_PAYLOAD_PRISTINE.overrides,
  },
}

/**
 * Read-only viewer. Save / Reset / Discard are hidden and inputs disabled.
 */
export const ReadOnly: Story = {
  args: {
    envLabel: 'My Project Env (viewer)',
    readOnly: true,
    initialOverrides: MOCK_PAYLOAD_WITH_OVERRIDES.overrides,
  },
}

/**
 * Drawer starts closed; clicking the trigger button opens it. Exercises the
 * open/close transition and Sheet entry animation.
 */
export const ClosedThenOpen: Story = {
  args: {
    envLabel: 'My Project Env',
    initiallyOpen: false,
    initialOverrides: MOCK_PAYLOAD_WITH_OVERRIDES.overrides,
  },
}
