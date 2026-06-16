'use client'

import { useState, createContext, useContext, type ReactNode, useEffect } from 'react'
import { type BuilderAccount } from '../lib/server-data'

interface SearchContextType {
  searchTerm: string
  setSearchTerm: (term: string) => void
  builders: BuilderAccount[]
  isLoading: boolean
  error: string | null
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export const useSearch = () => {
  const context = useContext(SearchContext)
  if (!context) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}

interface BuildersPageClientProps {
  children: ReactNode
}

export function BuildersPageClient({ children }: BuildersPageClientProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [builders, setBuilders] = useState<BuilderAccount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBuilders = async (search?: string) => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await fetch('/api/builder-teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ search, type: 'team' }),
      })

      if (!response.ok) {
        throw new Error('Failed to fetch builders')
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = await response.json()
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      setBuilders(data.builders)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      console.error('Failed to fetch builders:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Search effect
  useEffect(() => {
    // Skip if searchTerm is empty (initial state) - let the initial load effect handle it
    if (searchTerm.trim() === '') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchBuilders()
      return
    }

    const timeoutId = setTimeout(() => {
      void fetchBuilders(searchTerm)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchTerm])

  return (
    <SearchContext.Provider
      value={{
        searchTerm,
        setSearchTerm,
        builders,
        isLoading,
        error,
      }}
    >
      {children}
    </SearchContext.Provider>
  )
}
