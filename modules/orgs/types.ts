export type OrgRole = 'OWNER' | 'ADMIN' | 'PUBLISHER' | 'MEMBER'

/**
 * Whether the role may be offered "create app": OWNER/ADMIN always, PUBLISHER when its
 * scope covers all apps (the client cannot see the scope; the server decides and refuses).
 */
export const canOfferCreateApp = (role: OrgRole): boolean => role !== 'MEMBER'

/** A Renown organisation as Vetra shows it (renown-orgs `Organization`, trimmed). */
export type OrgSummary = {
  id: string
  did: string
  handle: string
  name: string
  /** attachment://v1:<sha256>; served at <renown>/media/<id>/avatar */
  avatar: string | null
  verifiedDomains: string[]
}

export type MyOrg = OrgSummary & { role: OrgRole }
