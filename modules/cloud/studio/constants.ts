import type { CloudResourceSize } from '@/modules/cloud/types'

/** The package whose presence (as a CLINT agent) marks a Vetra Studio. */
export const STUDIO_AGENT_PACKAGE = 'vetra-cli'
/**
 * Pinned, known-good vetra-cli version. The `latest` dist-tag currently points
 * at 0.0.1-dev.8, which crashes on boot (ERR_PACKAGE_PATH_NOT_EXPORTED for
 * `@powerhousedao/reactor-attachments/client` via ph-clint). dev.9 fixes it and
 * runs healthy. Pin explicitly until `latest` is moved to a working build, then
 * bump or switch back to undefined (= latest).
 */
export const STUDIO_AGENT_VERSION = '0.0.1-dev.9'
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
