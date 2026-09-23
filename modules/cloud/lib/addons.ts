import { Archive, FileText, Workflow } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import type { ConfigEntryType } from '../config/types'
import type { TenantEnvVar, TenantSecretEntry } from '../graphql'
import { PH_WORKFLOWS_ENABLED } from './workflows'

/** A tenant env var or secret an add-on reads, with copy for its settings dialog. */
export type AddonConfigField = {
  name: string
  type: ConfigEntryType
  title: string
  description: string
  default?: string
  placeholder?: string
  required?: boolean
}

/** Prefixes the gitops reconciler expects. */
export const DOCLING_PREFIX = 'docling'
export const PAPERLESS_PREFIX = 'paperless'

export type AddonId = 'docling' | 'paperless' | 'workflows'

export type AddonDefinition = {
  id: AddonId
  label: string
  icon: LucideIcon
  /** States the add-on's cost plainly; unsaid, it only surfaces later as unexplained slowness or a bill. */
  description: string
  /** Shown under the description when the add-on is available. */
  note?: string
  /** Settings the add-on exposes; empty hides its settings button. */
  config: AddonConfigField[]
}

/** An add-on's current state and its toggle; each add-on has its own hook. */
export type AddonControl = {
  enabled: boolean
  /** Why the switch can't be used right now; renders it disabled. */
  unavailable?: string
  toggle: (enabled: boolean) => Promise<void>
}

/** Tenant config the settings dialog reads and writes. */
export type AddonConfigStore = {
  envVars: TenantEnvVar[]
  secrets: TenantSecretEntry[]
  setVar: (key: string, value: string) => Promise<void>
  setSecret: (key: string, value: string) => Promise<void>
  deleteVar: (key: string) => Promise<void>
  deleteSecret: (key: string) => Promise<void>
}

export const DOCLING_ADDON: AddonDefinition = {
  id: 'docling',
  label: 'Document Conversion',
  icon: FileText,
  description:
    'Converts PDF, DOCX and images into documents your reactor can index. Runs privately inside this environment — no public URL. Reserves ~2 GiB of memory and converts one document at a time.',
  config: [],
}

export const PAPERLESS_ADDON: AddonDefinition = {
  id: 'paperless',
  label: 'Document Archive',
  icon: Archive,
  description:
    'A private Paperless-ngx archive with OCR, wired to your switchboard for paperless-sync. Reserves ~1.5 GiB of memory. Documents stay in this environment; web access arrives with single sign-on.',
  config: [],
}

export const WORKFLOWS_ADDON: AddonDefinition = {
  id: 'workflows',
  label: 'Workflows',
  icon: Workflow,
  description:
    'Runs workflow documents on this environment and adds the workflow editors and Workflow Studio to Connect. Each run executes in its own process on the reactor.',
  note: 'Switching restarts the reactor right away; Connect picks it up on your next Approve / Deploy.',
  config: [
    {
      name: 'PH_WORKFLOWS_SECRETS_MASTER_KEY',
      type: 'secret',
      title: 'Secrets encryption key',
      description:
        'Encrypts the credentials saved with your workflow connections: 64 hexadecimal characters, e.g. from openssl rand -hex 32. Without it, saved connection secrets become unreadable whenever the environment restarts. Changing it later has the same effect.',
      required: true,
    },
    {
      name: 'PH_WORKFLOWS_EGRESS_ALLOW_ADDRESSES',
      type: 'var',
      title: 'Allowed private addresses',
      description:
        'By default, connectors cannot reach private or loopback addresses. List the addresses or CIDR ranges they may reach, separated by commas. A single address allows only that host.',
      placeholder: '10.0.0.5, 192.168.1.0/24',
    },
    {
      name: 'PH_WORKFLOWS_RUN_CONCURRENCY',
      type: 'var',
      title: 'Run concurrency',
      description:
        'How many workflow runs execute at the same time. Each running workflow uses its own process, so raising this increases CPU and memory use.',
      default: '4',
    },
    {
      name: 'PH_WORKFLOWS_RUN_QUEUE_DEPTH',
      type: 'var',
      title: 'Run queue limit',
      description:
        'How many runs can wait for a free slot before new runs are rejected. 0 means no limit: when busy, runs wait longer instead of failing.',
      default: '0',
    },
    {
      name: 'PH_WORKFLOWS_POLL_INTERVAL_MS',
      type: 'var',
      title: 'Default polling interval',
      description:
        'How often polling triggers check for new data when neither the workflow nor the connector sets its own interval, in milliseconds. Minimum 1 second. Default: 60 seconds.',
      default: '60000',
    },
    {
      name: 'PH_WORKFLOWS_WEBHOOK_RECONCILE_MS',
      type: 'var',
      title: 'Webhook recheck interval',
      description:
        'How often webhook triggers re-register with the provider and check for events it may have missed, in milliseconds. Default: 15 minutes.',
      default: '900000',
    },
    {
      name: 'PH_WORKFLOWS_WEBHOOK_TIMEOUT_MS',
      type: 'var',
      title: 'Webhook response timeout',
      description:
        'How long an incoming webhook that waits for a result is held open, in milliseconds. After this the run keeps going and the sender gets a timeout response, which some providers retry. Default: 30 seconds.',
      default: '30000',
    },
    {
      name: 'PH_WORKFLOWS_PIECE_MAX_FILE_BYTES',
      type: 'var',
      title: 'Maximum file size',
      description:
        'Largest file a workflow step can read or produce, in bytes. Larger files cause the step to fail. Default: 8 MB.',
      default: '8388608',
    },
  ],
}

/** The add-ons, in display order. */
export const ADDONS: readonly AddonDefinition[] = [DOCLING_ADDON, PAPERLESS_ADDON, WORKFLOWS_ADDON]

/** Keys managed from the Add-ons panel rather than by an installed package. */
export const ADDON_CONFIG_KEYS = new Set<string>([
  PH_WORKFLOWS_ENABLED,
  ...ADDONS.flatMap((a) => a.config.map((f) => f.name)),
])
