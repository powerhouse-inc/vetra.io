'use client'

import CodeMirror from '@uiw/react-codemirror'
import { json, jsonParseLinter } from '@codemirror/lang-json'
import { linter, lintGutter, type Diagnostic, type LintSource } from '@codemirror/lint'
import Ajv, { type ErrorObject } from 'ajv'
import addFormats from 'ajv-formats'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useMemo } from 'react'

import { connectRuntimeConfigJsonSchema } from '@/modules/cloud/runtime-config/schema'
import { cn } from '@/shared/lib/utils'

const ajv = new Ajv({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(connectRuntimeConfigJsonSchema)

export type JsonValidationResult =
  | { ok: true; parsed: unknown }
  | { ok: false; issues: Array<{ path: string; message: string }> }

/**
 * Parse + validate a JSON string against the runtime-config schema.
 * Used both inline by this editor (for the linter) and by the parent
 * drawer (to gate Save).
 */
export function validateJsonString(value: string): JsonValidationResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch (err) {
    return {
      ok: false,
      issues: [
        {
          path: '/',
          message: err instanceof Error ? err.message : 'Invalid JSON',
        },
      ],
    }
  }
  const ok = validate(parsed)
  if (ok) return { ok: true, parsed }
  return {
    ok: false,
    issues: (validate.errors ?? []).map(errorToIssue),
  }
}

function errorToIssue(e: ErrorObject) {
  const where = e.instancePath || '/'
  const extra =
    e.keyword === 'additionalProperties'
      ? ` (unknown property: ${(e.params as { additionalProperty?: string }).additionalProperty})`
      : ''
  return { path: where, message: `${e.message ?? 'invalid'}${extra}` }
}

type Props = {
  value: string
  onChange: (value: string) => void
  readOnly?: boolean
  className?: string
}

/**
 * JSON editor for runtime config. CodeMirror with the JSON language pack
 * plus a custom Ajv linter that surfaces schema violations as inline
 * diagnostics in the gutter.
 *
 * The parent drawer keeps the canonical "current edits" state as JSON
 * string; this component only handles editing + linting, not save.
 */
export function RuntimeConfigJsonEditor({ value, onChange, readOnly, className }: Props) {
  const extensions = useMemo(() => {
    // Cast to `LintSource` to bridge the readonly-vs-mutable nominal-array
    // mismatch — the function semantically returns `readonly Diagnostic[]`
    // but TS doesn't widen `Diagnostic[]` to `readonly Diagnostic[]` in the
    // return-type inference.
    const ajvLintSource = ((view) => {
      const text = view.state.doc.toString()
      const diagnostics: Diagnostic[] = []
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        // jsonParseLinter handles syntax errors; bail to avoid duplicate diagnostics.
        return diagnostics
      }
      const ok = validate(parsed)
      if (ok) return diagnostics
      for (const err of validate.errors ?? []) {
        diagnostics.push({
          from: 0,
          to: text.length,
          severity: 'error',
          message: `${err.instancePath || '/'}: ${err.message ?? 'invalid'}`,
        })
      }
      return diagnostics
    }) as LintSource
    return [
      json(),
      // `jsonParseLinter()` from @codemirror/lang-json returns a function that's
      // structurally a LintSource but typed against a different copy of the
      // @codemirror/lint types; cast to bridge.
      linter(jsonParseLinter() as unknown as LintSource),
      linter(ajvLintSource),
      lintGutter(),
    ]
  }, [])

  const result = useMemo(() => validateJsonString(value), [value])

  return (
    <div className={cn('flex h-full flex-col gap-2', className)}>
      <div className="min-h-0 flex-1 overflow-auto rounded-md border">
        <CodeMirror
          value={value}
          onChange={onChange}
          extensions={extensions}
          editable={!readOnly}
          basicSetup={{ lineNumbers: true, foldGutter: true }}
          height="100%"
          className="h-full text-xs"
        />
      </div>
      <ValidationSummary result={result} />
    </div>
  )
}

function ValidationSummary({ result }: { result: JsonValidationResult }) {
  if (result.ok) {
    return (
      <div className="text-success inline-flex items-center gap-1.5 text-xs">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Valid against schema
      </div>
    )
  }
  return (
    <div className="space-y-1">
      <div className="text-destructive inline-flex items-center gap-1.5 text-xs font-medium">
        <AlertCircle className="h-3.5 w-3.5" />
        {result.issues.length} issue{result.issues.length === 1 ? '' : 's'}
      </div>
      <ul className="text-destructive max-h-24 space-y-0.5 overflow-y-auto text-[11px]">
        {result.issues.slice(0, 8).map((issue, i) => (
          <li key={i} className="font-mono">
            <span className="text-muted-foreground">{issue.path}</span> {issue.message}
          </li>
        ))}
        {result.issues.length > 8 && (
          <li className="text-muted-foreground">…and {result.issues.length - 8} more</li>
        )}
      </ul>
    </div>
  )
}
