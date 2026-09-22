import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pkg from './package.json' with { type: 'json' }

// Pin Next/Turbopack's workspace root to this project's directory. Without
// it, Next walks up the parent dir trying to find lockfiles and ends up
// using /home/froid/projects/powerhouse as the root (it holds ~70 sibling
// projects, no node_modules). The CSS pipeline then loops resolving
// `tailwindcss` from that wrong context and OOM-kills the build.
const projectRoot = path.dirname(fileURLToPath(import.meta.url))

/** Next.js configuration for Vetra application */
const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  // Build identifier inlined into the bundle to drive the persisted React Query
  // cache-buster. Prefers the Docker TAG build-arg (unique per deploy: image
  // sha-tag on staging, semantic version on release), falling back to
  // package.json's version for local builds where no TAG is provided.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.NEXT_PUBLIC_BUILD_ID ?? pkg.version,
  },
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
      // Optional @x402 payment peers of @coinbase/cdp-sdk (pulled via Privy).
      // Vetra never uses x402, so stub the leaves it references at build time.
      '@x402/core/client': './stubs/empty-module.js',
      '@x402/evm': './stubs/empty-module.js',
      '@x402/evm/exact/client': './stubs/empty-module.js',
      '@x402/evm/upto/client': './stubs/empty-module.js',
      '@x402/svm/exact/client': './stubs/empty-module.js',
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
