import { z } from 'zod'
import { CODE_MAX_LENGTH } from './constants'

/** A submitted invite code: non-empty, trimmed, length-capped. */
export const codeField = z.string().trim().min(1).max(CODE_MAX_LENGTH)

/** A Renown bearer token (a DID-JWT). */
export const tokenField = z.string().min(1)

/** `POST /api/invite/validate` body. */
export const validateBodySchema = z.object({ code: codeField })

/** `POST /api/invite/redeem` body. */
export const redeemBodySchema = z.object({ code: codeField, token: tokenField })

/** `POST /api/invite/status` body. */
export const statusBodySchema = z.object({ token: tokenField })
