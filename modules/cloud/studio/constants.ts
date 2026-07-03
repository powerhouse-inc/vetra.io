import type { CloudResourceSize } from '@/modules/cloud/types'

/** The package whose presence (as a CLINT agent) marks a Vetra Studio. */
export const STUDIO_AGENT_PACKAGE = 'vetra-cli'
/**
 * Pinned, known-good vetra-cli version. We pin explicitly because the `latest`
 * dist-tag has pointed at builds that crash on boot (e.g. dev.8:
 * ERR_PACKAGE_PATH_NOT_EXPORTED for `@powerhousedao/reactor-attachments/client`
 * via ph-clint). This is the cold-provision fallback; warm studios use the
 * pool's STUDIO_POOL_VERSION (sourced live via fetchStudioPoolVersion). dev.44
 * is the first build that stamps studioInstanceId on deploy (so deployed envs
 * group under their studio on /user/products). Bump this when a newer build is
 * verified, keeping it in lockstep with STUDIO_POOL_VERSION.
 */
export const STUDIO_AGENT_VERSION = '0.0.1-dev.44'
/** Default agent prefix for a freshly-provisioned studio (manifest agent.id). */
export const STUDIO_AGENT_PREFIX = 'vetra-agent'
/** Studio agents only support XL/XXL; v1 provisions XXL. */
export const STUDIO_AGENT_SIZE: CloudResourceSize = 'VETRA_AGENT_XXL'
/** Manifest serviceCommand for vetra-cli. */
export const STUDIO_SERVICE_COMMAND = 'vetra'
export const STUDIO_REGISTRY = 'https://registry.dev.vetra.io'
export const STUDIO_BASE_DOMAIN = 'vetra.io'
export const STUDIO_ENV_LABEL = 'Vetra Studio'
/** Non-secret env baked into every freshly-provisioned studio's CLINT agent. */
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
