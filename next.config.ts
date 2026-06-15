import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Pin Next/Turbopack's workspace root to this project's directory. Without
// it, Next walks up the parent dir trying to find lockfiles and ends up
// using /home/froid/projects/powerhouse as the root (it holds ~70 sibling
// projects, no node_modules). The CSS pipeline then loops resolving
// `tailwindcss` from that wrong context and OOM-kills the build.
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** Next.js configuration for Vetra application */
const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'euc.li',
      },
      {
        protocol: 'https',
        hostname: '*.ipfs.w3s.link',
      },
      {
        protocol: 'https',
        hostname: 'ipfs.io',
      },
    ],
  },
  experimental: {
    externalDir: true,
  },
  output: 'standalone',
  turbopack: {
    root: projectRoot,
    resolveAlias: {
      // `@powerhousedao/reactor-browser`'s barrel transitively imports the
      // server reactor's pg-backed transport, dragging Node-only deps into the
      // browser bundle and breaking the build. We can't stub the whole reactor
      // (reactor-browser extends real reactor classes like BaseReadModel at
      // load), so stub just the Node-only leaves of its server transport. The
      // browser uses pglite/IndexedDB, never this pg transport, so the stub is
      // never actually invoked client-side. See stubs/empty-module.js.
      pg: './stubs/empty-module.js',
      'node:worker_threads': './stubs/empty-module.js',
    },
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
}

export default nextConfig
