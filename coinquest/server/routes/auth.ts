import { Hono } from 'hono'
import { all, verifyPin } from '../db.ts'
import { toPerson, type UserRow } from '../lib.ts'

export const authRoutes = new Hono()

/**
 * Parent mode is a PIN gate on a shared family device, not an identity system:
 * any parent PIN in the family unlocks parent mode as that parent.
 */
authRoutes.post('/parent', async (c) => {
  const { pin } = await c.req.json<{ pin: string }>()
  if (!pin) return c.json({ error: 'Enter your PIN' }, 400)

  const parents = await all<UserRow>(`SELECT * FROM users WHERE role = 'parent'`)
  const match = parents.find((p) => verifyPin(pin, p.pin_hash))
  if (!match) return c.json({ error: "That PIN doesn't match" }, 401)

  return c.json({ parent: toPerson(match) })
})
