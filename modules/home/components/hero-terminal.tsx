'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Check, ChevronDown, Copy, ExternalLink, Github } from 'lucide-react'

// Keep in sync with the install commands in modules/invites/early-access-gate.tsx
const CURL_CMD = 'curl -fsSL https://get.vetra.io | sh'
const NPM_CMD = 'npm install -g ph-cmd vetra-cli --registry=https://registry.vetra.io'
const GITHUB_URL = 'https://github.com/powerhouse-inc/vetra-cli'

type InstallMethod = 'curl' | 'npm'

export function HeroTerminal() {
  const [copied, setCopied] = useState<InstallMethod | null>(null)
  const [optionsOpen, setOptionsOpen] = useState(false)

  const handleCopy = async (method: InstallMethod, cmd: string) => {
    await navigator.clipboard.writeText(cmd)
    setCopied(method)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="w-full">
      <div className="border-border bg-background overflow-hidden rounded-xl border text-left shadow-sm">
        <div className="border-border bg-accent/40 flex items-center gap-1.5 border-b px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex items-center gap-2 px-4 py-3.5">
          <span className="text-primary font-mono text-sm font-bold">$</span>
          <code className="text-foreground min-w-0 flex-1 truncate font-mono text-sm">
            {CURL_CMD}
          </code>
          <button
            onClick={() => {
              void handleCopy('curl', CURL_CMD)
            }}
            className="text-foreground-70 hover:text-foreground ml-1 shrink-0 transition-colors"
            aria-label="Copy install command"
          >
            {copied === 'curl' ? (
              <Check className="text-primary h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <button
        onClick={() => setOptionsOpen((v) => !v)}
        className="text-foreground-70 hover:text-foreground mt-3 flex items-center gap-1.5 text-sm font-medium transition-colors"
        aria-expanded={optionsOpen}
      >
        More install options
        <ChevronDown
          className={`h-4 w-4 transition-transform duration-300 ${optionsOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ${optionsOpen ? 'mt-3 max-h-[300px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="border-border flex-1 border-t" />
            <span className="text-foreground-70 text-xs">install with npm / pnpm</span>
            <div className="border-border flex-1 border-t" />
          </div>
          <div className="border-border bg-background flex items-start gap-2 rounded-lg border px-3 py-2.5">
            <span className="text-primary font-mono text-xs leading-relaxed font-bold">$</span>
            <code className="text-foreground min-w-0 flex-1 font-mono text-xs leading-relaxed">
              <span className="whitespace-nowrap">npm install -g ph-cmd vetra-cli</span>{' '}
              <span className="whitespace-nowrap">--registry=https://registry.vetra.io</span>
            </code>
            <button
              onClick={() => {
                void handleCopy('npm', NPM_CMD)
              }}
              className="text-foreground-70 hover:text-foreground ml-1 shrink-0 transition-colors"
              aria-label="Copy npm install command"
            >
              {copied === 'npm' ? (
                <Check className="text-primary h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="border-border flex-1 border-t" />
            <span className="text-foreground-70 text-xs">or checkout the project from GitHub</span>
            <div className="border-border flex-1 border-t" />
          </div>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="border-border bg-background hover:bg-accent group inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-sm transition-colors"
          >
            <Github className="h-4 w-4 shrink-0" />
            <span className="font-mono">powerhouse-inc/vetra-cli</span>
            <ExternalLink className="text-foreground-70 group-hover:text-foreground h-3.5 w-3.5 shrink-0 transition-colors" />
          </Link>
        </div>
      </div>
    </div>
  )
}
