/**
 * Shim for `next/config`. Next.js 16 removed this module, but
 * @storybook/nextjs 9.1.9 still imports it. Aliased in .storybook/main.ts.
 *
 * TODO(infra): drop this shim when @storybook/nextjs is updated to support
 * Next 16 (or when we migrate to @storybook/nextjs-vite).
 */
export function getConfig() {
  return {}
}

export default function nextConfig() {
  return { publicRuntimeConfig: {}, serverRuntimeConfig: {} }
}

export function setConfig(_config: unknown): void {
  // no-op
}
