export type OrgRole = 'OWNER' | 'ADMIN' | 'PUBLISHER' | 'MEMBER'

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
