// Verbatim copy of renown.id utils/stat-format.ts formatStatValue (the app page shows the same numbers).

/** 1,234 · 12.5K · 1.2M · 0.13 — compact from 10,000 on. Same output on server and client. */
export function formatStatValue(value: number): string {
  const options: Intl.NumberFormatOptions =
    Math.abs(value) >= 10_000
      ? { notation: 'compact', maximumFractionDigits: 1 }
      : { maximumFractionDigits: 2 }
  return new Intl.NumberFormat('en-US', options).format(value)
}
