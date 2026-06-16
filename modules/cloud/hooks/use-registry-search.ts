'use client'

import { useState, useEffect, useRef } from 'react'
import type { PackageManifest } from '@/modules/cloud/config/types'

type RegistryPackage = {
  name: string
  version: string
  description: string | null
}

type VersionInfo = {
  distTags: Record<string, string>
  versions: string[]
}

export function useRegistryPackages(registryUrl: string | null, search: string) {
  const [packages, setPackages] = useState<RegistryPackage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!registryUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPackages([])
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const timeout = setTimeout(() => {
      void (async () => {
        setIsLoading(true)
        try {
          const params = new URLSearchParams({ registry: registryUrl })
          if (search) params.set('search', search)
          const res = await fetch(`/api/registry/packages?${params}`, {
            signal: controller.signal,
          })
          if (res.ok) {
            setPackages((await res.json()) as RegistryPackage[])
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return
        } finally {
          setIsLoading(false)
        }
      })()
    }, 200)

    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
  }, [registryUrl, search])

  return { packages, isLoading }
}

export function useRegistryVersions(registryUrl: string | null, packageName: string | null) {
  const [info, setInfo] = useState<VersionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!registryUrl || !packageName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    fetch(
      `/api/registry/versions?${new URLSearchParams({ registry: registryUrl, package: packageName })}`,
      { signal: controller.signal },
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (data) setInfo(data)
      })
      .catch(() => {})
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [registryUrl, packageName])

  return { info, isLoading }
}

/**
 * Fetch a single package's manifest. If version is null, fetches latest.
 * Returns null when the manifest cannot be fetched (including 404).
 */
export function useRegistryManifest(
  registryUrl: string | null,
  packageName: string | null,
  version: string | null,
) {
  const [manifest, setManifest] = useState<PackageManifest | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!registryUrl || !packageName) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManifest(null)
      setError(null)
      return
    }

    const controller = new AbortController()
    setIsLoading(true)
    setError(null)

    const params = new URLSearchParams({ registry: registryUrl, package: packageName })
    if (version) params.set('version', version)

    fetch(`/api/registry/manifest?${params}`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 404) return null
          throw new Error(`Manifest fetch failed: ${res.status}`)
        }
        return (await res.json()) as PackageManifest
      })
      .then((data) => setManifest(data))
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err : new Error(String(err)))
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [registryUrl, packageName, version])

  return { manifest, isLoading, error }
}

/**
 * Fetch manifests for a set of (packageName, version) pairs in parallel.
 * Returns one entry per input pair in the same order. Null manifest means
 * the fetch failed or returned 404.
 */
export function useRegistryManifests(
  registryUrl: string | null,
  packages: Array<{ name: string; version?: string | null }>,
) {
  const [manifests, setManifests] = useState<
    Array<{ packageName: string; manifest: PackageManifest | null }>
  >([])
  const [isLoading, setIsLoading] = useState(false)

  // Serialize deps to avoid re-fetching when an unrelated array reference changes
  const key = `${registryUrl ?? ''}|${packages
    .map((p) => `${p.name}@${p.version ?? ''}`)
    .sort()
    .join(',')}`

  useEffect(() => {
    if (!registryUrl || packages.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setManifests([])
      return
    }

    const controller = new AbortController()
    setIsLoading(true)

    void Promise.all(
      packages.map(async (p) => {
        const params = new URLSearchParams({ registry: registryUrl, package: p.name })
        if (p.version) params.set('version', p.version)
        try {
          const res = await fetch(`/api/registry/manifest?${params}`, {
            signal: controller.signal,
          })
          if (!res.ok) return { packageName: p.name, manifest: null }
          return {
            packageName: p.name,
            manifest: (await res.json()) as PackageManifest,
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') {
            return { packageName: p.name, manifest: null }
          }
          return { packageName: p.name, manifest: null }
        }
      }),
    )
      .then((results) => setManifests(results))
      .finally(() => setIsLoading(false))

    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { manifests, isLoading }
}
