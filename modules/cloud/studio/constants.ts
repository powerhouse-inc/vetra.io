import type { CloudResourceSize } from '@/modules/cloud/types'

/** The package whose presence (as a CLINT agent) marks a Vetra Studio. */
export const STUDIO_AGENT_PACKAGE = 'vetra-cli'
/** Default agent prefix for a freshly-provisioned studio (manifest agent.id). */
export const STUDIO_AGENT_PREFIX = 'vetra-agent'
/** Studio agents only support XL/XXL; v1 provisions XL. */
export const STUDIO_AGENT_SIZE: CloudResourceSize = 'VETRA_AGENT_XL'
/** Manifest serviceCommand for vetra-cli. */
export const STUDIO_SERVICE_COMMAND = 'vetra'
export const STUDIO_REGISTRY = 'https://registry.dev.vetra.io'
export const STUDIO_BASE_DOMAIN = 'vetra.io'
export const STUDIO_ENV_LABEL = 'Vetra Studio'
/**
 * The vetra-cli manifest declares three required Anthropic secrets. We collect
 * one key and write it to all three names so the agent boots regardless of
 * which it reads.
 */
export const STUDIO_ANTHROPIC_SECRET_NAMES = [
  'ANTHROPIC_API_KEY',
  'VETRA_ANTHROPIC_API_KEY',
  'VETRA_CLI_ANTHROPIC_API_KEY',
] as const
