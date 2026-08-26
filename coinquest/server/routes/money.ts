import { Hono } from 'hono'
import { one, run, tx } from '../db.ts'
import { HttpError, balanceOf, insertTransaction, requireKid, requireParent } from '../lib.ts'
import { formatMoney } from '../../shared/money.ts'

export const moneyRoutes = new Hono()

/** POST /api/money/deposits — a parent adds cash to a stash. */
moneyRoutes.post('/deposits', async (c) => {
  const { kidId, amountCents, note, parentId } = await c.req.json<{
    kidId: number
    amountCents: number
    note?: string
    parentId: number
  }>()
  const parent = await requireParent(parentId)
  const kid = await requireKid(Number(kidId))
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Enter an amount above $0')

  const result = await tx((conn) =>
    insertTransaction(
      {
        kidId: kid.id,
        type: 'deposit',
        amountCents: amount,
        note: note?.trim() || null,
        createdBy: parent.id,
      },
      conn,
    ),
  )
  return c.json({ balanceCents: result.balanceAfter })
})

/**
 * POST /api/money/withdrawals — a kid asks to take money out. This only files
 * the request; the money does not move until a parent approves it.
 */
moneyRoutes.post('/withdrawals', async (c) => {
  const { kidId, amountCents, category, note } = await c.req.json<{
    kidId: number
    amountCents: number
    category: string
    note?: string
  }>()
  const kid = await requireKid(Number(kidId))
  const amount = Math.round(Number(amountCents))
  if (!Number.isFinite(amount) || amount <= 0) throw new HttpError(400, 'Enter an amount above $0')

  const id = await tx(async (conn) => {
    const balance = await balanceOf(kid.id, conn, true)
    // Money already promised to another open request cannot be spent twice.
    const [rows] = await conn.query(
      `SELECT COALESCE(SUM(amount_cents), 0) AS n
         FROM withdrawal_requests WHERE kid_id = ? AND status = 'pending' FOR UPDATE`,
      [kid.id],
    )
    const held = Number((rows as { n: number }[])[0]?.n ?? 0)
    const available = balance - held
    if (amount > available) {
      throw new HttpError(400, `You can ask for up to ${formatMoney(available)}`)
    }

    const [result] = await conn.query(
      `INSERT INTO withdrawal_requests (kid_id, amount_cents, category, note, status, requested_at)
       VALUES (?, ?, ?, ?, 'pending', ?)`,
      [kid.id, amount, category?.trim() || 'Other', note?.trim() || null, new Date()],
    )
    return Number((result as { insertId: number }).insertId)
  })

  return c.json({ id })
})

/** GET /api/money/withdrawals?kidId= — a kid's own open requests. */
moneyRoutes.get('/withdrawals', async (c) => {
  const kidId = Number(c.req.query('kidId'))
  await requireKid(kidId)
  const rows = await one<{ n: number }>(
    `SELECT COALESCE(SUM(amount_cents), 0) AS n
       FROM withdrawal_requests WHERE kid_id = ? AND status = 'pending'`,
    [kidId],
  )
  return c.json({ heldCents: Number(rows?.n ?? 0) })
})

/** Retired in favour of /api/approvals; kept so older clients get a clear error. */
moneyRoutes.post('/withdrawals/:id/confirm', () => {
  throw new HttpError(410, 'Use POST /api/approvals/withdrawal/:id/approve')
})

export { run }
