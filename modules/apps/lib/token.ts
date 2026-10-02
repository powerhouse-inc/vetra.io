/**
 * Right after a full-page redirect (GitHub, Renown) the Renown session reports
 * "authenticated" a moment before it can mint bearer tokens. A mutation sent in
 * that window goes out without a token and the switchboard answers
 * UNAUTHENTICATED. Poll briefly for a token instead.
 */
export async function waitForToken(
  mint: () => Promise<string | null>,
  { timeoutMs = 8_000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      const token = await mint()
      if (token) return token
    } catch {
      /* not ready yet */
    }
    if (Date.now() >= deadline) return null
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
}
