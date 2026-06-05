#!/usr/bin/env node
/**
 * Drops a stub `next/config` into the resolved `node_modules/next/`.
 *
 * Background: Next.js 16 removed `next/config`, but @storybook/nextjs 9.1.9
 * still requires it at preset-load time. Webpack-level aliases run too late
 * to help — the failure is in Node's `require.resolve`.
 *
 * Workaround: write a tiny CommonJS stub at the resolved package path before
 * storybook boots. Idempotent — leaves the file alone if it already exists.
 *
 * TODO(infra): remove this shim entirely when @storybook/nextjs supports
 * Next 16 natively (or once we migrate to @storybook/nextjs-vite).
 */

const fs = require('node:fs')
const path = require('node:path')

const STUB_JS = `// Shim added by vetra.to .storybook setup. Next.js 16 removed \`next/config\`
// but @storybook/nextjs 9.1.9 still requires it. Returns empty stubs that
// match the original API shape.
'use strict'
exports.default = function nextConfig() { return { publicRuntimeConfig: {}, serverRuntimeConfig: {} } }
exports.getConfig = function getConfig() { return {} }
exports.setConfig = function setConfig() {}
`

const STUB_DTS = `export function getConfig(): Record<string, unknown>
export function setConfig(_: unknown): void
declare const _default: () => { publicRuntimeConfig: Record<string, unknown>; serverRuntimeConfig: Record<string, unknown> }
export default _default
`

function main() {
  let nextPkgRoot
  try {
    nextPkgRoot = path.dirname(require.resolve('next/package.json'))
  } catch (err) {
    console.error('ensure-next-config-shim: cannot resolve "next" package:', err.message)
    process.exit(0) // don't fail install if next isn't there yet
  }

  const configJs = path.join(nextPkgRoot, 'config.js')
  const configDts = path.join(nextPkgRoot, 'config.d.ts')

  if (!fs.existsSync(configJs)) {
    fs.writeFileSync(configJs, STUB_JS)
    console.log(`ensure-next-config-shim: wrote ${configJs}`)
  }
  if (!fs.existsSync(configDts)) {
    fs.writeFileSync(configDts, STUB_DTS)
  }
}

main()
