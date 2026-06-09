# syntax=docker.io/docker/dockerfile:1

FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager. BuildKit cache
# mount preserves the pnpm store across builds (and across GHA runs when the
# cache backend supports it), so only new/changed packages get refetched when
# the lockfile changes — the common case in our CI.
# pnpm-workspace.yaml carries the `overrides` config; without it the lockfile's
# recorded overrides won't match and `pnpm i --frozen-lockfile` fails with
# ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
RUN corepack enable pnpm && corepack install --global pnpm@11.4.0
RUN --mount=type=cache,target=/root/.local/share/pnpm/store,sharing=locked \
    pnpm i --frozen-lockfile


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

# Preserve .next/cache across builds so turbopack/swc artifacts are reused
# when most of the source is unchanged — typical incremental build is 1-2min
# faster with a warm cache.
RUN --mount=type=cache,target=/app/.next/cache \
    corepack enable pnpm && corepack install --global pnpm@11.4.0 && pnpm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static


EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
CMD HOSTNAME="0.0.0.0" node server.js