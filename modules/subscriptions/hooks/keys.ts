export const subscriptionsKeys = {
  all: ['subscriptions'] as const,
  mine: (did: string) => ['subscriptions', 'mine', did] as const,
  studioAccess: (did: string) => ['subscriptions', 'studio-access', did] as const,
  inviteCode: (code: string) => ['subscriptions', 'invite-code', code] as const,
}
