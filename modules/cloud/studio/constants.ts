import type { CloudResourceSize } from '@/modules/cloud/types'

/** The package whose presence (as a CLINT agent) marks a Vetra Studio. */
export const STUDIO_AGENT_PACKAGE = 'vetra-cli'
/**
 * Pinned, known-good vetra-cli version. We pin explicitly because the `latest`
 * dist-tag has pointed at builds that crash on boot (e.g. dev.8:
 * ERR_PACKAGE_PATH_NOT_EXPORTED for `@powerhousedao/reactor-attachments/client`
 * via ph-clint). dev.14 is the first build produced from vetra-cli's own
 * Dockerfile (clint-image-builder in-job detection) and verified to build +
 * push the clint-agent image end-to-end. Bump this when a newer build is
 * verified, or switch back to undefined (= latest) once `latest` tracks a
 * working build.
 */
export const STUDIO_AGENT_VERSION = '0.0.1-dev.19'
/** Default agent prefix for a freshly-provisioned studio (manifest agent.id). */
export const STUDIO_AGENT_PREFIX = 'vetra-agent'
/** Studio agents only support XL/XXL; v1 provisions XXL. */
export const STUDIO_AGENT_SIZE: CloudResourceSize = 'VETRA_AGENT_XXL'
/** Manifest serviceCommand for vetra-cli. */
export const STUDIO_SERVICE_COMMAND = 'vetra'
export const STUDIO_REGISTRY = 'https://registry.dev.vetra.io'
export const STUDIO_BASE_DOMAIN = 'vetra.io'
export const STUDIO_ENV_LABEL = 'Vetra Studio'
/**
 * Plain (non-secret) env vars baked into every freshly-provisioned studio's
 * CLINT agent. The agent reads VETRA_OBSERVABILITY_CONSENT to decide whether
 * to emit observability data; we provision studios with consent granted.
 */
export const STUDIO_DEFAULT_ENV_VARS = [
  { name: 'VETRA_OBSERVABILITY_CONSENT', value: 'granted', isSecret: false },
] as const
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
