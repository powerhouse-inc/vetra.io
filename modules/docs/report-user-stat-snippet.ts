// Code shown on /docs/app-stats. REPORT_USER_STAT_SNIPPET is a verbatim copy of
// vetra-cloud-package shared/report-user-stat.ts, the unit-tested original.

export const REPORT_USER_STAT_SNIPPET = `// Report a user's current value of an app metric to Vetra, which relays it
// to Renown: the app's page (renown.id/app/<app DID>) and the user's profile.
//
// Vetra gives each licensed environment two variables:
//   VETRA_REPORTING_TOKEN  this environment's reporting token (a secret)
//   VETRA_LICENSING_URL    the endpoint to call
// Without them (local development) nothing is sent and the result is false.
//
// Dependency-free: copy this file into your package.
// Docs: https://vetra.io/docs/app-stats

const METRIC = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
const MUTATION =
  "mutation ReportUserStat($user: String!, $metric: String!, $value: Float!) " +
  "{ vetraLicensing { reportUserStat(user: $user, metric: $metric, value: $value) } }";

export class ReportUserStatError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ReportUserStatError";
    this.code = code;
  }
}

export interface ReportUserStatOptions {
  /** Where the two variables are read from (default: process.env). */
  env?: Record<string, string | undefined>;
  fetch?: typeof fetch;
  /** Default 10000 ms. */
  timeoutMs?: number;
}

type Answer = {
  data?: { vetraLicensing?: { reportUserStat?: unknown } | null } | null;
  errors?: { message?: string; extensions?: { code?: unknown } }[];
} | null;

/**
 * Sends the user's CURRENT value of \`metric\` (not a delta: the newest report
 * wins). Resolves true when Vetra queued it for Renown, false when nothing was
 * sent (not on Vetra) or Vetra did not relay it (the user is not this
 * environment's licence holder, the app has no usable Renown identity, or
 * Renown refused the app recently). Throws ReportUserStatError for an invalid
 * metric or value (INVALID_INPUT), an unknown token (UNAUTHENTICATED), or when
 * Vetra cannot be reached (NETWORK, HTTP_<status>).
 */
export async function reportUserStat(
  user: string,
  metric: string,
  value: number,
  options: ReportUserStatOptions = {},
): Promise<boolean> {
  const env = options.env ?? process.env;
  const url = env.VETRA_LICENSING_URL?.trim();
  const token = env.VETRA_REPORTING_TOKEN?.trim();
  if (!url || !token) return false;
  if (!METRIC.test(metric)) {
    throw new ReportUserStatError("INVALID_INPUT", "metric must match " + METRIC.source);
  }
  if (!Number.isFinite(value)) {
    throw new ReportUserStatError("INVALID_INPUT", "value must be a finite number");
  }
  let res: Response;
  let text: string;
  try {
    res = await (options.fetch ?? fetch)(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-vetra-reporting-token": token },
      body: JSON.stringify({ query: MUTATION, variables: { user, metric, value } }),
      signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
    });
    text = await res.text();
  } catch (error) {
    throw new ReportUserStatError("NETWORK", error instanceof Error ? error.message : "request failed");
  }
  let answer: Answer = null;
  try {
    answer = JSON.parse(text) as Answer;
  } catch {
    answer = null;
  }
  const error = answer?.errors?.[0];
  if (error) {
    const code = typeof error.extensions?.code === "string" ? error.extensions.code : "ERROR";
    throw new ReportUserStatError(code, error.message ?? "reportUserStat failed");
  }
  if (!res.ok) {
    throw new ReportUserStatError("HTTP_" + String(res.status), "Vetra answered " + String(res.status));
  }
  return answer?.data?.vetraLicensing?.reportUserStat === true;
}
`

export const USAGE_SNIPPET = `import { reportUserStat } from "./report-user-stat.js";

// In a processor or subgraph of your package, after the user acted.
// Send the user's CURRENT total, not the increment.
const relayed = await reportUserStat(userDid, "notes", notesWritten).catch((error: unknown) => {
  console.warn("app stat not reported", error);
  return false;
});
`

export const CURL_SNIPPET = String.raw`curl -s "$VETRA_LICENSING_URL" \
  -H 'content-type: application/json' \
  -H "x-vetra-reporting-token: $VETRA_REPORTING_TOKEN" \
  -d '{"query":"mutation { vetraLicensing { reportUserStat(user: \"did:pkh:eip155:1:0xHolderAddress\", metric: \"notes\", value: 42) } }"}'`
