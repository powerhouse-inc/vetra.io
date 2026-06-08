import path from 'path'
import type { StorybookConfig } from '@storybook/nextjs-vite'

const config: StorybookConfig = {
  stories: ['../modules/**/*.mdx', '../modules/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
    '@storybook/addon-themes',
  ],
  // Use the Vite-based Next framework — the webpack-based @storybook/nextjs
  // 9.1.9 has two hard incompats with Next 16:
  //   - tries to require('next/config') at preset load (removed in Next 16)
  //   - calls swc.isWasm() as a function (Next 16 exports it as boolean prop)
  // The Vite framework bypasses both code paths.
  framework: '@storybook/nextjs-vite',
  staticDirs: ['../public'],
  viteFinal(config) {
    // Map `next/config` to the local shim so any user-land code that imports
    // it during a story render finds a no-op. The Vite framework itself
    // doesn't need this, but stories or shared components might.
    config.resolve ??= {}
    config.resolve.alias = {
      ...(typeof config.resolve.alias === 'object' && !Array.isArray(config.resolve.alias)
        ? config.resolve.alias
        : {}),
      'next/config': path.resolve(__dirname, 'next-config-shim.ts'),
    }
    return config
  },
}

export default config
